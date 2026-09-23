import type { RequestHandler } from 'express';
import { ACCESS_COOKIE } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { AppError } from './error.js';
import type { StaffPermissionKey } from '../modules/permissions/permission.constants.js';
import * as permissionService from '../modules/permissions/permission.service.js';

/**
 * Chặn request chưa đăng nhập và gắn `req.user`.
 * Express 5 tự bắt lỗi ném đồng bộ nên không cần try/catch ở nơi gọi.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const token = cookies?.[ACCESS_COOKIE];

  if (!token) {
    throw AppError.unauthorized();
  }

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    // Không phân biệt token hỏng với token hết hạn trong thông báo trả về:
    // cả hai đều dẫn tới cùng một hành động là đăng nhập lại.
    throw AppError.unauthorized('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  req.user = { id: Number(claims.sub), email: claims.email, role: claims.role };
  next();
};

/** Phải đặt SAU requireAuth trong chuỗi middleware. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return permissionService.getUserRole(req.user.id).then((role) => {
    if (!role) throw AppError.unauthorized();
    req.user!.role = role;
    if (role !== 'ADMIN') throw AppError.forbidden('Chức năng này chỉ dành cho quản trị viên.');
    next();
  });
};

/** ADMIN có toàn quyền; STAFF phải có đúng quyền đã cấp trong database. */
export function requirePermission(permission: StaffPermissionKey): RequestHandler {
  return async (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    const role = await permissionService.getUserRole(req.user.id);
    if (!role) throw AppError.unauthorized();
    req.user.role = role;
    if (role === 'ADMIN') {
      next();
      return;
    }
    if (role !== 'STAFF' || !(await permissionService.userHasPermission(req.user.id, permission))) {
      throw AppError.forbidden('Tài khoản chưa được cấp quyền sử dụng mục này.');
    }
    next();
  };
}
