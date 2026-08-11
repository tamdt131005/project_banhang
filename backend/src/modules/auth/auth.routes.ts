import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { loginLimiter, refreshLimiter, registerLimiter, uploadLimiter } from '../../middleware/rateLimit.js';
import { uploadAvatarImage } from '../../middleware/upload.js';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  removeAvatarHandler,
  updateAvatarHandler,
  updateMeHandler,
} from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, registerHandler);
authRouter.post('/login', loginLimiter, loginHandler);
authRouter.post('/refresh', refreshLimiter, refreshHandler);
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', requireAuth, meHandler);
authRouter.patch('/me', requireAuth, updateMeHandler);
// uploadLimiter đặt sau requireAuth để đếm theo người dùng đã đăng nhập.
authRouter.post('/me/avatar', requireAuth, uploadLimiter, uploadAvatarImage, updateAvatarHandler);
authRouter.delete('/me/avatar', requireAuth, removeAvatarHandler);
