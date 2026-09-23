import { Router } from 'express';
import { requireAdmin, requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  detailHandler,
  createStaffHandler,
  listHandler,
  revokeSessionsHandler,
  staffAccessHandler,
  updateRoleHandler,
  updateStaffAccessHandler,
} from './user.controller.js';

/** /api/admin/users — hồ sơ khách hàng và phân quyền. */
export const adminUserRouter = Router();
adminUserRouter.use(requireAuth);

adminUserRouter.get('/', requirePermission('CUSTOMERS'), listHandler);
adminUserRouter.post('/staff', requireAdmin, createStaffHandler);
adminUserRouter.get('/:id', requirePermission('CUSTOMERS'), detailHandler);
adminUserRouter.get('/:id/access', requireAdmin, staffAccessHandler);
adminUserRouter.patch('/:id/access', requireAdmin, updateStaffAccessHandler);
adminUserRouter.patch('/:id/role', requireAdmin, updateRoleHandler);
adminUserRouter.post('/:id/revoke-sessions', requireAdmin, revokeSessionsHandler);
