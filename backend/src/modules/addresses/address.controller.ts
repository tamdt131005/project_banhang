import type { RequestHandler } from 'express';
import { idParamSchema } from '../../lib/validators.js';
import { addressCreateSchema, addressUpdateSchema } from './address.schema.js';
import * as addressService from './address.service.js';

export const listHandler: RequestHandler = async (req, res) => {
  const addresses = await addressService.listAddresses(req.user!.id);
  res.json({ addresses });
};

export const createHandler: RequestHandler = async (req, res) => {
  const input = addressCreateSchema.parse(req.body);
  const address = await addressService.createAddress(req.user!.id, input);
  res.status(201).json({ address });
};

export const updateHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = addressUpdateSchema.parse(req.body);
  const address = await addressService.updateAddress(req.user!.id, id, input);
  res.json({ address });
};

export const setDefaultHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const address = await addressService.setDefaultAddress(req.user!.id, id);
  res.json({ address });
};

export const removeHandler: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await addressService.removeAddress(req.user!.id, id);
  res.status(204).end();
};
