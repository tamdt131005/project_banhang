import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-sunken',
  ghost: 'text-accent hover:bg-accent-soft',
  danger: 'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950',
};

const SIZE: Record<ButtonSize, string> = {
  // Cao tối thiểu 44px trên di động theo quy tắc vùng chạm của DESIGN.md.
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Readonly<ButtonProps>) {
  return (
    <button
      // Mặc định "button": trong form, thiếu type sẽ thành submit và gửi form
      // ngoài ý muốn khi bấm những nút phụ như "Xoá" hay "Huỷ".
      type="button"
      disabled={disabled === true || loading}
      /* Góc vuông 4px kiểu sàn TMĐT (người dùng chọn bỏ pill).
         Chỉ animate transform — quy tắc chống lag số 1. */
      className={`inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-transform duration-[160ms] ease-snap active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? 'Đang xử lý…' : children}
    </button>
  );
}
