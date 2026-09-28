/**
 * Khớp mã và nhãn trong backend/src/modules/orders/order.schema.ts.
 * Mã gửi lên API; nhãn chỉ để hiện trong hộp chọn.
 */

export const CUSTOMER_CANCEL_REASONS = [
  { code: 'CHANGED_MIND', label: 'Đổi ý, không muốn mua nữa' },
  { code: 'WRONG_ITEM', label: 'Đặt nhầm sản phẩm, size hoặc màu' },
  { code: 'CHANGE_ADDRESS', label: 'Muốn đổi địa chỉ hoặc thông tin nhận hàng' },
  { code: 'FOUND_BETTER_PRICE', label: 'Tìm được nơi khác phù hợp hơn' },
  { code: 'WAIT_TOO_LONG', label: 'Chờ xử lý đơn quá lâu' },
] as const;

export const ADMIN_CANCEL_REASONS = [
  { code: 'CUSTOMER_REQUEST', label: 'Khách yêu cầu huỷ' },
  { code: 'OUT_OF_STOCK', label: 'Hết hàng hoặc không đủ tồn kho' },
  { code: 'UNREACHABLE', label: 'Không liên hệ được khách' },
  { code: 'INVALID_ADDRESS', label: 'Thông tin giao hàng không hợp lệ' },
  { code: 'PAYMENT_ISSUE', label: 'Thanh toán không thành công' },
] as const;

export type CancelReasonMode = 'preset' | 'custom';

export interface CancelReasonOption {
  code: string;
  label: string;
}

export interface CancelReasonSelection {
  mode: CancelReasonMode;
  reasonCode: string;
  customReason: string;
}

/** Payload gửi lên API. `null` khi chưa chọn lý do có sẵn và cũng chưa tự điền. */
export interface CancelReasonPayload {
  reasonCode: string;
  reason?: string;
}

export const CANCEL_REASON_MAX_LENGTH = 500;

export function cancelReasonPayload(selection: CancelReasonSelection): CancelReasonPayload | null {
  if (selection.mode === 'preset') {
    return selection.reasonCode === '' ? null : { reasonCode: selection.reasonCode };
  }

  const reason = selection.customReason.trim();
  if (reason.length === 0 || reason.length > CANCEL_REASON_MAX_LENGTH) return null;
  return { reasonCode: 'OTHER', reason };
}
