import { Link, Outlet } from 'react-router-dom';
import { useCategoryLinks } from '../../hooks/useCategoryLinks';
import { BrandLogo } from '../brand/BrandLogo';
import { CustomerChatWidget } from '../chat/CustomerChatWidget';
import { TruckIcon, WalletIcon } from '../ui/icons';
import { Header } from './Header';

export interface ShopLayoutProps {
  className?: string;
}

export function ShopLayout({ className = '' }: Readonly<ShopLayoutProps>) {
  const { linkFor } = useCategoryLinks();

  const columns = [
    {
      title: 'Mua sắm',
      links: [
        { label: 'Hàng mới về', to: '/san-pham' },
        { label: 'Đồ nam', to: linkFor('do-nam') },
        { label: 'Đồ nữ', to: linkFor('do-nu') },
        { label: 'Phụ kiện', to: linkFor('phu-kien') },
      ],
    },
    {
      title: 'Tài khoản',
      links: [
        { label: 'Hồ sơ của tôi', to: '/tai-khoan' },
        { label: 'Giỏ hàng', to: '/gio-hang' },
        { label: 'Đơn của tôi', to: '/don-hang' },
        { label: 'Sổ địa chỉ', to: '/dia-chi' },
      ],
    },
  ];

  return (
    /* min-h-[100dvh] chứ không h-screen: h-screen làm Safari iOS nhảy giật khi
       thanh địa chỉ ẩn hiện. */
    <div className={`flex min-h-[100dvh] flex-col ${className}`}>
      <Header />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6">
        <Outlet />
      </main>

      {/* Footer nhiều cột theo hướng premium — mọi link đều là đường dẫn thật. */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-10 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <BrandLogo markSize={36} />
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              Đồ cơ bản, đúng dáng — quần áo nam nữ và phụ kiện cho mỗi ngày, ghi rõ chất liệu và
              bảng size từng món.
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-ink-muted">
              <p className="flex items-center gap-1.5">
                <WalletIcon className="size-3.5" />
                Thanh toán khi nhận hàng (COD)
              </p>
              <p className="flex items-center gap-1.5">
                <TruckIcon className="size-3.5" />
                Phí vận chuyển hiện rõ trước khi đặt hàng
              </p>
            </div>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="label-block mb-4 text-ink">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-ink-muted transition-colors duration-[160ms] hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-t border-line">
          <p className="mx-auto max-w-[1280px] px-4 py-4 text-center text-xs text-ink-muted">
            © 2026 TÂM ĐẶNG — tiệm quần áo trực tuyến, dự án học tập
          </p>
        </div>
      </footer>

      <CustomerChatWidget />
    </div>
  );
}
