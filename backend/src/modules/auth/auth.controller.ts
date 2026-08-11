import type { RequestHandler } from 'express';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '../../lib/cookies.js';
import { AppError } from '../../middleware/error.js';
import { loginSchema, registerSchema, updateProfileSchema } from './auth.schema.js';
import * as authService from './auth.service.js';

function readRefreshCookie(req: Parameters<RequestHandler>[0]): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE];
}

export const registerHandler: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const { user, tokens } = await authService.register(input);

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.status(201).json({ user });
};

export const loginHandler: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const { user, tokens } = await authService.login(input);

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ user });
};

export const refreshHandler: RequestHandler = async (req, res) => {
  const rawToken = readRefreshCookie(req);
  if (!rawToken) {
    throw AppError.unauthorized('Không có phiên đăng nhập nào để làm mới.');
  }

  const { user, tokens } = await authService.refresh(rawToken);

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ user });
};

export const logoutHandler: RequestHandler = async (req, res) => {
  await authService.logout(readRefreshCookie(req));
  clearAuthCookies(res);
  res.status(204).end();
};

export const meHandler: RequestHandler = async (req, res) => {
  // requireAuth chạy trước nên req.user chắc chắn đã có.
  const user = await authService.getProfile(req.user!.id);
  res.json({ user });
};

export const updateMeHandler: RequestHandler = async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await authService.updateProfile(req.user!.id, input);
  res.json({ user });
};

export const updateAvatarHandler: RequestHandler = async (req, res) => {
  if (!req.file) {
    throw AppError.badRequest('NO_FILE', 'Chưa chọn ảnh nào. Gửi tệp ảnh ở trường "avatar".');
  }
  const user = await authService.updateAvatar(req.user!.id, req.file.buffer);
  res.json({ user });
};

export const removeAvatarHandler: RequestHandler = async (req, res) => {
  const user = await authService.removeAvatar(req.user!.id);
  res.json({ user });
};
