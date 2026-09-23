import type { ApiUser } from '../types/api';
import { api } from './client';

export interface RegisterInput {
  email: string;
  otp: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface ResetPasswordInput {
  email: string;
  otp: string;
  newPassword: string;
}

export interface EmailOtpRequestResult {
  message: string;
  retryAfterSeconds: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  fullName: string;
  /** null để xoá số điện thoại đã lưu. */
  phone?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  requestRegistrationOtp: (email: string) =>
    api.post<EmailOtpRequestResult>('/api/auth/register/request-otp', { email }),
  register: (input: RegisterInput) => api.post<{ user: ApiUser }>('/api/auth/register', input),
  requestPasswordResetOtp: (email: string) =>
    api.post<EmailOtpRequestResult>('/api/auth/password/forgot/request-otp', { email }),
  resetPassword: (input: ResetPasswordInput) =>
    api.post<void>('/api/auth/password/forgot/reset', input),
  login: (input: LoginInput) => api.post<{ user: ApiUser }>('/api/auth/login', input),
  logout: () => api.post<void>('/api/auth/logout'),
  me: () => api.get<{ user: ApiUser }>('/api/auth/me'),
  updateMe: (input: UpdateProfileInput) => api.patch<{ user: ApiUser }>('/api/auth/me', input),
  changePassword: (input: ChangePasswordInput) => api.patch<void>('/api/auth/me/password', input),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post<{ user: ApiUser }>('/api/auth/me/avatar', form);
  },
  removeAvatar: () => api.delete<{ user: ApiUser }>('/api/auth/me/avatar'),
};
