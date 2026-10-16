import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import { AppError } from '../../middleware/error.js';
import { verifyMomoIpn } from '../../payments/momo.js';
import {
  ADMIN_CANCEL_REASON_LABEL,
  CUSTOMER_CANCEL_REASON_LABEL,
  adminOrderListQuerySchema,
  customerCancelSchema,
  momoIpnSchema,
  momoVerifySchema,
  orderCodeParamSchema,
  orderCreateSchema,
  orderListQuerySchema,
  orderStatusSchema,
  paymentStatusSchema,
  resolveCancelReason,
} from './order.schema.js';
import * as orderService from './order.service.js';

export const createHandler: RequestHandler = async (req, res) => {
  const input = orderCreateSchema.parse(req.body);
  const result = await orderService.createOrder(req.user!.id, input);
  res.status(201).json(result);
};

export const momoPayHandler: RequestHandler = async (req, res) => {
  const { code } = orderCodeParamSchema.parse(req.params);
  const result = await orderService.startMomoPayment(req.user!.id, code);
  res.json(result);
};

export const momoVerifyHandler: RequestHandler = async (req, res) => {
  const { code } = orderCodeParamSchema.parse(req.params);
  const { momoOrderId } = momoVerifySchema.parse(req.body);
  const result = await orderService.verifyMomoPayment(req.user!.id, code, momoOrderId);
  res.json(result);
};

/** MoMo gọi server-to-server; không có phiên đăng nhập, chỉ tin chữ ký. */
export const momoIpnHandler: RequestHandler = async (req, res) => {
  const payload = momoIpnSchema.parse(req.body);
  if (!verifyMomoIpn(payload)) {
    throw AppError.badRequest('INVALID_SIGNATURE', 'Chữ ký MoMo không hợp lệ.');
  }

  await orderService.applyMomoResult({
    partnerCode: payload.partnerCode,
    orderId: payload.orderId,
    amount: Number(payload.amount),
    resultCode: Number(payload.resultCode),
    message: payload.message,
  });
  // MoMo chỉ cần biết đã nhận; 204 theo hướng dẫn IPN.
  res.status(204).end();
};

export const listMineHandler: RequestHandler = async (req, res) => {
  const query = orderListQuerySchema.parse(req.query);
  const result = await orderService.listMyOrders(req.user!.id, query);
  res.json(result);
};

export const detailMineHandler: RequestHandler = async (req, res) => {
  const { code } = orderCodeParamSchema.parse(req.params);
  const order = await orderService.getMyOrder(req.user!.id, code);
  res.json({ order });
};

export const cancelHandler: RequestHandler = async (req, res) => {
  const { code } = orderCodeParamSchema.parse(req.params);
  const input = customerCancelSchema.parse(req.body);
  const reason = resolveCancelReason(input, CUSTOMER_CANCEL_REASON_LABEL);
  const result = await orderService.cancelMyOrder(req.user!.id, code, reason);
  res.json(result);
};

// ------------------------------------------------------------------- admin

export const adminListHandler: RequestHandler = async (req, res) => {
  const query = adminOrderListQuerySchema.parse(req.query);
  const result = await orderService.listAllOrders(query);
  res.json(result);
};

export const adminDetailHandler: RequestHandler = async (req, res) => {
  const { code } = orderCodeParamSchema.parse(req.params);
  const order = await orderService.getOrderByCode(code);
  res.json({ order });
};

export const adminUpdateStatusHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = orderStatusSchema.parse(req.body);
  const reason =
    input.status === 'CANCELLED'
      ? resolveCancelReason(input, ADMIN_CANCEL_REASON_LABEL)
      : undefined;
  const result = await orderService.updateOrderStatus(id, input.status, req.user!.id, reason);
  res.json(result);
};

export const adminUpdatePaymentHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { paymentStatus } = paymentStatusSchema.parse(req.body);
  const order = await orderService.updatePaymentStatus(id, paymentStatus);
  res.json({ order });
};
