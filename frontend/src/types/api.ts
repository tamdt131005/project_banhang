import type { OrderStatus } from '../lib/format';

export interface ApiUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  /** Đường dẫn /uploads/... của ảnh đại diện; null = dùng avatar chữ viết tắt. */
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
}

export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
  children: ApiCategory[];
}

export interface ApiProductImage {
  id: number;
  url: string;
  thumbUrl: string;
  sortOrder: number;
}

export interface ApiProductSummary {
  id: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  category: { id: number; name: string; slug: string };
  /** Danh sách chỉ trả một ảnh — lưới không cần bộ ảnh đầy đủ. */
  images: { url: string; thumbUrl: string }[];
}

/** Một biến thể mua được: tổ hợp size × màu với tồn kho riêng. */
export interface ApiVariant {
  id: number;
  size: string;
  color: string;
  stock: number;
}

export interface ApiProductDetail extends Omit<ApiProductSummary, 'images'> {
  description: string;
  images: ApiProductImage[];
  variants: ApiVariant[];
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiPaged<T> {
  items: T[];
  pagination: ApiPagination;
}

export interface ApiAddress {
  id: number;
  fullName: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
}

export interface ApiCartItem {
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
  isAvailable: boolean;
}

export interface ApiCart {
  items: ApiCartItem[];
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  hasUnavailableItems: boolean;
}

export interface ApiOrderItem {
  id: number;
  productId: number | null;
  productName: string;
  productImage: string | null;
  /** Snapshot lúc mua; null ở các đơn tạo trước khi có biến thể. */
  size: string | null;
  color: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type OrderStatusHistoryType = 'CREATED' | 'TRANSITION' | 'BASELINE';

/**
 * Mốc trạng thái do backend ghi nhận. `occurredAt` là null với dữ liệu baseline
 * được tạo khi nâng cấp, vì hệ thống không suy đoán thời điểm nghiệp vụ đã xảy ra.
 */
export interface ApiOrderStatusHistory {
  id: number;
  type: OrderStatusHistoryType;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  actorUserId: number | null;
  reason: string | null;
  occurredAt: string | null;
  recordedAt: string;
}

export interface ApiOrder {
  id: number;
  code: string;
  status: OrderStatus;
  paymentMethod: 'COD' | 'MOMO';
  paymentStatus: 'UNPAID' | 'PAID' | 'FAILED';
  subtotal: number;
  shippingFee: number;
  total: number;
  receiverName: string;
  receiverPhone: string;
  shippingLine1: string;
  shippingWard: string;
  shippingDistrict: string;
  shippingProvince: string;
  note: string | null;
  createdAt: string;
  items: ApiOrderItem[];
  /** Chỉ được tải trên API chi tiết; danh sách có thể bỏ qua để giữ payload gọn. */
  statusHistory?: ApiOrderStatusHistory[];
}

export interface ApiHealth {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  time: string;
}
