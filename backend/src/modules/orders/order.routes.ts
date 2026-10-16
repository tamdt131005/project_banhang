import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { orderLimiter } from '../../middleware/rateLimit.js';
import {
  adminDetailHandler,
  adminListHandler,
  adminUpdatePaymentHandler,
  adminUpdateStatusHandler,
  cancelHandler,
  createHandler,
  detailMineHandler,
  listMineHandler,
  momoIpnHandler,
  momoPayHandler,
  momoVerifyHandler,
} from './order.controller.js';

/** /api/orders — đơn của chính người đang đăng nhập. */
export const orderRouter = Router();
orderRouter.use(requireAuth);
orderRouter.get('/', listMineHandler);
// orderLimiter nằm sau requireAuth nên đếm được theo userId.
orderRouter.post('/', orderLimiter, createHandler);
orderRouter.get('/:code', detailMineHandler);
orderRouter.post('/:code/cancel', cancelHandler);
orderRouter.post('/:code/momo', momoPayHandler);
orderRouter.post('/:code/momo/verify', momoVerifyHandler);

/** /api/payments — cổng thanh toán gọi về, không có phiên đăng nhập. */
export const paymentRouter = Router();
paymentRouter.post('/momo/ipn', momoIpnHandler);

/** /api/admin/orders */
export const adminOrderRouter = Router();
adminOrderRouter.use(requireAuth, requirePermission('ORDERS'));
adminOrderRouter.get('/', adminListHandler);
adminOrderRouter.get('/:code', adminDetailHandler);
adminOrderRouter.patch('/:id/status', adminUpdateStatusHandler);
adminOrderRouter.patch('/:id/payment-status', adminUpdatePaymentHandler);
