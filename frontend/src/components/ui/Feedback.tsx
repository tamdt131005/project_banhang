import type { ReactNode } from 'react';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from './icons';

export type AlertTone = 'error' | 'info' | 'success';

export interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
}

const TONE: Record<AlertTone, string> = {
  error: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  info: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  success:
    'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300',
};

const TONE_ICON: Record<AlertTone, ReactNode> = {
  error: <AlertCircleIcon />,
  info: <InfoIcon />,
  success: <CheckCircleIcon />,
};

export function Alert({ tone = 'error', children }: Readonly<AlertProps>) {
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${TONE[tone]}`}>
      {/* mt-0.5 để icon 16px thẳng hàng với dòng chữ đầu (line-height 20px). */}
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {TONE_ICON[tone]}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Icon minh hoạ trong vòng tròn — truyền cỡ size-6 cho cân. */
  icon?: ReactNode;
  action?: ReactNode;
}

/** Trạng thái rỗng phải chỉ ra bước tiếp theo, không chỉ nói "không có dữ liệu". */
export function EmptyState({ title, description, icon, action }: Readonly<EmptyStateProps>) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-sunken text-ink-muted" aria-hidden="true">
        {icon}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export interface SkeletonProps {
  className?: string;
}

/** Khung xương đúng kích thước nội dung thật — DESIGN.md cấm vòng xoay tròn. */
export function Skeleton({ className = '' }: Readonly<SkeletonProps>) {
  return <div className={`animate-pulse rounded bg-sunken ${className}`} aria-hidden="true" />;
}
