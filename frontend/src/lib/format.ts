/** Mọi số tiền trong hệ thống là số nguyên VND. */
export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
};

/**
 * Trạng thái nào chuyển được sang trạng thái nào — bản sao của
 * ALLOWED_TRANSITIONS trong backend/src/modules/orders/order.service.ts.
 *
 * Ở đây chỉ dùng để không hiện những nút chắc chắn bị từ chối. Backend vẫn là
 * nơi quyết định: nó kiểm tra lại đúng bảng này trong transaction.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export type InventoryMovementType =
  | 'BASELINE'
  | 'INITIAL_STOCK'
  | 'ORDER_RESERVED'
  | 'ORDER_RESTORED'
  | 'ADMIN_ADJUSTMENT'
  | 'VARIANT_RETIRED';

export const INVENTORY_MOVEMENT_LABEL: Record<InventoryMovementType, string> = {
  BASELINE: 'Số dư khi nâng cấp',
  INITIAL_STOCK: 'Tồn kho ban đầu',
  ORDER_RESERVED: 'Giữ hàng cho đơn',
  ORDER_RESTORED: 'Hoàn kho do huỷ đơn',
  ADMIN_ADJUSTMENT: 'Nhân viên điều chỉnh',
  VARIANT_RETIRED: 'Ngừng biến thể',
};

/** Cặp màu nền/chữ cho badge trạng thái, theo mục 2 của DESIGN.md. */
export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  CONFIRMED: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  SHIPPING: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};
