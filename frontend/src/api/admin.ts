import type { InventoryMovementType, OrderStatus } from '../lib/format';
import type {
  ApiAddress,
  ApiBanner,
  ApiCategory,
  ApiOrder,
  ApiPaged,
  ApiProductDetail,
  ApiProductSummary,
  ApiUser,
  AdminPermission,
} from '../types/api';
import type { ProductQuery } from './catalog';
import { api } from './client';
import type { components, paths } from './generated/admin-contract';

export interface NewVariantInput {
  size: string;
  color: string;
  initialStock: number;
}

export interface ExistingVariantInput {
  id: number;
  size: string;
  color: string;
}

export type VariantInput = NewVariantInput | ExistingVariantInput;

/**
 * `variants` là ngữ nghĩa THAY THẾ khi cập nhật: danh sách gửi lên trở thành
 * bộ biến thể mới. Biến thể đã có được nhận diện bằng `id`; vắng mặt thì backend
 * xử lý xoá theo quy tắc tồn kho. Chỉ biến thể mới được nhận `initialStock`.
 */
export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  categoryId?: number;
  isActive?: boolean;
  variants?: VariantInput[];
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  categoryId: number;
  isActive?: boolean;
  variants: NewVariantInput[];
}

type AdminContractPath = Extract<keyof paths, `/admin/${string}`>;
const adminPaths = {
  stats: '/admin/stats',
  inventory: '/admin/inventory',
  inventoryItem: '/admin/inventory/{id}',
  inventoryMovements: '/admin/inventory/{id}/movements',
  products: '/admin/products',
  product: '/admin/products/{id}',
  productImages: '/admin/products/{id}/images',
  productImageOrder: '/admin/products/{id}/images/order',
  productImage: '/admin/product-images/{id}',
  categories: '/admin/categories',
  category: '/admin/categories/{id}',
  banners: '/admin/banners',
  banner: '/admin/banners/{id}',
  bannerActive: '/admin/banners/{id}/active',
  bannerImage: '/admin/banners/{id}/image',
  orders: '/admin/orders',
  order: '/admin/orders/{code}',
  orderStatus: '/admin/orders/{id}/status',
  paymentStatus: '/admin/orders/{id}/payment-status',
  users: '/admin/users',
  user: '/admin/users/{id}',
  userRole: '/admin/users/{id}/role',
  userAccess: '/admin/users/{id}/access',
  revokeSessions: '/admin/users/{id}/revoke-sessions',
  chatConversations: '/admin/chat/conversations',
  chatConversation: '/admin/chat/conversations/{id}',
  chatAccept: '/admin/chat/conversations/{id}/accept',
  chatMessages: '/admin/chat/conversations/{id}/messages',
  chatClose: '/admin/chat/conversations/{id}/close',
} as const satisfies Record<string, AdminContractPath>;

function bindPath(template: AdminContractPath, parameter: string | number): string {
  return template.replace(/\{(?:id|code)\}/, encodeURIComponent(String(parameter)));
}

type JsonResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
  Status extends number,
> = paths[Path][Method] extends { responses: infer Responses }
  ? Status extends keyof Responses
    ? Responses[Status] extends { content: { 'application/json': infer Body } }
      ? Body
      : void
    : never
  : never;

type ContractQuery<Path extends keyof paths, Method extends keyof paths[Path]> =
  paths[Path][Method] extends { parameters: { query?: infer Query } } ? Query : never;

type JsonRequestBody<Path extends keyof paths, Method extends keyof paths[Path]> =
  paths[Path][Method] extends {
    requestBody: { content: { 'application/json': infer Body } };
  }
    ? Body
    : never;

type MultipartRequestBody<Path extends keyof paths, Method extends keyof paths[Path]> =
  paths[Path][Method] extends {
    requestBody: { content: { 'multipart/form-data': infer Body } };
  }
    ? Body
    : never;

export interface CategoryInput {
  name: string;
  parentId?: number | null;
  sortOrder?: number;
}

export interface BannerInput {
  name: string;
  altText: string;
  linkUrl?: string | null;
  placement: 'HOME_HERO';
  sortOrder: number;
  isActive: boolean;
}

