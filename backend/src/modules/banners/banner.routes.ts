import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { uploadBannerImage } from '../../middleware/upload.js';
import {
  activeHandler,
  adminListHandler,
  createHandler,
  listHandler,
  replaceImageHandler,
  updateHandler,
} from './banner.controller.js';

export const bannerRouter = Router();
bannerRouter.get('/', listHandler);

export const adminBannerRouter = Router();
adminBannerRouter.use(requireAuth, requirePermission('BANNERS'));
adminBannerRouter.get('/', adminListHandler);
adminBannerRouter.post('/', uploadLimiter, uploadBannerImage, createHandler);
adminBannerRouter.patch('/:id', updateHandler);
adminBannerRouter.patch('/:id/active', activeHandler);
adminBannerRouter.post('/:id/image', uploadLimiter, uploadBannerImage, replaceImageHandler);
