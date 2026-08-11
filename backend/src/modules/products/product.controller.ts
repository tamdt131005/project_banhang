import type { RequestHandler } from 'express';
import { idParamSchema, slugParamSchema } from '../../lib/validators.js';
import {
  imageOrderSchema,
  productCreateSchema,
  productQuerySchema,
  productUpdateSchema,
} from './product.schema.js';
import * as productService from './product.service.js';

export const listHandler: RequestHandler = async (req, res) => {
  const query = productQuerySchema.parse(req.query);
  const result = await productService.listProducts(query);
  res.json(result);
};

export const filterOptionsHandler: RequestHandler = async (_req, res) => {
  const options = await productService.getFilterOptions();
  res.json(options);
};

export const detailHandler: RequestHandler = async (req, res) => {
  const { slug } = slugParamSchema.parse(req.params);
  const product = await productService.getProductBySlug(slug);
  res.json({ product });
};

// ------------------------------------------------------------------- admin

export const adminListHandler: RequestHandler = async (req, res) => {
  const query = productQuerySchema.parse(req.query);
  // Admin phải thấy được cả sản phẩm đang ẩn để bật lại.
  const result = await productService.listProducts(query, { includeInactive: true });
  res.json(result);
};

export const adminDetailHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const product = await productService.getProductById(id);
  res.json({ product });
};

export const createHandler: RequestHandler = async (req, res) => {
  const input = productCreateSchema.parse(req.body);
  const product = await productService.createProduct(input, req.user!.id);
  res.status(201).json({ product });
};

export const updateHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = productUpdateSchema.parse(req.body);
  const product = await productService.updateProduct(id, input, req.user!.id);
  res.json({ product });
};

export const removeHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await productService.removeProduct(id, req.user!.id);
  res.status(204).end();
};

export const uploadImagesHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const files = Array.isArray(req.files) ? req.files : [];
  const product = await productService.addProductImages(id, files);
  res.status(201).json({ product });
};

export const reorderImagesHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { imageIds } = imageOrderSchema.parse(req.body);
  const product = await productService.reorderProductImages(id, imageIds);
  res.json({ product });
};

export const removeImageHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await productService.removeProductImage(id);
  res.status(204).end();
};
