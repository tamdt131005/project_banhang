import { MinusIcon, PlusIcon } from './icons';

export interface QuantityStepperProps {
  value: number;
  /** Trần theo tồn kho — nút + tự khoá khi chạm mức này. */
  max: number;
  min?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Tên cho trình đọc màn hình, ví dụ "Số lượng Áo thun nam". */
  label: string;
  onChange: (next: number) => void;
}

/**
 * Ô số lượng kiểu − / + quen tay như các sàn TMĐT: bấm để tăng giảm từng
 * đơn vị, vẫn gõ số trực tiếp được. Giá trị luôn bị kẹp trong [min, max]
 * nên nơi dùng không phải tự kiểm tra tồn kho lần nữa.
 */
export function QuantityStepper({
  value,
  max,
  min = 1,
  disabled = false,
  size = 'md',
  label,
  onChange,
}: Readonly<QuantityStepperProps>) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  const buttonClass = `grid ${size === 'sm' ? 'size-9' : 'size-11'} shrink-0 place-items-center text-ink-muted transition-colors duration-[160ms] hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`;

  return (
    <div
      className={`inline-flex items-center overflow-hidden rounded-control border border-line bg-sunken ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <button
        type="button"
        aria-label={`Giảm ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={buttonClass}
      >
        <MinusIcon />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isNaN(next) ? min : clamp(next));
        }}
        /* Ẩn spinner mặc định của trình duyệt — đã có nút − / + riêng. */
        className="tabular w-9 [appearance:textfield] border-0 bg-transparent text-center text-sm outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        aria-label={`Tăng ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={buttonClass}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
