import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * Rút gọn dãy trang thành dạng 1 … 4 5 6 … 20.
 * Luôn hiện trang đầu, trang cuối và một trang liền kề mỗi bên, để dãy nút
 * không dài ra vô hạn khi danh mục có hàng trăm trang.
 */
function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const visible = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  const result: (number | 'gap')[] = [];
  let previous = 0;
  for (const value of visible) {
    if (previous > 0 && value - previous > 1) result.push('gap');
    result.push(value);
    previous = value;
  }
  return result;
}

export function Pagination({ page, totalPages, onChange }: Readonly<PaginationProps>) {
  if (totalPages <= 1) return null;

  const items = pageWindow(page, totalPages);

  return (
    <nav aria-label="Phân trang" className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Trang trước"
        className="grid size-9 place-items-center rounded-control border border-line transition-colors duration-[160ms] hover:bg-sunken disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronLeftIcon className="size-3.5" />
      </button>

      {items.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-ink-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={`h-9 min-w-9 rounded-control border px-2 text-xs font-medium transition-transform duration-[160ms] ease-snap active:translate-y-px ${
              item === page
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line hover:bg-sunken'
            }`}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Trang sau"
        className="grid size-9 place-items-center rounded-control border border-line transition-colors duration-[160ms] hover:bg-sunken disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronRightIcon className="size-3.5" />
      </button>
    </nav>
  );
}
