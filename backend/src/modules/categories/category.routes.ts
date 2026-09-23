import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  createHandler,
  removeHandler,
  treeHandler,
  updateHandler,
} from './category.controller.js';

/** GET /api/categories — công khai, dùng cho thanh lọc của cửa hàng. */
export const categoryRouter = Router();
categoryRouter.get('/', treeHandler);

/** /api/admin/categories — chỉ quản trị viên. */
export const adminCategoryRouter = Router();
adminCategoryRouter.use(requireAuth, requirePermission('CATALOG'));
adminCategoryRouter.get('/', treeHandler);
adminCategoryRouter.post('/', createHandler);
adminCategoryRouter.patch('/:id', updateHandler);
adminCategoryRouter.delete('/:id', removeHandler);
