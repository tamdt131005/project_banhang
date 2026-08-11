import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import { roleUpdateSchema, userListQuerySchema } from './user.schema.js';
import * as userService from './user.service.js';

export const listHandler: RequestHandler = async (req, res) => {
  const query = userListQuerySchema.parse(req.query);
  const result = await userService.listUsers(query);
  res.json(result);
};

export const detailHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const user = await userService.getUserDetail(id);
  res.json({ user });
};

export const updateRoleHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = roleUpdateSchema.parse(req.body);
  // requireAdmin chạy trước nên req.user chắc chắn đã có.
  const user = await userService.updateUserRole(req.user!.id, id, input);
  res.json({ user });
};

export const revokeSessionsHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await userService.revokeUserSessions(id);
  res.json(result);
};
