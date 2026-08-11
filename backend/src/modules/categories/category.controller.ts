import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import { categoryCreateSchema, categoryUpdateSchema } from './category.schema.js';
import * as categoryService from './category.service.js';

export const treeHandler: RequestHandler = async (_req, res) => {
  const categories = await categoryService.listCategoryTree();
  res.json({ categories });
};

export const createHandler: RequestHandler = async (req, res) => {
  const input = categoryCreateSchema.parse(req.body);
  const category = await categoryService.createCategory(input);
  res.status(201).json({ category });
};

export const updateHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = categoryUpdateSchema.parse(req.body);
  const category = await categoryService.updateCategory(id, input);
  res.json({ category });
};

export const removeHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await categoryService.removeCategory(id);
  res.status(204).end();
};
