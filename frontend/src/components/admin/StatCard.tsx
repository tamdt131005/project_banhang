import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface StatCardProps {
  label: string;
  value: string;
  /** Dòng phụ giải thích con số đến từ đâu — tránh chỉ số treo lơ lửng. */
  hint?: string;
  icon: ReactNode;
  /** Cặp màu nền/chữ cho ô icon, theo khuôn ORDER_STATUS_CLASS. */
  tone?: string;
  /** Bấm vào thẻ đi thẳng tới trang xử lý con số đó. */
  to?: string;
}

/**
 * Ô số liệu của trang tổng quan. Con số là nhân vật chính nên để cỡ lớn,
 * nhãn và ghi chú vây quanh ở cỡ nhỏ — không dùng bóng đổ màu hay kính mờ
 * (backdrop-filter tốn GPU, DESIGN.md cấm ở vùng cuộn).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'bg-accent-soft text-accent',
  to,
}: Readonly<StatCardProps>) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-muted">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-control ${tone}`}>
          {icon}
        </span>
      </div>
      <p className="tabular mt-3 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </>
  );

  const className = 'block rounded-card border border-line bg-surface p-4';

  if (to) {
    return (
      <Link
        to={to}
        className={`${className} transition-[transform,box-shadow] duration-[160ms] ease-snap hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgb(0_0_0/0.08)]`}
      >
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
