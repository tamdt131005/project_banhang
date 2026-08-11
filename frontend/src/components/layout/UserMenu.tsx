import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ApiUser } from '../../types/api';
import { Avatar } from '../ui/Avatar';
import { LogoutIcon, PinIcon, ReceiptIcon, ShieldIcon, UserIcon } from '../ui/icons';

export interface UserMenuProps {
  user: ApiUser;
}

/* Hàng phủ kín mép menu, không bo riêng — panel đã overflow-hidden cắt góc. */
const ITEM_CLASS =
  'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors duration-[160ms] hover:bg-sunken';

/**
 * Avatar tròn trên header: trỏ chuột vào là menu thả xuống (máy có chuột),
 * chạm/bấm để mở trên di động. Gom mọi lối vào tài khoản về một chỗ —
 * hồ sơ, sổ địa chỉ, đơn mua, trang quản trị — thay vì rải link chữ.
 */
export function UserMenu({ user }: Readonly<UserMenuProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  // Phân biệt "mở do trỏ chuột" với "mở do bấm": nếu menu vừa tự mở vì hover
  // mà người dùng bấm luôn vào avatar thì nên GHIM menu lại chứ không đóng.
  const openedByHover = useRef(false);

  // Chuyển trang thì menu tự đóng.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      openedByHover.current = false;
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Dọn hẹn giờ đóng khi component bị gỡ.
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const hasHover = () => window.matchMedia('(hover: hover)').matches;

  function handleHoverOpen() {
    if (!hasHover()) return;
    window.clearTimeout(closeTimer.current);
    if (!open) openedByHover.current = true;
    setOpen(true);
  }

  function handleHoverClose() {
    if (!hasHover()) return;
    window.clearTimeout(closeTimer.current);
    // Trễ một nhịp để chuột trượt từ avatar xuống menu không làm menu sập.
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  }

  function handleClick() {
    if (open && openedByHover.current) {
      openedByHover.current = false;
      return;
    }
    setOpen((value) => !value);
  }

  const links = [
    { label: 'Hồ sơ của tôi', to: '/tai-khoan', icon: <UserIcon /> },
    { label: 'Sổ địa chỉ', to: '/dia-chi', icon: <PinIcon /> },
    { label: 'Đơn mua', to: '/don-hang', icon: <ReceiptIcon /> },
  ];

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={handleHoverOpen}
      onMouseLeave={handleHoverClose}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label={`Tài khoản của ${user.fullName}`}
        className="grid place-items-center rounded-full transition-transform duration-[160ms] ease-snap active:scale-95"
      >
        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
      </button>

      {open ? (
        <div
          id="user-menu"
          className="menu-pop absolute top-full right-0 z-30 mt-2 w-64 overflow-hidden rounded-card border border-line bg-surface shadow-[0_12px_32px_rgb(0_0_0/0.12)]"
        >
          <div className="flex items-center gap-3 border-b border-line p-4">
            <Avatar name={user.fullName} src={user.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
            </div>
          </div>

          <nav aria-label="Tài khoản" className="py-1">
            {links.map((item) => (
              <Link key={item.to} to={item.to} className={ITEM_CLASS} onClick={() => setOpen(false)}>
                <span className="text-ink-muted">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                to="/admin/san-pham"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-accent transition-colors duration-[160ms] hover:bg-accent-soft"
              >
                <ShieldIcon />
                Trang quản trị
              </Link>
            ) : null}
          </nav>

          <div className="border-t border-line py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout().then(() => navigate('/'));
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red-600 transition-colors duration-[160ms] hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              <LogoutIcon />
              Đăng xuất
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
