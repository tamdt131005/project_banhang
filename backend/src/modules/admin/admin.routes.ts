import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import {
  inventoryHandler,
  inventoryMovementsHandler,
  statsHandler,
  updateStockHandler,
} from './admin.controller.js';

/** /api/admin — số liệu tổng quan và quản lý kho. */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', statsHandler);
adminRouter.get('/inventory', inventoryHandler);
adminRouter.get('/inventory/:id/movements', inventoryMovementsHandler);
adminRouter.patch('/inventory/:id', updateStockHandler);
