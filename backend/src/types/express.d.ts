import type { Role } from '@prisma/client';

/**
 * Người dùng đã xác thực, do middleware `requireAuth` gắn vào request.
 * Chỉ chứa những trường cần cho phân quyền — không mang theo passwordHash.
 */
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
