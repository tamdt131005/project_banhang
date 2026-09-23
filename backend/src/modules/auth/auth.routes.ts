import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  changePasswordLimiter,
  emailOtpRequestLimiter,
  emailOtpVerifyLimiter,
  loginLimiter,
  refreshLimiter,
  registerLimiter,
  uploadLimiter,
} from '../../middleware/rateLimit.js';
import { uploadAvatarImage } from '../../middleware/upload.js';
import {
  loginHandler,
  changePasswordHandler,
  requestRegistrationOtpHandler,
  requestPasswordResetOtpHandler,
  resetPasswordHandler,
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
authRouter.post('/register/request-otp', emailOtpRequestLimiter, requestRegistrationOtpHandler);
authRouter.post('/password/forgot/request-otp', emailOtpRequestLimiter, requestPasswordResetOtpHandler);
authRouter.post('/password/forgot/reset', emailOtpVerifyLimiter, resetPasswordHandler);
authRouter.post('/login', loginLimiter, loginHandler);
authRouter.post('/refresh', refreshLimiter, refreshHandler);
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', requireAuth, meHandler);
authRouter.patch('/me', requireAuth, updateMeHandler);
authRouter.patch('/me/password', requireAuth, changePasswordLimiter, changePasswordHandler);
// uploadLimiter đặt sau requireAuth để đếm theo người dùng đã đăng nhập.
authRouter.post('/me/avatar', requireAuth, uploadLimiter, uploadAvatarImage, updateAvatarHandler);
authRouter.delete('/me/avatar', requireAuth, removeAvatarHandler);
