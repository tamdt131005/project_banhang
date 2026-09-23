import type { Role, StaffPermission } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { StaffPermissionKey } from './permission.constants.js';

export async function getUserRole(userId: number): Promise<Role | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}

export async function listUserPermissions(userId: number): Promise<StaffPermission[]> {
  const rows = await prisma.userStaffPermission.findMany({
    where: { userId },
    orderBy: { permission: 'asc' },
    select: { permission: true },
  });
  return rows.map((row) => row.permission);
}

export async function userHasPermission(
  userId: number,
  permission: StaffPermissionKey,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      staffPermissions: { where: { permission }, select: { id: true }, take: 1 },
    },
  });

  if (!user) return false;
  return user.role === 'ADMIN' || (user.role === 'STAFF' && user.staffPermissions.length > 0);
}

export async function hasAdminAccess(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, staffPermissions: { select: { id: true }, take: 1 } },
  });
  return Boolean(user && (user.role === 'ADMIN' || (user.role === 'STAFF' && user.staffPermissions.length > 0)));
}

export async function getStaffAccess(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, staffPermissions: { select: { permission: true } } },
  });
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    permissions: user.staffPermissions.map((item) => item.permission),
  };
}
