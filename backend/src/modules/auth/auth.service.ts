import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Prisma, type EmailOtpPurpose, type Role, type StaffPermission, type User } from '@prisma/client';
import { env } from '../../config/env.js';
import { deleteUploadedFile, storeAvatarImage } from '../../lib/image.js';
import { createRefreshToken, hashRefreshToken, signAccessToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from './auth.schema.js';
import { listUserPermissions } from '../permissions/permission.service.js';
import { sendEmailOtp } from './email-otp.mailer.js';

export interface PublicUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  adminPermissions: StaffPermission[];
}

/** Không bao giờ trả passwordHash ra ngoài — mọi response về user đi qua đây. */
export async function toPublicUser(user: User): Promise<PublicUser> {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    adminPermissions: user.role === 'STAFF' ? await listUserPermissions(user.id) : [],
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

function otpDigest(email: string, purpose: EmailOtpPurpose, otp: string) {
  return createHmac('sha256', env.EMAIL_OTP_HMAC_SECRET)
    .update(`${purpose}\0${email}\0${otp}`)
    .digest('hex');
}

function requireEmailOtpConfiguration() {
  if (
    env.EMAIL_OTP_HMAC_SECRET.length < 32 ||
    !env.SMTP_HOST ||
    !env.MAIL_FROM
  ) {
    throw new AppError(503, 'EMAIL_OTP_UNAVAILABLE', 'Chức năng gửi mã email hiện chưa sẵn sàng.');
  }
}

async function deliverEmailOtp(
  challengeId: number,
  email: string,
  otp: string,
  purpose: EmailOtpPurpose,
  digest: string,
) {
  try {
    await sendEmailOtp(email, otp, purpose);
  } catch {
    await prisma.emailOtpChallenge
      .deleteMany({ where: { id: challengeId, otpDigest: digest } })
      .catch(() => undefined);
    console.error('[auth] email OTP delivery failed (details redacted)');
  }
}

async function requestEmailOtp(email: string, purpose: EmailOtpPurpose) {
  requireEmailOtpConfiguration();
  const now = new Date();
  await prisma.emailOtpChallenge.deleteMany({ where: { expiresAt: { lt: now } } });

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  const eligible = purpose === 'REGISTER' ? !existingUser : Boolean(existingUser);
  if (!eligible) return;

  const current = await prisma.emailOtpChallenge.findUnique({
    where: { email_purpose: { email, purpose } },
  });
  if (current && current.resendAvailableAt > now) return;

  const otp = randomInt(1_000_000).toString().padStart(6, '0');
  const digest = otpDigest(email, purpose, otp);
  const expiresAt = new Date(now.getTime() + env.EMAIL_OTP_TTL_MINUTES * 60_000);
  const resendAvailableAt = new Date(now.getTime() + env.EMAIL_OTP_RESEND_SECONDS * 1000);
  const challenge = await prisma.emailOtpChallenge.upsert({
    where: { email_purpose: { email, purpose } },
    create: { email, purpose, otpDigest: digest, expiresAt, resendAvailableAt },
    update: {
      otpDigest: digest,
      expiresAt,
      resendAvailableAt,
      failedAttemptCount: 0,
    },
  });

  void deliverEmailOtp(challenge.id, email, otp, purpose, digest);
}

export function requestRegistrationOtp(email: string) {
  return requestEmailOtp(email, 'REGISTER');
}

export function requestPasswordResetOtp(email: string) {
  return requestEmailOtp(email, 'PASSWORD_RESET');
}

async function consumeEmailOtp(
  tx: Prisma.TransactionClient,
  email: string,
  purpose: EmailOtpPurpose,
  otp: string,
) {
  const challenge = await tx.emailOtpChallenge.findUnique({
    where: { email_purpose: { email, purpose } },
  });
  if (!challenge) return false;

  if (
    challenge.expiresAt <= new Date() ||
    challenge.failedAttemptCount >= env.EMAIL_OTP_MAX_ATTEMPTS
  ) {
    await tx.emailOtpChallenge.deleteMany({ where: { id: challenge.id } });
    return false;
  }

  const expected = Buffer.from(challenge.otpDigest, 'hex');
  const received = Buffer.from(otpDigest(email, purpose, otp), 'hex');
  const valid = expected.length === received.length && timingSafeEqual(expected, received);
  if (!valid) {
    const incremented = await tx.emailOtpChallenge.updateMany({
      where: { id: challenge.id, failedAttemptCount: challenge.failedAttemptCount },
      data: { failedAttemptCount: { increment: 1 } },
    });
    if (incremented.count === 1 && challenge.failedAttemptCount + 1 >= env.EMAIL_OTP_MAX_ATTEMPTS) {
      await tx.emailOtpChallenge.deleteMany({
        where: { id: challenge.id, failedAttemptCount: { gte: env.EMAIL_OTP_MAX_ATTEMPTS } },
      });
    }
    return false;
  }

  const consumed = await tx.emailOtpChallenge.deleteMany({
    where: { id: challenge.id, otpDigest: challenge.otpDigest },
  });
  return consumed.count === 1;
}

const invalidOrExpiredOtp = () =>
  AppError.badRequest('INVALID_OR_EXPIRED_OTP', 'Mã xác nhận không hợp lệ hoặc đã hết hạn.');

export async function register(input: RegisterInput) {
  requireEmailOtpConfiguration();
  const passwordHash = await hashPassword(input.password);
  let result: { kind: 'created'; user: User } | { kind: 'invalid' };
  try {
    result = await prisma.$transaction(async (tx) => {
      const valid = await consumeEmailOtp(tx, input.email, 'REGISTER', input.otp);
      if (!valid) return { kind: 'invalid' as const };

      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone ?? null,
          // Tạo sẵn giỏ hàng để phần còn lại của hệ thống luôn tìm thấy giỏ.
          cart: { create: {} },
        },
      });
      return { kind: 'created' as const, user };
    });
  } catch (error) {
    // Dựa vào ràng buộc unique thay vì kiểm tra trước rồi mới ghi: cách này
    // không có khe hở khi hai người đăng ký cùng email cùng lúc.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflict('EMAIL_TAKEN', 'Email này đã được đăng ký.');
    }
    throw error;
  }

  if (result.kind === 'invalid') throw invalidOrExpiredOtp();
  return { user: await toPublicUser(result.user), tokens: await issueTokens(result.user) };
}

