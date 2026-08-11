import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();

/** `request.agent` giữ cookie giữa các lần gọi, đúng như trình duyệt. */
export type Agent = ReturnType<typeof request.agent>;

export const CUSTOMER = { email: 'khach@test.local', password: 'MatKhau@123' };
export const ADMIN = { email: 'admin@test.local', password: 'Admin@12345' };

export async function createUser(options: {
  email: string;
  password: string;
  role?: 'USER' | 'ADMIN';
  fullName?: string;
}) {
  return prisma.user.create({
    data: {
      email: options.email,
      passwordHash: await hashPassword(options.password),
      fullName: options.fullName ?? 'Người dùng thử',
      role: options.role ?? 'USER',
      cart: { create: {} },
    },
  });
}

export async function loginAs(email: string, password: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}

/** Tạo sẵn một khách và một admin, trả về agent đã đăng nhập của cả hai. */
export async function seedUsers() {
  await createUser({ ...CUSTOMER, fullName: 'Khách thử' });
  await createUser({ ...ADMIN, role: 'ADMIN', fullName: 'Quản trị thử' });

  return {
    customer: await loginAs(CUSTOMER.email, CUSTOMER.password),
    admin: await loginAs(ADMIN.email, ADMIN.password),
  };
}

export async function seedCategory(name = 'Danh mục thử', parentId?: number) {
  return prisma.category.create({
    data: {
      name,
      slug: `dm-${Math.random().toString(36).slice(2, 10)}`,
      ...(parentId === undefined ? {} : { parentId }),
    },
  });
}

/**
 * Tạo sản phẩm kèm MỘT biến thể mặc định (M, Đen) — tồn kho nằm trên biến thể.
 * Trả về sản phẩm cùng `variant` để test thao tác giỏ/đơn theo variantId.
 */
export async function seedProduct(options: {
  categoryId: number;
  name?: string;
  slug?: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
  size?: string;
  color?: string;
}) {
  const product = await prisma.product.create({
    data: {
      name: options.name ?? 'Sản phẩm thử',
      slug: options.slug ?? `sp-${Math.random().toString(36).slice(2, 10)}`,
      description: 'Mô tả dùng cho kiểm thử.',
      price: options.price ?? 100_000,
      categoryId: options.categoryId,
      isActive: options.isActive ?? true,
      variants: {
        create: [
          {
            size: options.size ?? 'M',
            color: options.color ?? 'Đen',
            stock: options.stock ?? 10,
          },
        ],
      },
    },
    include: { variants: true },
  });

  return { ...product, variant: product.variants[0]! };
}

/** Thêm một biến thể nữa cho sản phẩm có sẵn. */
export function addVariant(
  productId: number,
  options: { size: string; color?: string; stock?: number },
) {
  return prisma.productVariant.create({
    data: {
      productId,
      size: options.size,
      color: options.color ?? 'Đen',
      stock: options.stock ?? 10,
    },
  });
}

export async function seedAddress(userId: number) {
  return prisma.address.create({
    data: {
      userId,
      fullName: 'Người nhận thử',
      phone: '0901234567',
      line1: '1 Đường Thử',
      ward: 'Phường Thử',
      district: 'Quận Thử',
      province: 'Thành phố Thử',
      isDefault: true,
    },
  });
}

export function userIdByEmail(email: string) {
  return prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
}
