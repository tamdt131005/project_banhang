import { prisma } from '../../lib/prisma.js';
import { uniqueSlug } from '../../lib/slug.js';
import { AppError } from '../../middleware/error.js';
import type { CategoryCreateInput, CategoryUpdateInput } from './category.schema.js';

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
  children: CategoryNode[];
}

async function slugIsTaken(slug: string, exceptId?: number) {
  const found = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  return found !== null && found.id !== exceptId;
}

/**
 * Cây danh mục dựng trong bộ nhớ từ một truy vấn duy nhất. Cây của cửa hàng
 * chỉ vài chục nút nên đệ quy xuống database sẽ tốn hơn nhiều lần.
 */
export async function listCategoryTree(): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true } } },
  });

  const nodes = new Map<number, CategoryNode>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        slug: row.slug,
        sortOrder: row.sortOrder,
        productCount: row._count.products,
        children: [],
      },
    ]),
  );

  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (row.parentId === null) {
      roots.push(node);
    } else {
      nodes.get(row.parentId)?.children.push(node);
    }
  }

  return roots;
}

/**
 * Danh mục đã cho cộng toàn bộ danh mục con cháu.
 * Chọn "Điện thoại & Phụ kiện" phải ra cả hàng trong "Tai nghe", "Sạc & Cáp".
 */
export async function descendantCategoryIds(rootId: number): Promise<number[]> {
  const rows = await prisma.category.findMany({ select: { id: true, parentId: true } });

  const childrenOf = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parentId !== null) {
      const siblings = childrenOf.get(row.parentId) ?? [];
      siblings.push(row.id);
      childrenOf.set(row.parentId, siblings);
    }
  }

  const collected: number[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    collected.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return collected;
}

async function assertParentIsValid(parentId: number, selfId?: number) {
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { id: true },
  });
  if (!parent) {
    throw AppError.badRequest('PARENT_NOT_FOUND', 'Danh mục cha không tồn tại.');
  }

  if (selfId !== undefined) {
    // Gán cha là chính nó hoặc là con cháu của nó sẽ tạo vòng lặp, khiến cây
    // danh mục không dựng được và mọi truy vấn theo nhánh bị treo.
    const forbidden = await descendantCategoryIds(selfId);
    if (forbidden.includes(parentId)) {
      throw AppError.badRequest(
        'CATEGORY_CYCLE',
        'Không thể đặt danh mục này nằm dưới chính nó hoặc dưới danh mục con của nó.',
      );
    }
  }
}

export async function createCategory(input: CategoryCreateInput) {
  if (input.parentId != null) {
    await assertParentIsValid(input.parentId);
  }

  return prisma.category.create({
    data: {
      name: input.name,
      slug: await uniqueSlug(input.name, (slug) => slugIsTaken(slug)),
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateCategory(id: number, input: CategoryUpdateInput) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Không tìm thấy danh mục.');

  if (input.parentId != null) {
    await assertParentIsValid(input.parentId, id);
  }

  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name === undefined
        ? {}
        : {
            name: input.name,
            slug:
              input.name === existing.name
                ? existing.slug
                : await uniqueSlug(input.name, (slug) => slugIsTaken(slug, id)),
          }),
      ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    },
  });
}

export async function removeCategory(id: number) {
  const [children, products] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);

  if (children > 0) {
    throw AppError.conflict(
      'CATEGORY_HAS_CHILDREN',
      `Danh mục còn ${children} danh mục con. Hãy xoá hoặc chuyển chúng đi trước.`,
    );
  }
  if (products > 0) {
    throw AppError.conflict(
      'CATEGORY_HAS_PRODUCTS',
      `Danh mục còn ${products} sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.`,
    );
  }

  await prisma.category.delete({ where: { id } });
}
