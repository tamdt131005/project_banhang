import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createHandler,
  listHandler,
  removeHandler,
  setDefaultHandler,
  updateHandler,
} from './address.controller.js';

export const addressRouter = Router();

// Toàn bộ sổ địa chỉ đều riêng tư.
addressRouter.use(requireAuth);

addressRouter.get('/', listHandler);
addressRouter.post('/', createHandler);
addressRouter.patch('/:id', updateHandler);
addressRouter.post('/:id/default', setDefaultHandler);
addressRouter.delete('/:id', removeHandler);
