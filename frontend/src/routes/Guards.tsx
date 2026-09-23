import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import type { AdminPermission } from '../types/api';
import { staffLandingPath } from '../lib/staffLanding';

export interface GuardProps {
  /** Nơi chuyển tới khi không đủ điều kiện vào. */
  redirectTo?: string;
}

function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-10">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-40" />
    </div>
  );
}

/** Chặn khách chưa đăng nhập, đồng thời nhớ đường dẫn để quay lại sau khi vào. */
export function ProtectedRoute({ redirectTo = '/dang-nhap' }: Readonly<GuardProps>) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loading />;

  // `replace` để nút Quay lại của trình duyệt không ném người dùng trở lại
  // đúng trang vừa bị chặn.
  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function AdminRoute({ redirectTo = '/' }: Readonly<GuardProps>) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loading />;

  if (!user) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  }

  // Đây chỉ là rào chắn giao diện, để khách thường không thấy màn hình trống.
  // Rào thật nằm ở backend: mọi route /api/admin/* đều qua requireAdmin và
  // trả 403 dù người dùng có tự gõ URL hay gọi thẳng API.
  if (user.role === 'USER' || (user.role === 'STAFF' && user.adminPermissions.length === 0)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

export function AdminPermissionRoute({ permission }: Readonly<{ permission: AdminPermission }>) {
  const { user, can, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!user || !can(permission)) {
    return <Navigate to={user ? staffLandingPath(user) : '/dang-nhap'} replace />;
  }
  return <Outlet />;
}

export function AdminOwnerRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to={user ? staffLandingPath(user) : '/dang-nhap'} replace />;
  }
  return <Outlet />;
}
