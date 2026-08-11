import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { CartAddInput } from './cart.schema.js';

export interface CartItemView {
  id: number;
  variantId: number;
  productId: number;
  name: string;
  slug: string;
  size: string;
  color: string;
  thumbUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** Tồn kho của đúng biến thể này, không phải tổng sản phẩm. */
  stock: number;
  /** false khi sản phẩm ngừng bán hoặc biến thể không còn đủ hàng. */
  isAvailable: boolean;
}

export interface CartView {
  items: CartItemView[];
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  hasUnavailableItems: boolean;
}

/** Nhãn đầy đủ để nói chuyện với người dùng: Áo thun... (M, Đen). */
function variantLabel(name: string, size: string, color: string) {
  return `${name} (${size}, ${color})`;
}

const itemInclude = {
  variant: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          isActive: true,
          images: { select: { thumbUrl: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
        },
      },
    },
  },
} as const;

/**
 * Tài khoản tạo qua đăng ký đã có sẵn giỏ, nhưng tài khoản từ seed thì chưa.
 * Tạo tại chỗ để phần còn lại không phải xử lý trường hợp thiếu giỏ.
 */
async function ensureCart(userId: number) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

export async function getCart(userId: number): Promise<CartView> {
  const cart = await ensureCart(userId);

  const rows = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: 'asc' },
    include: itemInclude,
  });

  // Giá lấy trực tiếp từ bảng sản phẩm chứ không chụp lại: giỏ hàng phải luôn
  // hiện giá hiện hành. Chỉ tới khi đặt hàng mới chụp giá vào đơn.
  const items: CartItemView[] = rows.map((row) => ({
    id: row.id,
    variantId: row.variant.id,
    productId: row.variant.product.id,
    name: row.variant.product.name,
    slug: row.variant.product.slug,
    size: row.variant.size,
    color: row.variant.color,
    thumbUrl: row.variant.product.images[0]?.thumbUrl ?? null,
    unitPrice: row.variant.product.price,
    quantity: row.quantity,
    lineTotal: row.variant.product.price * row.quantity,
    stock: row.variant.stock,
    isAvailable: row.variant.product.isActive && row.variant.stock >= row.quantity,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = items.length === 0 ? 0 : env.SHIPPING_FEE;

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    hasUnavailableItems: items.some((item) => !item.isAvailable),
  };
}

export async function addItem(userId: number, input: CartAddInput): Promise<CartView> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    include: { product: { select: { name: true, isActive: true } } },
  });
  if (!variant || !variant.product.isActive) {
    throw AppError.notFound('Sản phẩm không tồn tại hoặc đã ngừng bán.');
  }

  const label = variantLabel(variant.product.name, variant.size, variant.color);
  const cart = await ensureCart(userId);
  const key = { cartId_variantId: { cartId: cart.id, variantId: variant.id } };

  const existing = await prisma.cartItem.findUnique({ where: key });
  // Thêm tiếp vào dòng đã có, nên phải kiểm tra tổng chứ không chỉ phần thêm.
  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;

  if (nextQuantity > variant.stock) {
    throw AppError.conflict(
      'INSUFFICIENT_STOCK',
      variant.stock === 0
        ? `"${label}" đã hết hàng.`
        : `"${label}" chỉ còn ${variant.stock} sản phẩm.`,
    );
  }

  await prisma.cartItem.upsert({
    where: key,
    update: { quantity: nextQuantity },
    create: { cartId: cart.id, variantId: variant.id, quantity: input.quantity },
  });

  return getCart(userId);
}

async function findOwnedItem(userId: number, itemId: number) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: { select: { userId: true } }, ...itemInclude },
  });
  if (!item || item.cart.userId !== userId) {
    throw AppError.notFound('Không tìm thấy sản phẩm này trong giỏ hàng.');
  }
  return item;
}

export async function updateItem(
  userId: number,
  itemId: number,
  quantity: number,
): Promise<CartView> {
  const item = await findOwnedItem(userId, itemId);

  if (quantity > item.variant.stock) {
    const label = variantLabel(item.variant.product.name, item.variant.size, item.variant.color);
    throw AppError.conflict(
      'INSUFFICIENT_STOCK',
      `"${label}" chỉ còn ${item.variant.stock} sản phẩm.`,
    );
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return getCart(userId);
}

export async function removeItem(userId: number, itemId: number): Promise<CartView> {
  await findOwnedItem(userId, itemId);
  await prisma.cartItem.delete({ where: { id: itemId } });
  return getCart(userId);
}

export async function clearCart(userId: number): Promise<CartView> {
  const cart = await ensureCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(userId);
}
