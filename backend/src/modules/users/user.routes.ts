import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import {
  detailHandler,
  listHandler,
  revokeSessionsHandler,
  updateRoleHandler,
} from './user.controller.js';

/** /api/admin/users — hồ sơ khách hàng và phân quyền. */
export const adminUserRouter = Router();
adminUserRouter.use(requireAuth, requireAdmin);

adminUserRouter.get('/', listHandler);
adminUserRouter.get('/:id', detailHandler);
adminUserRouter.patch('/:id/role', updateRoleHandler);
adminUserRouter.post('/:id/revoke-sessions', revokeSessionsHandler);
