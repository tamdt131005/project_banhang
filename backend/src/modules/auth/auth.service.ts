import { Prisma, type Role, type User } from '@prisma/client';
import { deleteUploadedFile, storeAvatarImage } from '../../lib/image.js';
import { createRefreshToken, hashRefreshToken, signAccessToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { LoginInput, RegisterInput, UpdateProfileInput } from './auth.schema.js';

export interface PublicUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
}

/** Không bao giờ trả passwordHash ra ngoài — mọi response về user đi qua đây. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: User): Promise<IssuedTokens> {
  const refresh = createRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: refresh.tokenHash,
      userId: user.id,
      expiresAt: refresh.expiresAt,
    },
  });

  return { accessToken: signAccessToken(user), refreshToken: refresh.token };
}

export async function register(input: RegisterInput) {
  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        fullName: input.fullName,
        phone: input.phone ?? null,
        // Tạo sẵn giỏ hàng để phần còn lại của hệ thống luôn tìm thấy giỏ,
        // khỏi phải xử lý trường hợp "user chưa có giỏ" ở mọi nơi.
        cart: { create: {} },
      },
    });
  } catch (error) {
    // Dựa vào ràng buộc unique thay vì kiểm tra trước rồi mới ghi: cách này
    // không có khe hở khi hai người đăng ký cùng email cùng lúc.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflict('EMAIL_TAKEN', 'Email này đã được đăng ký.');
    }
    throw error;
  }

  return { user: toPublicUser(user), tokens: await issueTokens(user) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = user ? await verifyPassword(input.password, user.passwordHash) : false;

  // Cùng một thông báo cho "email không tồn tại" và "sai mật khẩu", để không
  // giúp kẻ tấn công dò xem email nào đã có tài khoản.
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }

  return { user: toPublicUser(user), tokens: await issueTokens(user) };
}

export async function refresh(rawToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    include: { user: true },
  });

  const expired = () =>
    AppError.unauthorized('Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.');

  if (!stored) throw expired();

  if (stored.revokedAt) {
    // Token đã thu hồi mà vẫn được dùng lại: hoặc token bị đánh cắp, hoặc
    // bản sao cũ còn sót. Cả hai trường hợp đều nên cắt sạch mọi phiên của
    // tài khoản này và bắt đăng nhập lại.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw expired();
  }

  if (stored.expiresAt <= new Date()) throw expired();

  const next = createRefreshToken();

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: next.tokenHash,
        userId: stored.userId,
        expiresAt: next.expiresAt,
      },
    }),
    // Dọn token đã hết hạn của chính người này để bảng không phình mãi.
    prisma.refreshToken.deleteMany({
      where: { userId: stored.userId, expiresAt: { lt: new Date() } },
    }),
  ]);

  return {
    user: toPublicUser(stored.user),
    tokens: { accessToken: signAccessToken(stored.user), refreshToken: next.token },
  };
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;

  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getProfile(userId: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized();
  return toPublicUser(user);
}

export async function updateProfile(userId: number, input: UpdateProfileInput): Promise<PublicUser> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        ...(input.phone === undefined ? {} : { phone: input.phone }),
      },
    });
    return toPublicUser(user);
  } catch (error) {
    // Tài khoản đã bị xoá nhưng phiên vẫn còn sống — coi như hết đăng nhập.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw AppError.unauthorized();
    }
    throw error;
  }
}

export async function updateAvatar(userId: number, buffer: Buffer): Promise<PublicUser> {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw AppError.unauthorized();

  const avatarUrl = await storeAvatarImage(buffer);
  const user = await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });

  // Xoá ảnh cũ SAU khi DB đã ghi xong: lỗi giữa chừng thì thà thừa một tệp
  // mồ côi trên đĩa còn hơn user mất ảnh đang dùng.
  await deleteUploadedFile(current.avatarUrl);

  return toPublicUser(user);
}

export async function removeAvatar(userId: number): Promise<PublicUser> {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw AppError.unauthorized();

  const user = await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
  await deleteUploadedFile(current.avatarUrl);

  return toPublicUser(user);
}
