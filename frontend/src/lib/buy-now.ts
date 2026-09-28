/** Đúng sản phẩm khách bấm Mua ngay. Giỏ hàng không tham gia đơn này. */
export interface BuyNowRequest {
  slug: string;
  variantId: number;
  quantity: number;
}

export function readBuyNow(state: unknown): BuyNowRequest | null {
  if (!state || typeof state !== 'object' || !('buyNow' in state)) return null;

  const buyNow = (state as { buyNow?: unknown }).buyNow;
  if (!buyNow || typeof buyNow !== 'object') return null;

  const value = buyNow as Partial<BuyNowRequest>;
  if (typeof value.slug !== 'string' || value.slug.trim() === '') return null;
  if (typeof value.variantId !== 'number' || !Number.isInteger(value.variantId) || value.variantId <= 0) {
    return null;
  }
  if (
    typeof value.quantity !== 'number' ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > 99
  ) {
    return null;
  }

  return { slug: value.slug, variantId: value.variantId, quantity: value.quantity };
}
