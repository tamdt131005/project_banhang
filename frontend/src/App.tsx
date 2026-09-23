import { Route, Routes } from 'react-router-dom';
import { AccountLayout } from './components/layout/AccountLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { ShopLayout } from './components/layout/ShopLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminBannersPage } from './pages/admin/AdminBannersPage';
import { AdminCustomerDetailPage } from './pages/admin/AdminCustomerDetailPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminProductFormPage } from './pages/admin/AdminProductFormPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminSupportPage } from './pages/admin/AdminSupportPage';
import { AdminPermissionsPage } from './pages/admin/AdminPermissionsPage';
import { AdminAccountPage } from './pages/admin/AdminAccountPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { AddressesPage } from './pages/shop/AddressesPage';
import { CartPage } from './pages/shop/CartPage';
import { CheckoutPage } from './pages/shop/CheckoutPage';
import { HomePage } from './pages/shop/HomePage';
import { MyOrdersPage } from './pages/shop/MyOrdersPage';
import { OrderDetailPage } from './pages/shop/OrderDetailPage';
import { OrderSuccessPage } from './pages/shop/OrderSuccessPage';
import { ProductDetailPage } from './pages/shop/ProductDetailPage';
import { ProductsPage } from './pages/shop/ProductsPage';
import { ProfilePage } from './pages/shop/ProfilePage';
import { AdminOwnerRoute, AdminPermissionRoute, AdminRoute, ProtectedRoute } from './routes/Guards';

export interface AppProps {}

/**
 * Đường dẫn viết bằng tiếng Việt không dấu để URL đọc được và dễ chia sẻ:
 * /san-pham/cap-ugreen-usb-c-1m-100w thay vì /products/8.
 */
export default function App({}: Readonly<AppProps>) {
  return (
    <Routes>
      {/* Trang tài khoản dùng layout tràn mép để chia đôi màn hình. */}
      <Route element={<AuthLayout />}>
        <Route path="dang-nhap" element={<LoginPage />} />
        <Route path="dang-ky" element={<RegisterPage />} />
        <Route path="quen-mat-khau" element={<ForgotPasswordPage />} />
      </Route>
      <Route element={<ShopLayout />}>
        <Route index element={<HomePage />} />
        <Route path="san-pham" element={<ProductsPage />} />
        <Route path="san-pham/:slug" element={<ProductDetailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="gio-hang" element={<CartPage />} />
          <Route path="thanh-toan" element={<CheckoutPage />} />
          <Route path="dat-hang-thanh-cong/:code" element={<OrderSuccessPage />} />
          <Route path="don-hang/:code" element={<OrderDetailPage />} />

          {/* Khu tài khoản dùng chung sidebar: hồ sơ / sổ địa chỉ / đơn mua. */}
          <Route element={<AccountLayout />}>
            <Route path="tai-khoan" element={<ProfilePage />} />
            <Route path="dia-chi" element={<AddressesPage />} />
            <Route path="don-hang" element={<MyOrdersPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<AdminRoute />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route path="tai-khoan" element={<AdminAccountPage />} />
          <Route element={<AdminPermissionRoute permission="DASHBOARD" />}>
            <Route index element={<AdminDashboardPage />} />
          </Route>
          <Route element={<AdminPermissionRoute permission="CATALOG" />}>
            <Route path="san-pham" element={<AdminProductsPage />} />
            {/* "moi" rơi vào :id và được trang form hiểu là chế độ tạo mới. */}
            <Route path="san-pham/:id" element={<AdminProductFormPage />} />
            <Route path="danh-muc" element={<AdminCategoriesPage />} />
          </Route>
          <Route element={<AdminPermissionRoute permission="INVENTORY" />}>
            <Route path="kho" element={<AdminInventoryPage />} />
          </Route>
          <Route element={<AdminPermissionRoute permission="BANNERS" />}>
            <Route path="banner" element={<AdminBannersPage />} />
          </Route>
          <Route element={<AdminPermissionRoute permission="ORDERS" />}>
            <Route path="don-hang" element={<AdminOrdersPage />} />
            <Route path="don-hang/:code" element={<AdminOrderDetailPage />} />
          </Route>
          <Route element={<AdminPermissionRoute permission="SUPPORT" />}>
            <Route path="ho-tro" element={<AdminSupportPage />} />
          </Route>
          <Route element={<AdminPermissionRoute permission="CUSTOMERS" />}>
            <Route path="khach-hang" element={<AdminCustomersPage />} />
            <Route path="khach-hang/:id" element={<AdminCustomerDetailPage />} />
          </Route>
          <Route element={<AdminOwnerRoute />}>
            <Route path="phan-quyen" element={<AdminPermissionsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
