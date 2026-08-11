import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '../api/cart';
import { useAuth } from '../context/AuthContext';
import type { ApiCart } from '../types/api';

const CART_KEY = ['cart'];

/**
 * Giỏ hàng lưu trên server nên chỉ nạp khi đã đăng nhập; gọi lúc chưa đăng
 * nhập sẽ nhận 401 và làm bẩn màn hình bằng lỗi không cần thiết.
 */
export function useCart() {
  const { user } = useAuth();

  return useQuery({
    queryKey: CART_KEY,
    queryFn: () => cartApi.get().then((response) => response.cart),
    enabled: user !== null,
  });
}

/** Số món hiện trên badge của header. */
export function useCartCount(): number {
  const { data } = useCart();
  return data?.itemCount ?? 0;
}

/**
 * Mọi thao tác giỏ hàng đều trả về giỏ mới nhất, nên ghi thẳng vào cache thay
 * vì đánh dấu cũ rồi gọi lại — tiết kiệm một vòng mạng và tránh nhấp nháy số
 * lượng trên badge.
 */
function useCartMutation<TInput>(mutationFn: (input: TInput) => Promise<{ cart: ApiCart }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: ({ cart }) => {
      queryClient.setQueryData(CART_KEY, cart);
    },
  });
}

export function useAddToCart() {
  return useCartMutation((input: { variantId: number; quantity: number }) =>
    cartApi.add(input.variantId, input.quantity),
  );
}

export function useSetCartQuantity() {
  return useCartMutation((input: { itemId: number; quantity: number }) =>
    cartApi.setQuantity(input.itemId, input.quantity),
  );
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: number) => cartApi.remove(itemId));
}
