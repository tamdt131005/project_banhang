export const STAFF_PERMISSIONS = [
  'DASHBOARD',
  'ORDERS',
  'INVENTORY',
  'CATALOG',
  'BANNERS',
  'CUSTOMERS',
  'SUPPORT',
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSIONS)[number];

export const STAFF_PERMISSION_LABELS: Record<StaffPermissionKey, string> = {
  DASHBOARD: 'Tổng quan',
  ORDERS: 'Đơn hàng',
  INVENTORY: 'Kho hàng',
  CATALOG: 'Sản phẩm & danh mục',
  BANNERS: 'Banner',
  CUSTOMERS: 'Khách hàng',
  SUPPORT: 'Hỗ trợ',
};
