import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import { AppError } from '../../middleware/error.js';
import { roleUpdateSchema, staffAccessSchema, staffCreateSchema, userListQuerySchema } from './user.schema.js';
import * as userService from './user.service.js';

export const listHandler: RequestHandler = async (req, res) => {
  const query = userListQuerySchema.parse(req.query);
  const result = await userService.listUsers({
    ...query,
    ...(req.user!.role === 'ADMIN' ? {} : { role: 'USER' }),
  });
  res.json(result);
};

export const detailHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const user = await userService.getUserDetail(id);
  if (req.user!.role !== 'ADMIN' && user.role !== 'USER') {
    throw AppError.forbidden('Chức năng này chỉ dành cho quản trị viên.');
  }
  res.json({ user });
};

export const createStaffHandler: RequestHandler = async (req, res) => {
  const input = staffCreateSchema.parse(req.body);
  const user = await userService.createStaff(req.user!.id, input);
  res.status(201).json({ user });
};

export const updateRoleHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = roleUpdateSchema.parse(req.body);
  // requireAdmin chạy trước nên req.user chắc chắn đã có.
  const user = await userService.updateUserRole(req.user!.id, id, input);
  res.json({ user });
};

export const staffAccessHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const access = await userService.getStaffAccess(id);
  res.json({ access });
};

export const updateStaffAccessHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = staffAccessSchema.parse(req.body);
  const access = await userService.updateStaffAccess(req.user!.id, id, input);
  res.json({ access });
};

export const revokeSessionsHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await userService.revokeUserSessions(id);
  res.json(result);
};
