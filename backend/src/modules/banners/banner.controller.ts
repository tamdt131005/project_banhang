import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import { AppError } from '../../middleware/error.js';
import {
  bannerActiveSchema,
  bannerCreateSchema,
  bannerQuerySchema,
  bannerUpdateSchema,
} from './banner.schema.js';
import * as bannerService from './banner.service.js';

function uploadedImage(req: Parameters<RequestHandler>[0]) {
  if (!req.file) throw AppError.badRequest('IMAGE_REQUIRED', 'Vui lòng chọn ảnh banner.');
  return req.file;
}

export const listHandler: RequestHandler = async (req, res) => {
  const { placement } = bannerQuerySchema.parse(req.query);
  res.json({ banners: await bannerService.listActiveBanners(placement) });
};

export const adminListHandler: RequestHandler = async (_req, res) => {
  res.json({ banners: await bannerService.listAdminBanners() });
};

export const createHandler: RequestHandler = async (req, res) => {
  const input = bannerCreateSchema.parse(req.body);
  const banner = await bannerService.createBanner(input, uploadedImage(req));
  res.status(201).json({ banner });
};

export const updateHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = bannerUpdateSchema.parse(req.body);
  res.json({ banner: await bannerService.updateBanner(id, input) });
};

export const activeHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { isActive } = bannerActiveSchema.parse(req.body);
  res.json({ banner: await bannerService.setBannerActive(id, isActive) });
};

export const replaceImageHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ banner: await bannerService.replaceBannerImage(id, uploadedImage(req)) });
};
