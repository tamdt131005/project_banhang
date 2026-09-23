import type { AdminPermission, ApiUser } from '../types/api';

const STAFF_LANDING_PATHS: [AdminPermission, string][] = [
  ['DASHBOARD', '/admin'],
  ['ORDERS', '/admin/don-hang'],
  ['SUPPORT', '/admin/ho-tro'],
  ['CUSTOMERS', '/admin/khach-hang'],
  ['CATALOG', '/admin/san-pham'],
  ['INVENTORY', '/admin/kho'],
  ['BANNERS', '/admin/banner'],
];

export function staffLandingPath(user: ApiUser): string {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role !== 'STAFF') return '/';
  return STAFF_LANDING_PATHS.find(([permission]) =>
    user.adminPermissions.includes(permission),
  )?.[1] ?? '/';
}
