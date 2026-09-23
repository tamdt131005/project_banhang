import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../brand/BrandLogo';
import { Avatar } from '../ui/Avatar';
import {
  BoxIcon,
  CameraIcon,
  ChevronRightIcon,
  GaugeIcon,
  MessageIcon,
  ReceiptIcon,
  StoreIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
  WarehouseIcon,
} from '../ui/icons';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import type { AdminPermission } from '../../types/api';

export interface AdminLayoutProps {
  className?: string;
}

/**
 * Chia nhóm theo công việc chứ không đổ một danh sách phẳng: bán hàng (đơn)
 * tách khỏi hàng hoá (sản phẩm/kho/danh mục) để mắt tìm đúng chỗ.
 */
type AdminNavLink = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end: boolean;
  permission?: AdminPermission;
  ownerOnly?: boolean;
};

const GROUPS: { title: string | null; links: AdminNavLink[] }[] = [
  {
    title: null,
    links: [{ to: '/admin', label: 'Tổng quan', icon: <GaugeIcon />, end: true, permission: 'DASHBOARD' as AdminPermission }],
  },
  {
    title: 'Bán hàng',
    links: [
      { to: '/admin/don-hang', label: 'Đơn hàng', icon: <ReceiptIcon />, end: false, permission: 'ORDERS' as AdminPermission },
      { to: '/admin/ho-tro', label: 'Hỗ trợ', icon: <MessageIcon />, end: false, permission: 'SUPPORT' as AdminPermission },
      { to: '/admin/khach-hang', label: 'Khách hàng', icon: <UsersIcon />, end: false, permission: 'CUSTOMERS' as AdminPermission },
    ],
  },
  {
    title: 'Hàng hoá',
    links: [
      { to: '/admin/san-pham', label: 'Sản phẩm', icon: <BoxIcon />, end: false, permission: 'CATALOG' as AdminPermission },
      { to: '/admin/kho', label: 'Kho hàng', icon: <WarehouseIcon />, end: false, permission: 'INVENTORY' as AdminPermission },
      { to: '/admin/danh-muc', label: 'Danh mục', icon: <TagIcon />, end: false, permission: 'CATALOG' as AdminPermission },
      { to: '/admin/banner', label: 'Banner', icon: <CameraIcon />, end: false, permission: 'BANNERS' as AdminPermission },
    ],
  },
  {
    title: 'Quản trị',
    links: [{ to: '/admin/phan-quyen', label: 'Phân quyền', icon: <ShieldIcon />, end: false, ownerOnly: true }],
  },
];

const LINKS = GROUPS.flatMap((group) => group.links);

/**
 * Khung quản trị kiểu dashboard: sidebar cố định bên trái + top bar riêng,
 * KHÔNG dùng header cửa hàng — admin không cần ô tìm kiếm hay giỏ hàng,
 * và tách hẳn hai không gian giúp biết ngay mình đang đứng ở đâu.
 */
export function AdminLayout({ className = '' }: Readonly<AdminLayoutProps>) {
  const { user, can, isAdmin } = useAuth();
  const location = useLocation();

  // Nhánh đang mở — cho breadcrumb ở top bar. Duyệt từ đường dẫn dài nhất để
  // /admin/kho không bị "/admin" (Tổng quan) nhận nhầm.
  const current =
    [...LINKS]
      .sort((a, b) => b.to.length - a.to.length)
      .find((link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`))
      ?.label ?? 'Tổng quan';

  // AdminRoute đã chặn người lạ; kiểm tra lại chỉ để TypeScript yên tâm.
  if (!user) return null;

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) =>
      link.ownerOnly ? isAdmin : link.permission ? can(link.permission) : true,
    ),
  })).filter((group) => group.links.length > 0);
  const visibleLinks = visibleGroups.flatMap((group) => group.links);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm transition-colors duration-[160ms] ${
      isActive
        ? 'bg-accent-soft font-semibold text-accent'
        : 'text-ink-muted hover:bg-sunken hover:text-ink'
    }`;

  return (
    <div className={`flex h-screen overflow-hidden ${className}`}>
      {/* Sidebar máy tính — cao hết màn hình, cuộn riêng phần nav. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link to="/" className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-5">
          <BrandLogo markSize={32} />
          <span className="rounded-control bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wider text-accent uppercase">
            Admin
          </span>
        </Link>

        <nav aria-label="Quản trị" className="flex-1 space-y-4 overflow-y-auto p-3">
          {visibleGroups.map((group) => (
            <div key={group.title ?? 'chinh'}>
              {group.title ? (
                <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-ink-muted uppercase">
                  {group.title}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {group.links.map((link) => (
                  <NavLink key={link.to} to={link.to} end={link.end} className={navItemClass}>
                    {link.icon}
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
              <p className="text-xs text-ink-muted">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</p>
            </div>
          </div>
          <Link
            to="/"
            className="mt-1 flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm text-ink-muted transition-colors duration-[160ms] hover:bg-sunken hover:text-ink"
          >
            <StoreIcon />
            Xem cửa hàng
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar riêng của khu quản trị. */}
        <header className="sticky top-0 z-20 border-b border-line bg-surface">
          <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-3 px-4 sm:px-6">
            <Link to="/" className="lg:hidden">
              <BrandLogo markSize={30} wordmarkClassName="hidden text-base sm:inline" />
            </Link>

            <div className="hidden items-center gap-1.5 text-sm lg:flex">
              <span className="text-ink-muted">Quản trị</span>
              <ChevronRightIcon className="size-3 text-ink-muted" />
              <span className="font-semibold">{current}</span>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <Link
                to="/"
                aria-label="Xem cửa hàng"
                className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-medium transition-colors duration-[160ms] hover:bg-sunken lg:hidden"
              >
                <StoreIcon className="size-4" />
                <span className="hidden sm:inline">Xem cửa hàng</span>
              </Link>
              <ThemeToggle />
              <UserMenu user={user} area="admin" />
            </div>
          </div>

          {/* Di động: sidebar nhường chỗ cho hàng tab cuộn ngang. */}
          <nav
            aria-label="Quản trị"
            className="no-scrollbar mx-auto flex max-w-[1280px] gap-1.5 overflow-x-auto border-t border-line px-4 py-2 lg:hidden"
          >
            {visibleLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors duration-[160ms] ${
                    isActive
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line hover:bg-sunken'
                  }`
                }
              >
                {link.icon}
                {link.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main
          className={`mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-6 ${
            location.pathname === '/admin/ho-tro' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
