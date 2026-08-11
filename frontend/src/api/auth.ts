import type { ApiUser } from '../types/api';
import { api } from './client';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
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

export const authApi = {
  register: (input: RegisterInput) => api.post<{ user: ApiUser }>('/api/auth/register', input),
  login: (input: LoginInput) => api.post<{ user: ApiUser }>('/api/auth/login', input),
  logout: () => api.post<void>('/api/auth/logout'),
  me: () => api.get<{ user: ApiUser }>('/api/auth/me'),
  updateMe: (input: UpdateProfileInput) => api.patch<{ user: ApiUser }>('/api/auth/me', input),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post<{ user: ApiUser }>('/api/auth/me/avatar', form);
  },
  removeAvatar: () => api.delete<{ user: ApiUser }>('/api/auth/me/avatar'),
};
