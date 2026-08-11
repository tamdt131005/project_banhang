import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import {
  inventoryQuerySchema,
  movementListQuerySchema,
  stockUpdateSchema,
} from './admin.schema.js';
import * as adminService from './admin.service.js';

export const statsHandler: RequestHandler = async (_req, res) => {
  const stats = await adminService.getDashboardStats();
  res.json(stats);
};

export const inventoryHandler: RequestHandler = async (req, res) => {
  const query = inventoryQuerySchema.parse(req.query);
  const result = await adminService.listInventory(query);
  res.json(result);
};

export const updateStockHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = stockUpdateSchema.parse(req.body);
  const result = await adminService.updateVariantStock(id, input, req.user!.id);
  res.json(result);
};

export const inventoryMovementsHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const query = movementListQuerySchema.parse(req.query);
  const result = await adminService.listInventoryMovements(id, query);
  res.json(result);
};
