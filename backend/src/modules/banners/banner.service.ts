import type { BannerPlacement } from '@prisma/client';
import { deleteUploadedFile, storeBannerImage } from '../../lib/image.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { BannerCreateInput, BannerUpdateInput } from './banner.schema.js';

const ORDER = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

export function listActiveBanners(placement: BannerPlacement) {
  return prisma.banner.findMany({ where: { placement, isActive: true }, orderBy: ORDER });
}

export function listAdminBanners() {
  return prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, ...ORDER] });
}

export async function createBanner(input: BannerCreateInput, image: Express.Multer.File) {
  const imageUrl = await storeBannerImage(image.buffer);
  try {
    return await prisma.banner.create({ data: { ...input, linkUrl: input.linkUrl ?? null, imageUrl } });
  } catch (error) {
    await deleteUploadedFile(imageUrl).catch(() => undefined);
    throw error;
  }
}

export async function updateBanner(id: number, input: BannerUpdateInput) {
  await requireBanner(id);
  return prisma.banner.update({ where: { id }, data: input });
}

export async function setBannerActive(id: number, isActive: boolean) {
  await requireBanner(id);
  return prisma.banner.update({ where: { id }, data: { isActive } });
}

export async function replaceBannerImage(id: number, image: Express.Multer.File) {
  const existing = await requireBanner(id);
  const imageUrl = await storeBannerImage(image.buffer);
  let banner;
  try {
    banner = await prisma.banner.update({ where: { id }, data: { imageUrl } });
  } catch (error) {
    await deleteUploadedFile(imageUrl).catch(() => undefined);
    throw error;
  }

  // Chỉ xoá ảnh cũ sau khi đường dẫn mới đã commit thành công.
  await deleteUploadedFile(existing.imageUrl).catch((error: unknown) => {
    console.error('[banner] không xoá được ảnh cũ:', error);
  });
  return banner;
}

async function requireBanner(id: number) {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw AppError.notFound('Không tìm thấy banner.');
  return banner;
}
