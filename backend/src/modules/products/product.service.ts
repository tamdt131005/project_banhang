import { Prisma } from '@prisma/client';
import { deleteStoredImage, storeProductImage } from '../../lib/image.js';
import { prisma } from '../../lib/prisma.js';
import { uniqueSlug } from '../../lib/slug.js';
import { AppError } from '../../middleware/error.js';
import { descendantCategoryIds } from '../categories/category.service.js';
import {
  createVariantWithInitialStock,
  retireVariant,
} from '../inventory/inventory.service.js';
import type {
  ProductCreateInput,
  ProductQuery,
  ProductUpdateInput,
  ProductUpdateVariantInput,
} from './product.schema.js';

/**
 * Tồn kho nằm trên biến thể. API vẫn trả trường `stock` = tổng các biến thể
 * để lưới sản phẩm và cột admin dùng thẳng, không phải tự cộng.
 */

/** Lưới sản phẩm chỉ cần một ảnh — kéo cả bộ ảnh về là lãng phí. */
const listSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  isActive: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    select: { url: true, thumbUrl: true },
    orderBy: { sortOrder: 'asc' },
    take: 1,
  },
  variants: { select: { stock: true } },
} satisfies Prisma.ProductSelect;

const detailSelect = {
  ...listSelect,
  description: true,
  images: {
    select: { id: true, url: true, thumbUrl: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  // id tăng dần = thứ tự khai báo lúc tạo, nên size hiện đúng thứ tự S→XL.
  variants: {
    select: { id: true, size: true, color: true, stock: true },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ProductSelect;

function sumStock(variants: { stock: number }[]) {
  return variants.reduce((sum, variant) => sum + variant.stock, 0);
}

/** Bản ghi lưới: gộp biến thể thành một số tổng, không lộ danh sách. */
function toSummary<T extends { variants: { stock: number }[] }>(product: T) {
  const { variants, ...rest } = product;
  return { ...rest, stock: sumStock(variants) };
}

/** Bản ghi chi tiết: giữ danh sách biến thể VÀ kèm tổng. */
function toDetail<T extends { variants: { stock: number }[] }>(product: T) {
  return { ...product, stock: sumStock(product.variants) };
}

const ORDER_BY: Record<ProductQuery['sort'], Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  'price-asc': { price: 'asc' },
  'price-desc': { price: 'desc' },
  name: { name: 'asc' },
};

async function slugIsTaken(slug: string, exceptId?: number) {
  const found = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  return found !== null && found.id !== exceptId;
}

export async function listProducts(query: ProductQuery, options?: { includeInactive?: boolean }) {
  const where: Prisma.ProductWhereInput = {};

  if (options?.includeInactive !== true) {
    where.isActive = true;
  }

  if (query.search) {
    // MySQL với collation utf8mb4_unicode_ci đã không phân biệt hoa thường,
    // nên không cần (và cũng không hỗ trợ) tuỳ chọn mode: 'insensitive'.
    where.name = { contains: query.search };
  }

  if (query.categoryId !== undefined) {
    where.categoryId = { in: await descendantCategoryIds(query.categoryId) };
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {
      ...(query.minPrice === undefined ? {} : { gte: query.minPrice }),
      ...(query.maxPrice === undefined ? {} : { lte: query.maxPrice }),
    };
  }

  // Lọc theo size/màu qua biến thể, kèm điều kiện CÒN HÀNG: khách lọc "size M"
  // để tìm đồ mặc được ngay — sản phẩm có size M nhưng hết sạch chỉ gây thất vọng.
  if (query.size !== undefined || query.color !== undefined) {
    where.variants = {
      some: {
        ...(query.size === undefined ? {} : { size: query.size }),
        ...(query.color === undefined ? {} : { color: query.color }),
        stock: { gt: 0 },
      },
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[query.sort],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: listSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map(toSummary),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/** Thứ tự size chữ quen mắt; số xếp theo giá trị; Freesize luôn cuối. */
const LETTER_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function sizeSortKey(size: string): [group: number, value: number | string] {
  const letterIndex = LETTER_SIZE_ORDER.indexOf(size.toUpperCase());
  if (letterIndex !== -1) return [0, letterIndex];

  const numeric = Number(size);
  if (Number.isFinite(numeric)) return [1, numeric];

  if (size.toLowerCase() === 'freesize') return [3, 0];
  return [2, size];
}

function compareSizes(a: string, b: string) {
  const [groupA, valueA] = sizeSortKey(a);
  const [groupB, valueB] = sizeSortKey(b);
  if (groupA !== groupB) return groupA - groupB;
  if (typeof valueA === 'number' && typeof valueB === 'number') return valueA - valueB;
  return String(valueA).localeCompare(String(valueB), 'vi');
}

/**
 * Các giá trị size/màu đang thực bán — nguồn cho hàng chip lọc nhanh.
 * Chỉ lấy từ sản phẩm đang bán để chip không trỏ vào kết quả rỗng vô cớ.
 */
export async function getFilterOptions() {
  const [sizes, colors] = await Promise.all([
    prisma.productVariant.findMany({
      where: { product: { isActive: true } },
      distinct: ['size'],
      select: { size: true },
    }),
    prisma.productVariant.findMany({
      where: { product: { isActive: true } },
      distinct: ['color'],
      select: { color: true },
    }),
  ]);

  return {
    sizes: sizes.map((row) => row.size).sort(compareSizes),
    colors: colors.map((row) => row.color).sort((a, b) => a.localeCompare(b, 'vi')),
  };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug }, select: detailSelect });

  // Sản phẩm đã ẩn coi như không tồn tại với khách.
  if (!product || !product.isActive) {
    throw AppError.notFound('Không tìm thấy sản phẩm này.');
  }
  return toDetail(product);
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({ where: { id }, select: detailSelect });
  if (!product) throw AppError.notFound('Không tìm thấy sản phẩm này.');
  return toDetail(product);
}

async function assertCategoryExists(categoryId: number) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw AppError.badRequest('CATEGORY_NOT_FOUND', 'Danh mục được chọn không tồn tại.');
  }
}

async function lockProductRow(tx: Prisma.TransactionClient, productId: number) {
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM products WHERE id = ${productId} FOR UPDATE
  `;
  if (rows.length === 0) throw AppError.notFound('Không tìm thấy sản phẩm này.');
}

export async function createProduct(input: ProductCreateInput, adminUserId: number) {
  await assertCategoryExists(input.categoryId);

  const createdId = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: input.name,
        slug: await uniqueSlug(input.name, (slug) => slugIsTaken(slug)),
        description: input.description,
        price: input.price,
        categoryId: input.categoryId,
        isActive: input.isActive ?? true,
      },
      select: { id: true, name: true },
    });

    for (const variant of input.variants) {
      await createVariantWithInitialStock(tx, {
        productId: created.id,
        productName: created.name,
        size: variant.size,
        color: variant.color,
        initialStock: variant.initialStock,
        actor: { type: 'ADMIN', userId: adminUserId },
      });
    }

    return created.id;
  });

  return getProductById(createdId);
}

/**
 * Thay bộ biến thể của sản phẩm bằng danh sách mới theo khoá (size, màu):
 * trùng khoá thì cập nhật tồn kho tại chỗ (giữ id — dòng giỏ hàng đang trỏ
 * vào không bị mất), khoá vắng mặt thì xoá (Cascade dọn dòng giỏ, đơn cũ giữ
 * snapshot qua SetNull).
 */
async function replaceVariants(
  tx: Prisma.TransactionClient,
  productId: number,
  productName: string,
  variants: ProductUpdateVariantInput[],
  adminUserId: number,
) {
  const existing = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((variant) => variant.id));
  const sentIds = variants
    .filter((variant): variant is Extract<ProductUpdateVariantInput, { id: number }> => 'id' in variant)
    .map((variant) => variant.id);

  const foreignId = sentIds.find((id) => !existingIds.has(id));
  if (foreignId !== undefined) {
    throw AppError.badRequest(
      'VARIANT_NOT_FOUND',
      'Biến thể cập nhật không thuộc sản phẩm này hoặc không còn tồn tại.',
      { variantId: foreignId },
    );
  }

  const keepIds = new Set(sentIds);
  for (const variant of existing) {
    if (!keepIds.has(variant.id)) {
      await retireVariant(tx, {
        variantId: variant.id,
        actor: { type: 'ADMIN', userId: adminUserId },
      });
    }
  }

  // Move kept rows to transaction-local unique keys first, so swapping size/color between two
  // stable ids does not fail on the compound unique index midway through the update.
  for (const variantId of sentIds) {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { size: `~${variantId}`, color: `~${variantId}` },
    });
  }

  for (const variant of variants) {
    if ('id' in variant) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { size: variant.size, color: variant.color },
      });
      continue;
    }

    await createVariantWithInitialStock(tx, {
      productId,
      productName,
      size: variant.size,
      color: variant.color,
      initialStock: variant.initialStock,
      actor: { type: 'ADMIN', userId: adminUserId },
    });
  }
}

export async function updateProduct(id: number, input: ProductUpdateInput, adminUserId: number) {
  if (input.categoryId !== undefined) {
    await assertCategoryExists(input.categoryId);
  }

  await prisma.$transaction(async (tx) => {
    await lockProductRow(tx, id);
    const existing = await tx.product.findUniqueOrThrow({ where: { id } });

    const updated = await tx.product.update({
      where: { id },
      data: {
        ...(input.name === undefined
          ? {}
          : {
              name: input.name,
              // Đổi tên thì đổi slug theo, nhưng giữ nguyên nếu tên không thay
              // đổi để đường dẫn cũ không chết vô cớ.
              slug:
                input.name === existing.name
                  ? existing.slug
                  : await uniqueSlug(input.name, (slug) => slugIsTaken(slug, id)),
            }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.price === undefined ? {} : { price: input.price }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      select: { name: true },
    });

    if (input.variants !== undefined) {
      await replaceVariants(tx, id, updated.name, input.variants, adminUserId);
    }
  });

  return getProductById(id);
}

export async function removeProduct(id: number, adminUserId: number) {
  const images = await prisma.$transaction(async (tx) => {
    await lockProductRow(tx, id);
    // Re-read after taking the product lock. Concurrent updateProduct calls use the same lock,
    // so every variant that can be cascaded by this delete is present in this snapshot.
    const product = await tx.product.findUniqueOrThrow({
      where: { id },
      select: {
        variants: { select: { id: true } },
        images: { select: { url: true, thumbUrl: true } },
      },
    });

    for (const variant of product.variants) {
      await retireVariant(tx, {
        variantId: variant.id,
        actor: { type: 'ADMIN', userId: adminUserId },
      });
    }
    await tx.product.delete({ where: { id } });
    return product.images;
  });

  // Dọn tệp sau cùng — nếu bước này lỗi thì chỉ còn ảnh mồ côi trên đĩa,
  // không làm hỏng dữ liệu.
  await Promise.all(images.map((image) => deleteStoredImage(image)));
}

export async function addProductImages(productId: number, files: Express.Multer.File[]) {
  if (files.length === 0) {
    throw AppError.badRequest('NO_FILE', 'Chưa chọn ảnh nào để tải lên.');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, images: { select: { sortOrder: true } } },
  });
  if (!product) throw AppError.notFound('Không tìm thấy sản phẩm này.');

  const startOrder = product.images.reduce((max, image) => Math.max(max, image.sortOrder + 1), 0);

  const stored = await Promise.all(files.map((file) => storeProductImage(file.buffer)));

  await prisma.productImage.createMany({
    data: stored.map((image, index) => ({
      productId,
      url: image.url,
      thumbUrl: image.thumbUrl,
      sortOrder: startOrder + index,
    })),
  });

  return getProductById(productId);
}

export async function removeProductImage(imageId: number) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw AppError.notFound('Không tìm thấy ảnh này.');

  await prisma.productImage.delete({ where: { id: imageId } });
  await deleteStoredImage(image);
}

/**
 * Sắp xếp lại ảnh theo đúng thứ tự id gửi lên. Ảnh đầu danh sách là ẢNH BÌA —
 * lưới sản phẩm và giỏ hàng đều lấy ảnh sortOrder nhỏ nhất.
 *
 * Bắt buộc gửi ĐỦ và ĐÚNG bộ ảnh của sản phẩm: gửi thiếu thì những ảnh vắng
 * mặt sẽ giữ sortOrder cũ và chen ngang vào thứ tự mới một cách khó đoán.
 */
export async function reorderProductImages(productId: number, imageIds: number[]) {
  const images = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true },
  });

  if (images.length === 0) throw AppError.notFound('Sản phẩm này chưa có ảnh nào.');

  const current = new Set(images.map((image) => image.id));
  const sent = new Set(imageIds);

  if (sent.size !== imageIds.length) {
    throw AppError.badRequest('DUPLICATE_IMAGE', 'Danh sách ảnh có id trùng nhau.');
  }

  if (sent.size !== current.size || imageIds.some((id) => !current.has(id))) {
    throw AppError.badRequest(
      'IMAGE_SET_MISMATCH',
      'Danh sách ảnh không khớp với bộ ảnh hiện có của sản phẩm.',
    );
  }

  await prisma.$transaction(
    imageIds.map((id, index) =>
      prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  return getProductById(productId);
}
