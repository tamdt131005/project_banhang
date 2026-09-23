import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, createContext, useContext, useMemo } from 'react';
import {
  type ChangePasswordInput,
  type EmailOtpRequestResult,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
  authApi,
} from '../api/auth';
import { ApiError } from '../api/client';
import type { AdminPermission, ApiUser } from '../types/api';

interface AuthContextValue {
  user: ApiUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  can: (permission: AdminPermission) => boolean;
  login: (input: LoginInput) => Promise<ApiUser>;
  requestRegistrationOtp: (email: string) => Promise<EmailOtpRequestResult>;
  register: (input: RegisterInput) => Promise<ApiUser>;
  requestPasswordResetOtp: (email: string) => Promise<EmailOtpRequestResult>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<ApiUser>;
  uploadAvatar: (file: File) => Promise<ApiUser>;
  removeAvatar: () => Promise<ApiUser>;
  logout: () => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const { user } = await authApi.me();
        return user;
      } catch (error) {
        // Chưa đăng nhập là trạng thái bình thường, không phải lỗi cần báo.
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(['me'], user);
      // Giỏ hàng thuộc về từng tài khoản, phải nạp lại sau khi đổi người dùng.
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(['me'], user);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const requestRegistrationOtpMutation = useMutation({
    mutationFn: (email: string) => authApi.requestRegistrationOtp(email),
  });

  const requestPasswordResetOtpMutation = useMutation({
    mutationFn: (email: string) => authApi.requestPasswordResetOtp(email),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ queryKey: ['cart'] });
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: ['addresses'] });
      queryClient.removeQueries({ queryKey: ['chat'] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => authApi.updateMe(input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(['me'], user);
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(['me'], user);
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => authApi.removeAvatar(),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(['me'], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      // Xoá sạch cache thay vì chỉ đánh dấu cũ: dữ liệu riêng tư của người vừa
      // đăng xuất không được nằm lại chờ người tiếp theo nhìn thấy.
      queryClient.removeQueries({ queryKey: ['cart'] });
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: ['addresses'] });
      queryClient.removeQueries({ queryKey: ['chat'] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (input: ChangePasswordInput) => authApi.changePassword(input),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ queryKey: ['cart'] });
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: ['addresses'] });
      queryClient.removeQueries({ queryKey: ['chat'] });
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isPending,
      isAdmin: meQuery.data?.role === 'ADMIN',
      can: (permission) =>
        meQuery.data?.role === 'ADMIN' ||
        (meQuery.data?.role === 'STAFF' && meQuery.data.adminPermissions.includes(permission)),
      login: async (input) => (await loginMutation.mutateAsync(input)).user,
      requestRegistrationOtp: (email) => requestRegistrationOtpMutation.mutateAsync(email),
      register: async (input) => (await registerMutation.mutateAsync(input)).user,
      requestPasswordResetOtp: (email) => requestPasswordResetOtpMutation.mutateAsync(email),
      resetPassword: async (input) => {
        await resetPasswordMutation.mutateAsync(input);
      },
      updateProfile: async (input) => (await updateProfileMutation.mutateAsync(input)).user,
      uploadAvatar: async (file) => (await uploadAvatarMutation.mutateAsync(file)).user,
      removeAvatar: async () => (await removeAvatarMutation.mutateAsync()).user,
      logout: async () => {
        await logoutMutation.mutateAsync();
      },
      changePassword: async (input) => {
        await changePasswordMutation.mutateAsync(input);
      },
    }),
    [
      meQuery.data,
      meQuery.isPending,
      loginMutation,
      requestRegistrationOtpMutation,
      registerMutation,
      requestPasswordResetOtpMutation,
      resetPasswordMutation,
      updateProfileMutation,
      uploadAvatarMutation,
      removeAvatarMutation,
      logoutMutation,
      changePasswordMutation,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải nằm bên trong <AuthProvider>');
  }
  return context;
}
