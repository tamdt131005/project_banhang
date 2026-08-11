import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export interface AuthLayoutProps {}

/**
 * Layout riêng cho đăng nhập/đăng ký: vẫn có header nhưng phần thân
 * KHÔNG bọc khung 1280px — trang auth chia đôi màn hình cần tràn hết mép.
 */
export function AuthLayout({}: Readonly<AuthLayoutProps>) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
