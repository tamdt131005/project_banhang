import type { Response } from 'express';
import { env, isProduction } from '../config/env.js';
import { parseDuration } from './jwt.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/**
 * Refresh token chỉ được gửi kèm khi gọi các endpoint dưới /api/auth.
 * Thu hẹp đường đi như vậy giúp token có giá trị cao nhất không bị đính vào
 * mọi request vặt của trang.
 */
const REFRESH_PATH = '/api/auth';

const base = {
  httpOnly: true,
  // Ở dev chạy http://localhost nên không bật secure, nếu không trình duyệt
  // sẽ từ chối lưu cookie.
  secure: isProduction,
  // 'lax' đủ dùng vì frontend gọi API qua proxy của Vite nên cùng origin.
  // Nếu sau này tách hẳn domain thì phải đổi sang 'none' kèm secure: true.
  sameSite: 'lax',
} as const;

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    path: '/',
    maxAge: parseDuration(env.ACCESS_TOKEN_TTL),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: parseDuration(env.REFRESH_TOKEN_TTL),
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
}
