import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { uploadProductImages } from '../../middleware/upload.js';
import {
  adminDetailHandler,
  adminListHandler,
  createHandler,
  detailHandler,
  filterOptionsHandler,
  listHandler,
  removeHandler,
  removeImageHandler,
  reorderImagesHandler,
  updateHandler,
  uploadImagesHandler,
} from './product.controller.js';

/** /api/products — công khai. */
export const productRouter = Router();
productRouter.get('/', listHandler);
// Phải đứng TRƯỚC /:slug, nếu không "filter-options" bị hiểu là slug sản phẩm.
productRouter.get('/filter-options', filterOptionsHandler);
productRouter.get('/:slug', detailHandler);

/** /api/admin/products — chỉ quản trị viên. */
export const adminProductRouter = Router();
adminProductRouter.use(requireAuth, requireAdmin);
adminProductRouter.get('/', adminListHandler);
adminProductRouter.get('/:id', adminDetailHandler);
adminProductRouter.post('/', createHandler);
adminProductRouter.patch('/:id', updateHandler);
adminProductRouter.delete('/:id', removeHandler);
// uploadLimiter đặt sau requireAuth (ở router.use trên) nên đếm được theo userId.
adminProductRouter.post('/:id/images', uploadLimiter, uploadProductImages, uploadImagesHandler);
// Đổi thứ tự ảnh — ảnh đầu danh sách là ảnh bìa của sản phẩm.
adminProductRouter.patch('/:id/images/order', reorderImagesHandler);

/** /api/admin/product-images/:id */
export const adminProductImageRouter = Router();
adminProductImageRouter.use(requireAuth, requireAdmin);
adminProductImageRouter.delete('/:id', removeImageHandler);