/** Đơn hàng phía admin có kèm thông tin người đặt. */
export interface AdminOrder extends ApiOrder {
  user: { id: number; email: string; fullName: string };
}

/** Số liệu tổng quan — mọi con số đếm thẳng từ database, không ước lượng. */
export interface AdminStats {
  revenue: {
    /** Đã giao xong = doanh thu thực nhận. */
    delivered: number;
    /** Đơn chưa huỷ và chưa giao xong. */
    inProgress: number;
    last7Days: number;
    previous7Days: number;
  };
  orders: {
    total: number;
    pending: number;
    confirmed: number;
    shipping: number;
    delivered: number;
    cancelled: number;
  };
  catalog: { products: number; activeProducts: number; categories: number; variants: number };
  stock: { units: number; low: number; out: number; threshold: number };
  customers: { total: number; newLast7Days: number };
  series: { date: string; orders: number; revenue: number }[];
  /** Bán chạy nhất theo số lượng, không tính đơn đã huỷ. */
  topProducts: { productId: number | null; name: string; quantity: number; revenue: number }[];
  recentOrders: {
    id: number;
    code: string;
    status: OrderStatus;
    total: number;
    createdAt: string;
    user: { fullName: string; email: string };
  }[];
  lowStockVariants: {
    id: number;
    size: string;
    color: string;
    stock: number;
    productId: number;
    productName: string;
    thumbUrl: string | null;
  }[];
}

/** Bản ghi khách hàng trong danh sách quản trị. */
export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'STAFF' | 'ADMIN';
  createdAt: string;
  _count: { orders: number; addresses: number };
}

export interface AdminUserDetail extends AdminUser {
  updatedAt: string;
  addresses: ApiAddress[];
  orders: { id: number; code: string; status: OrderStatus; total: number; createdAt: string }[];
  stats: { deliveredOrders: number; totalSpent: number };
}

export interface UserListQuery {
  search?: string;
  role?: 'USER' | 'STAFF' | 'ADMIN';
  sort?: 'newest' | 'orders-desc' | 'name';
  page?: number;
  limit?: number;
}

export type AdminChatConversation = components['schemas']['AdminConversation'];
export type AdminChatMessage = components['schemas']['ChatMessage'];
export type AdminChatStatus = components['schemas']['ConversationStatus'];
export type AdminChatDetailResponse = JsonResponse<'/admin/chat/conversations/{id}', 'get', 200>;
export type AdminChatMessageResponse = JsonResponse<'/admin/chat/conversations/{id}/messages', 'post', 201>;

export interface AdminChatQuery {
  status: AdminChatStatus;
  page?: number;
  limit?: number;
}

/** Bộ lọc đơn hàng phía admin — rộng hơn bản của khách. */
export interface AdminOrderQuery {
  search?: string;
  status?: OrderStatus;
  paymentStatus?: 'UNPAID' | 'PAID' | 'FAILED';
  paymentMethod?: 'COD' | 'MOMO';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Một dòng kho = một biến thể size × màu, vì tồn kho nằm ở đó. */
export interface InventoryItem {
  id: number;
  size: string;
  color: string;
  stock: number;
  updatedAt: string;
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    isActive: boolean;
    category: { id: number; name: string };
    thumbUrl: string | null;
  };
}

export interface InventoryQuery {
  search?: string;
  categoryId?: number;
  lowOnly?: boolean;
  sort?: 'stock-asc' | 'stock-desc' | 'name';
  page?: number;
  limit?: number;
}

export interface InventoryMovement {
  id: number;
  variantId: number | null;
  productNameSnapshot: string;
  sizeSnapshot: string;
  colorSnapshot: string;
  type: InventoryMovementType;
  beforeStock: number | null;
  afterStock: number;
  delta: number | null;
  orderId: number | null;
  actorType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  actorUserId: number | null;
  reason: string | null;
  operationKey: string;
  createdAt: string;
}

export interface StockAdjustmentInput {
  stock: number;
  expectedStock: number;
  reason: string;
}

