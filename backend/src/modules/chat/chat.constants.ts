export const SUPPORT_REQUESTED_CONTENT =
  'Khách hàng đã yêu cầu hỗ trợ từ nhân viên.';

export const SUPPORT_ACCEPTED_CONTENT =
  'Nhân viên hỗ trợ đã tiếp nhận cuộc trò chuyện.';

export const CONVERSATION_CLOSED_CONTENT = 'Cuộc trò chuyện đã được đóng.';

export const SUPPORT_CATEGORIES = [
  'DON_HANG',
  'SAN_PHAM',
  'GIAO_HANG',
  'THANH_TOAN',
  'DOI_TRA',
  'TAI_KHOAN',
  'KHAC',
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  DON_HANG: 'Đơn hàng',
  SAN_PHAM: 'Sản phẩm',
  GIAO_HANG: 'Giao hàng',
  THANH_TOAN: 'Thanh toán',
  DOI_TRA: 'Đổi trả',
  TAI_KHOAN: 'Tài khoản',
  KHAC: 'Khác',
};

export const SUPPORT_CATEGORY_PREFIX = 'Phân loại yêu cầu hỗ trợ: ';
export const STAFF_NOTE_PREFIX = 'Ghi chú nội bộ: ';
export const STAFF_NOTE_KIND = 'STAFF_NOTE';
export const SUPPORT_CATEGORY_KIND = 'SUPPORT_CATEGORY';

export function messageMetadataKind(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null;
  const kind = (metadata as { kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : null;
}

export function supportCategoryLabel(category: string): string {
  if ((SUPPORT_CATEGORIES as readonly string[]).includes(category)) {
    return SUPPORT_CATEGORY_LABEL[category as SupportCategory];
  }
  return category;
}
