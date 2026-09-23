import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import type { EmailOtpPurpose } from '@prisma/client';

export async function sendEmailOtp(to: string, otp: string, purpose: EmailOtpPurpose) {
  const isRegistration = purpose === 'REGISTER';
  const title = isRegistration ? 'Xác nhận email đăng ký' : 'Đặt lại mật khẩu';
  const action = isRegistration ? 'hoàn tất đăng ký tài khoản' : 'đặt lại mật khẩu';
  const text = `Mã xác nhận May An của bạn là ${otp}. Mã có hiệu lực trong ${env.EMAIL_OTP_TTL_MINUTES} phút. Chỉ dùng mã này để ${action}. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#27231f;max-width:520px;margin:24px auto;padding:24px;border:1px solid #eee;border-radius:16px"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#93784c">MAY AN</p><h1 style="font-size:22px">${title}</h1><p>Nhập mã này để ${action}:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f7f4ef;border-radius:12px;text-align:center">${otp}</p><p>Mã có hiệu lực trong ${env.EMAIL_OTP_TTL_MINUTES} phút và chỉ dùng một lần.</p><p style="font-size:13px;color:#777">Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p></div>`;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
  const senderAddress = env.MAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.MAIL_FROM;

  await transporter.sendMail({
    from: { name: 'May An', address: senderAddress },
    to,
    subject: `May An | ${title}`,
    text,
    html,
  });
}
