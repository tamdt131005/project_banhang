import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import { cartAddSchema, cartUpdateSchema } from './cart.schema.js';
import * as cartService from './cart.service.js';

export const getHandler: RequestHandler = async (req, res) => {
  res.json({ cart: await cartService.getCart(req.user!.id) });
};

export const addHandler: RequestHandler = async (req, res) => {
  const input = cartAddSchema.parse(req.body);
  const cart = await cartService.addItem(req.user!.id, input);
  res.status(201).json({ cart });
};

export const updateHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { quantity } = cartUpdateSchema.parse(req.body);
  const cart = await cartService.updateItem(req.user!.id, id, quantity);
  res.json({ cart });
};

export const removeHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const cart = await cartService.removeItem(req.user!.id, id);
  res.json({ cart });
};

export const clearHandler: RequestHandler = async (req, res) => {
  const cart = await cartService.clearCart(req.user!.id);
  res.json({ cart });
};