const adminApi = {
  stats: () => api.get<JsonResponse<'/admin/stats', 'get', 200>>(`/api${adminPaths.stats}`),

  inventory: (query: InventoryQuery = {}) => {
    const contractQuery = {
      search: query.search,
      categoryId: query.categoryId,
      lowOnly: query.lowOnly,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    } satisfies ContractQuery<'/admin/inventory', 'get'>;
    return api.get<JsonResponse<'/admin/inventory', 'get', 200>>(`/api${adminPaths.inventory}`, {
      ...contractQuery,
      // Query string chỉ nhận chuỗi/số — bỏ hẳn cờ khi không lọc.
      ...(query.lowOnly === true ? { lowOnly: 'true' } : { lowOnly: undefined }),
    });
  },

  setStock: (variantId: number, input: StockAdjustmentInput) => {
    const body = {
      stock: input.stock,
      expectedStock: input.expectedStock,
      reason: input.reason,
    } satisfies JsonRequestBody<'/admin/inventory/{id}', 'patch'>;
    return api.patch<JsonResponse<'/admin/inventory/{id}', 'patch', 200>>(
      `/api${bindPath(adminPaths.inventoryItem, variantId)}`,
      body,
    );
  },

  inventoryMovements: (variantId: number, page = 1, limit = 20) => {
    const query = { page, limit } satisfies ContractQuery<'/admin/inventory/{id}/movements', 'get'>;
    return api.get<JsonResponse<'/admin/inventory/{id}/movements', 'get', 200>>(
      `/api${bindPath(adminPaths.inventoryMovements, variantId)}`,
      query,
    );
  },

  products: (query: ProductQuery = {}) => {
    const contractQuery = {
      search: query.search,
      categoryId: query.categoryId,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      size: query.size,
      color: query.color,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    } satisfies ContractQuery<'/admin/products', 'get'>;
    return api.get<JsonResponse<'/admin/products', 'get', 200>>(`/api${adminPaths.products}`, contractQuery);
  },

  product: (id: number) => api.get<JsonResponse<'/admin/products/{id}', 'get', 200>>(`/api${bindPath(adminPaths.product, id)}`),

  createProduct: (input: CreateProductInput) => {
    const body = {
      name: input.name,
      description: input.description,
      price: input.price,
      categoryId: input.categoryId,
      isActive: input.isActive,
      variants: input.variants.map((variant) => ({
        size: variant.size,
        color: variant.color,
        initialStock: variant.initialStock,
      })),
    } satisfies JsonRequestBody<'/admin/products', 'post'>;
    return api.post<JsonResponse<'/admin/products', 'post', 201>>(`/api${adminPaths.products}`, body);
  },

  updateProduct: (id: number, input: UpdateProductInput) => {
    const body = {
      name: input.name,
      description: input.description,
      price: input.price,
      categoryId: input.categoryId,
      isActive: input.isActive,
      variants: input.variants?.map((variant) =>
        'id' in variant
          ? { id: variant.id, size: variant.size, color: variant.color }
          : { size: variant.size, color: variant.color, initialStock: variant.initialStock },
      ),
    } satisfies JsonRequestBody<'/admin/products/{id}', 'patch'>;
    return api.patch<JsonResponse<'/admin/products/{id}', 'patch', 200>>(
      `/api${bindPath(adminPaths.product, id)}`,
      body,
    );
  },

  removeProduct: (id: number) => api.delete<void>(`/api${bindPath(adminPaths.product, id)}`),

  uploadImages: (id: number, files: File[]) => {
    const form = new FormData();
    const multipartContract = {
      images: files.map((file) => file.name),
    } satisfies MultipartRequestBody<'/admin/products/{id}/images', 'post'>;
    const imageField: keyof typeof multipartContract = 'images';
    for (const file of files) form.append(imageField, file);
    return api.post<JsonResponse<'/admin/products/{id}/images', 'post', 201>>(`/api${bindPath(adminPaths.productImages, id)}`, form);
  },

  removeImage: (imageId: number) => api.delete<void>(`/api${bindPath(adminPaths.productImage, imageId)}`),

  /** Thứ tự mới của TOÀN BỘ ảnh; phần tử đầu tiên thành ảnh bìa. */
  reorderImages: (productId: number, imageIds: number[]) => {
    const body = { imageIds } satisfies JsonRequestBody<'/admin/products/{id}/images/order', 'patch'>;
    return api.patch<JsonResponse<'/admin/products/{id}/images/order', 'patch', 200>>(
      `/api${bindPath(adminPaths.productImageOrder, productId)}`,
      body,
    );
  },

  categories: () => api.get<JsonResponse<'/admin/categories', 'get', 200>>(`/api${adminPaths.categories}`),

  createCategory: (input: CategoryInput) => {
    const body = {
      name: input.name,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
    } satisfies JsonRequestBody<'/admin/categories', 'post'>;
    return api.post<JsonResponse<'/admin/categories', 'post', 201>>(`/api${adminPaths.categories}`, body);
  },

  updateCategory: (id: number, input: Partial<CategoryInput>) => {
    const body = {
      name: input.name,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
    } satisfies JsonRequestBody<'/admin/categories/{id}', 'patch'>;
    return api.patch<JsonResponse<'/admin/categories/{id}', 'patch', 200>>(
      `/api${bindPath(adminPaths.category, id)}`,
      body,
    );
  },

  removeCategory: (id: number) => api.delete<void>(`/api${bindPath(adminPaths.category, id)}`),

  banners: () => api.get<JsonResponse<'/admin/banners', 'get', 200>>(`/api${adminPaths.banners}`),

  createBanner: (input: BannerInput, file: File) => {
    const form = new FormData();
    const body = { ...input, image: file.name } satisfies MultipartRequestBody<'/admin/banners', 'post'>;
    for (const [key, value] of Object.entries(body)) form.append(key, key === 'image' ? file : String(value ?? ''));
    return api.post<JsonResponse<'/admin/banners', 'post', 201>>(`/api${adminPaths.banners}`, form);
  },

  updateBanner: (id: number, input: BannerInput) =>
    api.patch<JsonResponse<'/admin/banners/{id}', 'patch', 200>>(
      `/api${bindPath(adminPaths.banner, id)}`,
      input satisfies JsonRequestBody<'/admin/banners/{id}', 'patch'>,
    ),

  setBannerActive: (id: number, isActive: boolean) =>
    api.patch<JsonResponse<'/admin/banners/{id}/active', 'patch', 200>>(
      `/api${bindPath(adminPaths.bannerActive, id)}`,
      { isActive } satisfies JsonRequestBody<'/admin/banners/{id}/active', 'patch'>,
    ),

  replaceBannerImage: (id: number, file: File) => {
    const form = new FormData();
    const body = { image: file.name } satisfies MultipartRequestBody<'/admin/banners/{id}/image', 'post'>;
    form.append('image', file);
    return api.post<JsonResponse<'/admin/banners/{id}/image', 'post', 200>>(`/api${bindPath(adminPaths.bannerImage, id)}`, form);
  },

  orders: (query: AdminOrderQuery = {}) => {
    const contractQuery = {
      search: query.search,
      status: query.status,
      paymentStatus: query.paymentStatus,
      paymentMethod: query.paymentMethod,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    } satisfies ContractQuery<'/admin/orders', 'get'>;
    return api.get<JsonResponse<'/admin/orders', 'get', 200>>(`/api${adminPaths.orders}`, contractQuery);
  },

  order: (code: string) =>
    api.get<JsonResponse<'/admin/orders/{code}', 'get', 200>>(`/api${bindPath(adminPaths.order, code)}`),

  setOrderStatus: (id: number, status: OrderStatus) => {
    const body = { status } satisfies JsonRequestBody<'/admin/orders/{id}/status', 'patch'>;
    return api.patch<JsonResponse<'/admin/orders/{id}/status', 'patch', 200>>(`/api${bindPath(adminPaths.orderStatus, id)}`, body);
  },

  setPaymentStatus: (id: number, paymentStatus: 'UNPAID' | 'PAID' | 'FAILED') => {
    const body = { paymentStatus } satisfies JsonRequestBody<'/admin/orders/{id}/payment-status', 'patch'>;
    return api.patch<JsonResponse<'/admin/orders/{id}/payment-status', 'patch', 200>>(`/api${bindPath(adminPaths.paymentStatus, id)}`, body);
  },

  users: (query: UserListQuery = {}) => {
    const contractQuery = {
      search: query.search,
      role: query.role,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    } satisfies ContractQuery<'/admin/users', 'get'>;
    return api.get<JsonResponse<'/admin/users', 'get', 200>>(`/api${adminPaths.users}`, contractQuery);
  },

  user: (id: number) => api.get<JsonResponse<'/admin/users/{id}', 'get', 200>>(`/api${bindPath(adminPaths.user, id)}`),

  setUserRole: (id: number, role: 'USER' | 'ADMIN') => {
    const body = { role } satisfies JsonRequestBody<'/admin/users/{id}/role', 'patch'>;
    return api.patch<JsonResponse<'/admin/users/{id}/role', 'patch', 200>>(`/api${bindPath(adminPaths.userRole, id)}`, body);
  },

  userAccess: (id: number) =>
    api.get<JsonResponse<'/admin/users/{id}/access', 'get', 200>>(
      `/api${bindPath(adminPaths.userAccess, id)}`,
    ),

  setUserAccess: (id: number, input: { role: 'USER' | 'STAFF'; permissions: AdminPermission[] }) => {
    const body = input satisfies JsonRequestBody<'/admin/users/{id}/access', 'patch'>;
    return api.patch<JsonResponse<'/admin/users/{id}/access', 'patch', 200>>(
      `/api${bindPath(adminPaths.userAccess, id)}`,
      body,
    );
  },

  revokeSessions: (id: number) =>
    api.post<JsonResponse<'/admin/users/{id}/revoke-sessions', 'post', 200>>(`/api${bindPath(adminPaths.revokeSessions, id)}`),

  chatConversations: (query: AdminChatQuery) => {
    const contractQuery = {
      status: query.status,
      page: query.page,
      limit: query.limit,
    } satisfies ContractQuery<'/admin/chat/conversations', 'get'>;
    return api.get<JsonResponse<'/admin/chat/conversations', 'get', 200>>(
      `/api${adminPaths.chatConversations}`,
      contractQuery,
    );
  },

  chatConversation: (conversationId: number, page = 1, limit = 100) => {
    const contractQuery = { page, limit } satisfies ContractQuery<'/admin/chat/conversations/{id}', 'get'>;
    return api.get<JsonResponse<'/admin/chat/conversations/{id}', 'get', 200>>(
      `/api${bindPath(adminPaths.chatConversation, conversationId)}`,
      contractQuery,
    );
  },

  acceptChatConversation: (conversationId: number) =>
    api.post<JsonResponse<'/admin/chat/conversations/{id}/accept', 'post', 200>>(
      `/api${bindPath(adminPaths.chatAccept, conversationId)}`,
    ),

  sendChatMessage: (conversationId: number, content: string) => {
    const body = { content } satisfies JsonRequestBody<'/admin/chat/conversations/{id}/messages', 'post'>;
    return api.post<JsonResponse<'/admin/chat/conversations/{id}/messages', 'post', 201>>(
      `/api${bindPath(adminPaths.chatMessages, conversationId)}`,
      body,
    );
  },

  closeChatConversation: (conversationId: number) =>
    api.post<JsonResponse<'/admin/chat/conversations/{id}/close', 'post', 200>>(
      `/api${bindPath(adminPaths.chatClose, conversationId)}`,
    ),
};

