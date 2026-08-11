import crypto from 'node:crypto';
import type { Role } from '@prisma/client';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessClaims {
  sub: string;
  email: string;
  role: Role;
}

/** Đổi chuỗi kiểu "15m" / "7d" sang mili giây. */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Thời hạn không hợp lệ: "${value}". Ví dụ hợp lệ: 30s, 15m, 24h, 7d`);
  }
  const factor: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * factor[match[2] as string]!;
}

export function signAccessToken(user: { id: number; email: string; role: Role }): string {
  return jwt.sign({ email: user.email, role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user.id),
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new Error('Access token sai định dạng');
  }
  return payload as unknown as AccessClaims;
}

/**
 * Refresh token là chuỗi ngẫu nhiên chứ không phải JWT. Nguồn sự thật là bản
 * ghi trong database, nên thu hồi được ngay lập tức — điều mà JWT tự xác thực
 * không làm được nếu không dựng thêm danh sách đen.
 *
 * Trong database chỉ lưu HMAC-SHA256 của token. Dùng HMAC (có khoá bí mật)
 * thay vì SHA-256 trần: nếu database bị lộ, kẻ tấn công vẫn không thể dựng
 * bảng tra ngược để đổi lấy token thật.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export function createRefreshToken() {
  const token = crypto.randomBytes(48).toString('base64url');
  return {
    token,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + parseDuration(env.REFRESH_TOKEN_TTL)),
  };
}
