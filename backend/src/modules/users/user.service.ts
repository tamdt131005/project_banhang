import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { StaffAccessInput, RoleUpdateInput, UserListQuery } from './user.schema.js';
import { getStaffAccess as readStaffAccess } from '../permissions/permission.service.js';

/** Không bao giờ chọn passwordHash — nó không được rời khỏi tầng dữ liệu. */
const listSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  _count: { select: { orders: true, addresses: true } },
} satisfies Prisma.UserSelect;

export async function listUsers(query: UserListQuery) {
  const where: Prisma.UserWhereInput = {};

  if (query.role !== undefined) where.role = query.role;

  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search } },
      { email: { contains: query.search } },
      { phone: { contains: query.search } },
    ];
  }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    query.sort === 'name'
      ? { fullName: 'asc' }
      : query.sort === 'orders-desc'
        ? { orders: { _count: 'desc' } }
        : { createdAt: 'desc' };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: listSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/**
 * Hồ sơ đầy đủ một khách: thông tin tài khoản, sổ địa chỉ và lịch sử mua.
 * Gom vào một request để trang chi tiết không phải gọi ba lần.
 */
export async function getUserDetail(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...listSelect,
      updatedAt: true,
      addresses: { orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, code: true, status: true, total: true, createdAt: true },
      },
    },
  });

  if (!user) throw AppError.notFound('Không tìm thấy tài khoản này.');

  // Tổng chi tiêu chỉ tính đơn ĐÃ GIAO — đơn đang chạy hoặc đã huỷ chưa phải
  // tiền thật, gộp vào sẽ thổi phồng giá trị khách hàng.
  const spent = await prisma.order.aggregate({
    where: { userId, status: 'DELIVERED' },
    _sum: { total: true },
    _count: { _all: true },
  });

  return {
    ...user,
    stats: {
      deliveredOrders: spent._count._all,
      totalSpent: spent._sum.total ?? 0,
    },
  };
}

/**
 * Đổi quyền một tài khoản.
 *
 * Hai chốt chặn tự khoá cửa: không cho admin tự hạ quyền chính mình (mất
 * quyền ngay giữa chừng), và không cho hạ quyền admin cuối cùng (cả hệ thống
 * không còn ai vào được trang quản trị).
 */
export async function updateUserRole(
  actorId: number,
  targetId: number,
  input: RoleUpdateInput,
) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) throw AppError.notFound('Không tìm thấy tài khoản này.');

  if (target.role === input.role) {
    throw AppError.conflict('ROLE_UNCHANGED', 'Tài khoản đã ở quyền này rồi.');
  }

  if (target.role === 'ADMIN' && input.role === 'USER') {
    if (targetId === actorId) {
      throw AppError.badRequest(
        'CANNOT_DEMOTE_SELF',
        'Không thể tự hạ quyền chính mình. Nhờ một quản trị viên khác thực hiện.',
      );
    }

    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (admins <= 1) {
      throw AppError.conflict(
        'LAST_ADMIN',
        'Đây là quản trị viên cuối cùng — hạ quyền sẽ không còn ai quản trị được.',
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: targetId },
      data: { role: input.role },
      select: listSelect,
    });
    await tx.userStaffPermission.deleteMany({ where: { userId: targetId } });
    await tx.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return user;
  });
}

export async function getStaffAccess(userId: number) {
  const access = await readStaffAccess(userId);
  if (!access) throw AppError.notFound('Không tìm thấy tài khoản này.');
  if (access.role === 'ADMIN') {
    throw AppError.conflict('ADMIN_ACCESS_LOCKED', 'Không thể chỉnh quyền của quản trị viên cấp cao.');
  }
  return access;
}

export async function updateStaffAccess(
  actorId: number,
  targetId: number,
  input: StaffAccessInput,
) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) throw AppError.notFound('Không tìm thấy tài khoản này.');
  if (target.role === 'ADMIN') {
    throw AppError.conflict('ADMIN_ACCESS_LOCKED', 'Không thể chỉnh quyền của quản trị viên cấp cao.');
  }
  if (targetId === actorId) {
    throw AppError.badRequest('CANNOT_EDIT_SELF', 'Không thể tự chỉnh quyền của chính mình.');
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetId }, data: { role: input.role } });
    await tx.userStaffPermission.deleteMany({ where: { userId: targetId } });
    if (input.role === 'STAFF') {
      await tx.userStaffPermission.createMany({
        data: input.permissions.map((permission) => ({
          userId: targetId,
          permission,
          grantedById: actorId,
        })),
      });
    }
    await tx.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { id: true, role: true, staffPermissions: { select: { permission: true } } },
    });
  });

  return {
    id: result.id,
    role: result.role,
    permissions: result.staffPermissions.map((item) => item.permission),
  };
}

/** Buộc đăng xuất mọi thiết bị của một tài khoản (nghi bị lộ mật khẩu). */
export async function revokeUserSessions(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw AppError.notFound('Không tìm thấy tài khoản này.');

  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { revoked: result.count };
}