interface AdminGateway {
  dashboard: { stats(): Promise<AdminStats> };
  inventory: {
    list(query?: InventoryQuery): Promise<ApiPaged<InventoryItem> & { threshold: number }>;
    setStock(variantId: number, input: StockAdjustmentInput): Promise<{ variant: { id: number; stock: number }; movement: InventoryMovement }>;
    movements(variantId: number, page?: number, limit?: number): Promise<ApiPaged<InventoryMovement>>;
  };
  products: {
    list(query?: ProductQuery): Promise<ApiPaged<ApiProductSummary>>;
    detail(id: number): Promise<{ product: ApiProductDetail }>;
    create(input: CreateProductInput): Promise<{ product: ApiProductDetail }>;
    update(id: number, input: UpdateProductInput): Promise<{ product: ApiProductDetail }>;
    remove(id: number): Promise<void>;
    uploadImages(id: number, files: File[]): Promise<{ product: ApiProductDetail }>;
    removeImage(imageId: number): Promise<void>;
    reorderImages(productId: number, imageIds: number[]): Promise<{ product: ApiProductDetail }>;
  };
  categories: {
    list(): Promise<{ categories: ApiCategory[] }>;
    create(input: CategoryInput): Promise<{ category: ApiCategory }>;
    update(id: number, input: Partial<CategoryInput>): Promise<{ category: ApiCategory }>;
    remove(id: number): Promise<void>;
  };
  banners: {
    list(): Promise<{ banners: ApiBanner[] }>;
    create(input: BannerInput, file: File): Promise<{ banner: ApiBanner }>;
    update(id: number, input: BannerInput): Promise<{ banner: ApiBanner }>;
    setActive(id: number, isActive: boolean): Promise<{ banner: ApiBanner }>;
    replaceImage(id: number, file: File): Promise<{ banner: ApiBanner }>;
  };
  orders: {
    list(query?: AdminOrderQuery): Promise<ApiPaged<AdminOrder>>;
    detail(code: string): Promise<{ order: AdminOrder }>;
    setStatus(id: number, status: OrderStatus): Promise<{ order: ApiOrder; replayed?: boolean }>;
    setPaymentStatus(id: number, paymentStatus: 'UNPAID' | 'PAID' | 'FAILED'): Promise<{ order: AdminOrder }>;
  };
  users: {
    list(query?: UserListQuery): Promise<ApiPaged<AdminUser>>;
    detail(id: number): Promise<{ user: AdminUserDetail }>;
    setRole(id: number, role: 'USER' | 'ADMIN'): Promise<{ user: AdminUser }>;
    access(id: number): Promise<JsonResponse<'/admin/users/{id}/access', 'get', 200>>;
    setAccess(id: number, input: { role: 'USER' | 'STAFF'; permissions: AdminPermission[] }): Promise<JsonResponse<'/admin/users/{id}/access', 'patch', 200>>;
    revokeSessions(id: number): Promise<{ revoked: number }>;
  };
  chat: {
    list(query: AdminChatQuery): Promise<JsonResponse<'/admin/chat/conversations', 'get', 200>>;
    detail(conversationId: number, page?: number, limit?: number): Promise<AdminChatDetailResponse>;
    accept(conversationId: number): Promise<JsonResponse<'/admin/chat/conversations/{id}/accept', 'post', 200>>;
    send(conversationId: number, content: string): Promise<AdminChatMessageResponse>;
    close(conversationId: number): Promise<JsonResponse<'/admin/chat/conversations/{id}/close', 'post', 200>>;
  };
}

