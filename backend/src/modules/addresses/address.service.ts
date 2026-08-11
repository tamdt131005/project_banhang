import type { Address } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { AddressCreateInput, AddressUpdateInput } from './address.schema.js';

/**
 * Trả 404 chứ không phải 403 khi địa chỉ thuộc về người khác: người dùng
 * không cần biết mã đó có tồn tại hay không.
 */
async function findOwned(userId: number, id: number): Promise<Address> {
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== userId) {
    throw AppError.notFound('Không tìm thấy địa chỉ này.');
  }
  return address;
}

export function listAddresses(userId: number) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createAddress(userId: number, input: AddressCreateInput) {
  const { isDefault, ...fields } = input;

  // Địa chỉ đầu tiên luôn là mặc định, nếu không khách sẽ không chọn được gì
  // ở màn thanh toán.
  const existing = await prisma.address.count({ where: { userId } });
  const makeDefault = isDefault === true || existing === 0;

  return prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({ data: { ...fields, userId, isDefault: makeDefault } });
  });
}

export async function updateAddress(userId: number, id: number, input: AddressUpdateInput) {
  await findOwned(userId, id);
  return prisma.address.update({ where: { id }, data: input });
}

export async function setDefaultAddress(userId: number, id: number) {
  await findOwned(userId, id);

  return prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    return tx.address.update({ where: { id }, data: { isDefault: true } });
  });
}

export async function removeAddress(userId: number, id: number) {
  const address = await findOwned(userId, id);

  await prisma.address.delete({ where: { id } });

  // Vừa xoá địa chỉ mặc định thì nâng địa chỉ mới nhất còn lại lên thay thế,
  // để tài khoản không rơi vào trạng thái có địa chỉ nhưng không có mặc định.
  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}
