export interface AvatarProps {
  name: string;
  /** Ảnh đại diện đã upload; không có thì rơi về chữ viết tắt. */
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'size-9 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
};

/**
 * Chữ cái đầu của từ đầu và từ cuối: "Nguyễn Văn An" → "NA".
 * Tên tiếng Việt đặt tên gọi ở cuối nên lấy cả hai đầu mới đủ nhận ra người.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? '?';
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : '';
  return (first + last).toLocaleUpperCase('vi');
}

/**
 * Có ảnh thì dùng ảnh người dùng tự tải lên; chưa có thì là chữ viết tắt trên
 * nền màu nhấn — không dùng ảnh giả lập (DESIGN.md cấm nội dung bịa).
 */
export function Avatar({ name, src, size = 'md', className = '' }: Readonly<AvatarProps>) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={`shrink-0 rounded-full object-cover ${SIZE[size]} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 select-none place-items-center rounded-full bg-accent font-bold text-accent-ink ${SIZE[size]} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