export const adminGateway: AdminGateway = {
  dashboard: { stats: adminApi.stats },
  inventory: { list: adminApi.inventory, setStock: adminApi.setStock, movements: adminApi.inventoryMovements },
  products: {
    list: adminApi.products,
    detail: adminApi.product,
    create: adminApi.createProduct,
    update: adminApi.updateProduct,
    remove: adminApi.removeProduct,
    uploadImages: adminApi.uploadImages,
    removeImage: adminApi.removeImage,
    reorderImages: adminApi.reorderImages,
  },
  categories: { list: adminApi.categories, create: adminApi.createCategory, update: adminApi.updateCategory, remove: adminApi.removeCategory },
  banners: { list: adminApi.banners, create: adminApi.createBanner, update: adminApi.updateBanner, setActive: adminApi.setBannerActive, replaceImage: adminApi.replaceBannerImage },
  orders: { list: adminApi.orders, detail: adminApi.order, setStatus: adminApi.setOrderStatus, setPaymentStatus: adminApi.setPaymentStatus },
  users: { list: adminApi.users, detail: adminApi.user, setRole: adminApi.setUserRole, access: adminApi.userAccess, setAccess: adminApi.setUserAccess, revokeSessions: adminApi.revokeSessions },
  chat: {
    list: adminApi.chatConversations,
    detail: adminApi.chatConversation,
    accept: adminApi.acceptChatConversation,
    send: adminApi.sendChatMessage,
    close: adminApi.closeChatConversation,
  },
} as const;

export { ApiError } from './client';

export type { ApiUser };
