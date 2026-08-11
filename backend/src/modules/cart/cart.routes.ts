import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  addHandler,
  clearHandler,
  getHandler,
  removeHandler,
  updateHandler,
} from './cart.controller.js';

export const cartRouter = Router();

// Giỏ hàng lưu trên server nên bắt buộc đăng nhập.
cartRouter.use(requireAuth);

cartRouter.get('/', getHandler);
cartRouter.post('/items', addHandler);
cartRouter.patch('/items/:id', updateHandler);
cartRouter.delete('/items/:id', removeHandler);
cartRouter.delete('/', clearHandler);
