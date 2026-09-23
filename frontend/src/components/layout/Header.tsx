import { type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCartCount } from '../../hooks/useCart';
import { useCategoryLinks } from '../../hooks/useCategoryLinks';
import { BrandLogo } from '../brand/BrandLogo';
import { BagIcon, ChevronDownIcon, SearchIcon, XIcon } from '../ui/icons';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export interface HeaderProps {
  className?: string;
}

/**
 * SPA chuyển trang không làm mất focus của link vừa bấm, mà flyout lại mở
 * theo focus trong group — không nhả ra thì menu bị ghim mở mãi và chồng
 * lên flyout của mục đang trỏ chuột. Bấm xong là blur ngay.
 */
function blurAfterPick(event: MouseEvent<HTMLElement>) {
  event.currentTarget.blur();
}

export function Header({ className = '' }: Readonly<HeaderProps>) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cartCount = useCartCount();
  const { linkFor, childrenFor } = useCategoryLinks();
  const [keyword, setKeyword] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      mobileInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = keyword.trim();
    setIsSearchOpen(false);
    void navigate(trimmed ? `/san-pham?search=${encodeURIComponent(trimmed)}` : '/san-pham');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setIsSearchOpen(false);
    }
  }

  // Nav chữ hoa giãn chữ theo hướng premium — toàn bộ là link thật.
  // Mục có slug sẽ thả menu danh mục con khi trỏ chuột vào.
  const navItems: { label: string; to: string; slug?: string }[] = [
    { label: 'Hàng mới', to: '/san-pham' },
    { label: 'Đồ nam', to: linkFor('do-nam'), slug: 'do-nam' },
    { label: 'Đồ nữ', to: linkFor('do-nu'), slug: 'do-nu' },
    { label: 'Phụ kiện', to: linkFor('phu-kien'), slug: 'phu-kien' },
  ];

  const navLinkClass =
    'text-xs font-medium tracking-[0.12em] uppercase text-ink-muted transition-colors duration-[160ms] hover:text-ink';

  return (
    <header
      /*
       * Nền đục chứ không dùng backdrop-filter: hiệu ứng làm mờ trên phần tử
       * dính khi cuộn phải tính lại mỗi khung hình và rất tốn GPU
       * (quy tắc chống lag số 5).
       */
      className={`sticky top-0 z-20 border-b border-line bg-surface ${className}`}
    >
      <div className="relative mx-auto flex h-16 max-w-[1280px] items-center gap-x-5 px-4">
        {/*
          Logo luôn là Link về trang chủ. Đây là lối thoát duy nhất trên máy
          tính vì thanh điều hướng đáy chỉ hiện ở di động.
        */}
        <Link to="/" aria-label="May An — trang chủ">
          <BrandLogo markSize={34} wordmarkClassName="hidden text-xl sm:inline" />
        </Link>

        <nav aria-label="Danh mục chính" className="hidden items-stretch gap-5 self-stretch lg:flex">
          {navItems.map((item) => {
            const children = item.slug === undefined ? [] : childrenFor(item.slug);

            if (children.length === 0) {
              return (
                <NavLink key={item.label} to={item.to} className={`${navLinkClass} flex items-center`}>
                  {item.label}
                </NavLink>
              );
            }

            return (
              /*
               * Flyout thuần CSS: group-hover mở khi trỏ chuột, còn bàn phím
               * dùng group-has-[:focus-visible] thay vì focus-within — bấm
               * chuột cũng để lại focus nên focus-within từng ghim menu mở
               * sau khi chuyển trang. Group cao bằng cả header nên chuột
               * trượt xuống panel không bị hụt.
               */
              <div key={item.label} className="group relative flex items-center">
                <NavLink
                  to={item.to}
                  onClick={blurAfterPick}
                  className={`${navLinkClass} inline-flex items-center gap-1`}
                >
                  {item.label}
                  <ChevronDownIcon className="size-3 transition-transform duration-[160ms] ease-snap group-hover:rotate-180" />
                </NavLink>

                <div className="invisible absolute top-full left-1/2 z-30 -translate-x-1/2 translate-y-1 pt-2 opacity-0 transition-[opacity,transform,visibility] duration-[160ms] ease-snap group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-has-[:focus-visible]:visible group-has-[:focus-visible]:translate-y-0 group-has-[:focus-visible]:opacity-100">
                  {/*
                    Hàng trong menu phủ kín mép panel (không bo riêng từng
                    hàng) — hết cảnh bo tròn nhỏ lồng trong bo tròn to.
                    overflow-hidden để nền hover bị cắt gọn theo góc panel.
                  */}
                  <div className="w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-[0_12px_32px_rgb(0_0_0/0.12)]">
                    <NavLink
                      to={item.to}
                      onClick={blurAfterPick}
                      className="block px-4 py-2 text-sm font-semibold transition-colors duration-[160ms] hover:bg-sunken"
                    >
                      Tất cả {item.label.toLowerCase()}
                    </NavLink>
                    <hr className="my-1 border-line" />
                    {children.map((child) => (
                      <NavLink
                        key={child.id}
                        to={`/san-pham?categoryId=${child.id}`}
                        onClick={blurAfterPick}
                        className="block px-4 py-2 text-sm text-ink-muted transition-colors duration-[160ms] hover:bg-sunken hover:text-ink"
                      >
                        {child.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 text-sm">
          {/* Nút kính lúp hiển thị khi thu gọn màn hình (< sm) */}
          <button
            type="button"
            aria-label="Mở tìm kiếm"
            onClick={() => setIsSearchOpen(true)}
            className="grid size-9 place-items-center rounded-full transition-colors duration-[160ms] hover:bg-sunken sm:hidden"
          >
            <SearchIcon />
          </button>

          {/* Ô tìm kiếm cố định trên màn hình lớn (>= sm) */}
          <form onSubmit={submitSearch} className="relative hidden sm:block">
            <label htmlFor="header-search" className="sr-only">
              Tìm sản phẩm
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              id="header-search"
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm áo, quần…"
              className="h-9 w-44 rounded-control border border-line bg-sunken pr-4 pl-9 text-sm outline-none transition-[width,border-color] duration-[160ms] placeholder:text-ink-muted focus:w-60 focus:border-accent"
            />
          </form>

          <Link
            to="/gio-hang"
            aria-label={`Giỏ hàng${cartCount > 0 ? `, ${cartCount} món` : ''}`}
            className="relative grid size-9 place-items-center rounded-full transition-colors duration-[160ms] hover:bg-sunken"
          >
            <BagIcon />
            {cartCount > 0 ? (
              <span className="tabular absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-accent-ink">
                {cartCount}
              </span>
            ) : null}
          </Link>

          {user ? (
            /* Avatar tròn gom mọi lối vào tài khoản — trỏ vào hoặc bấm để mở. */
            <UserMenu user={user} />
          ) : (
            <>
              <Link to="/dang-nhap" className="rounded-control px-3 py-1.5 hover:bg-sunken">
                Đăng nhập
              </Link>
              <Link
                to="/dang-ky"
                className="rounded-control bg-accent px-4 py-2 font-semibold text-accent-ink transition-transform duration-[160ms] ease-snap active:scale-95"
              >
                Đăng ký
              </Link>
            </>
          )}

          <ThemeToggle />
        </div>

        {/* Khung tìm kiếm mở rộng nới rộng tràn header khi người dùng bấm kính lúp trên màn hình nhỏ */}
        {isSearchOpen ? (
          <div
            className="absolute inset-0 z-30 flex items-center bg-surface px-4 sm:hidden"
            onKeyDown={handleKeyDown}
          >
            <form onSubmit={submitSearch} className="relative flex w-full items-center gap-2">
              <div className="relative flex-1">
                <label htmlFor="header-search-expanded" className="sr-only">
                  Tìm sản phẩm
                </label>
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  ref={mobileInputRef}
                  id="header-search-expanded"
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Tìm áo, quần, phụ kiện…"
                  className="h-10 w-full rounded-control border border-line bg-sunken pr-4 pl-9 text-sm outline-none transition-colors duration-[160ms] placeholder:text-ink-muted focus:border-accent"
                />
              </div>
              <button
                type="button"
                aria-label="Đóng tìm kiếm"
                onClick={() => setIsSearchOpen(false)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors duration-[160ms] hover:bg-sunken hover:text-ink"
              >
                <XIcon className="size-5" />
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
