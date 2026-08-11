import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import {
  adminOrderListQuerySchema,
  orderCodeParamSchema,
  orderCreateSchema,
  orderListQuerySchema,
  orderStatusSchema,
  paymentStatusSchema,
} from './order.schema.js';
import * as orderService from './order.service.js';

export const createHandler: RequestHandler = async (req, res) => {
  const input = orderCreateSchema.parse(req.body);
  const order = await orderService.createOrder(req.user!.id, input);
  res.status(201).json({ order });
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
  const result = await orderService.cancelMyOrder(req.user!.id, code);
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
  const { status } = orderStatusSchema.parse(req.body);
  const result = await orderService.updateOrderStatus(id, status, req.user!.id);
  res.json(result);
};

export const adminUpdatePaymentHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { paymentStatus } = paymentStatusSchema.parse(req.body);
  const order = await orderService.updatePaymentStatus(id, paymentStatus);
  res.json({ order });
};