export async function resetPassword(input: { email: string; otp: string; newPassword: string }) {
  requireEmailOtpConfiguration();
  const passwordHash = await hashPassword(input.newPassword);
  const changed = await prisma.$transaction(async (tx) => {
    const valid = await consumeEmailOtp(tx, input.email, 'PASSWORD_RESET', input.otp);
    if (!valid) return false;

    const user = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (!user) return false;

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return true;
  });
  if (!changed) throw invalidOrExpiredOtp();
}

async function authenticate(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = user ? await verifyPassword(input.password, user.passwordHash) : false;

  // Cùng một thông báo cho "email không tồn tại" và "sai mật khẩu", để không
  // giúp kẻ tấn công dò xem email nào đã có tài khoản.
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }

  return { user: await toPublicUser(user), tokens: await issueTokens(user) };
}

export function login(input: LoginInput) {
  return authenticate(input);
}

export async function changePassword(userId: number, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, passwordHash: true },
  });
  if (!user) throw AppError.unauthorized();
  if (user.role === 'USER') throw AppError.forbidden('Chức năng này dành cho tài khoản nhân viên.');
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw AppError.badRequest('INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng.');
  }

  const newHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, passwordHash: user.passwordHash },
      data: { passwordHash: newHash },
    });
    if (updated.count !== 1) {
      throw AppError.conflict('PASSWORD_CHANGED', 'Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.');
    }
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
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
    user: await toPublicUser(stored.user),
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
