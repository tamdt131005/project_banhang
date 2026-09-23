import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  inventoryHandler,
  inventoryMovementsHandler,
  statsHandler,
  updateStockHandler,
} from './admin.controller.js';

/** /api/admin — số liệu tổng quan và quản lý kho. */
export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.get('/stats', requirePermission('DASHBOARD'), statsHandler);
adminRouter.get('/inventory', requirePermission('INVENTORY'), inventoryHandler);
adminRouter.get('/inventory/:id/movements', requirePermission('INVENTORY'), inventoryMovementsHandler);
adminRouter.patch('/inventory/:id', requirePermission('INVENTORY'), updateStockHandler);
