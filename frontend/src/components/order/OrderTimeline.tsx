import type { ReactNode } from 'react';
import type { ApiOrderStatusHistory } from '../../types/api';
import { ORDER_STATUS_LABEL, formatDateTime, type OrderStatus } from '../../lib/format';
import { BoxIcon, CheckIcon, ClockIcon, TruckIcon, XIcon } from '../ui/icons';

export interface OrderTimelineProps {
  status: OrderStatus;
  statusHistory?: ApiOrderStatusHistory[];
}

/** Bốn chặng theo đúng máy trạng thái của backend — không bịa thêm bước. */
const STEPS: { status: OrderStatus; icon: ReactNode }[] = [
  { status: 'PENDING', icon: <ClockIcon className="size-4" /> },
  { status: 'CONFIRMED', icon: <BoxIcon className="size-4" /> },
  { status: 'SHIPPING', icon: <TruckIcon className="size-4" /> },
  { status: 'DELIVERED', icon: <CheckIcon className="size-4" /> },
];

const STATUS_ICON: Record<OrderStatus, ReactNode> = {
  PENDING: <ClockIcon className="size-4" />,
  CONFIRMED: <BoxIcon className="size-4" />,
  SHIPPING: <TruckIcon className="size-4" />,
  DELIVERED: <CheckIcon className="size-4" />,
  CANCELLED: <XIcon className="size-4" />,
};

const ACTOR_LABEL: Record<ApiOrderStatusHistory['actorType'], string> = {
  CUSTOMER: 'Khách hàng',
  ADMIN: 'Nhân viên',
  SYSTEM: 'Hệ thống',
};

function eventTitle(event: ApiOrderStatusHistory): string {
  if (event.type === 'BASELINE') {
    return `Trạng thái khi nâng cấp: ${ORDER_STATUS_LABEL[event.toStatus]}`;
  }

  if (event.type === 'CREATED' || event.fromStatus === null) {
    return `Đơn hàng được tạo: ${ORDER_STATUS_LABEL[event.toStatus]}`;
  }

  return `${ORDER_STATUS_LABEL[event.fromStatus]} → ${ORDER_STATUS_LABEL[event.toStatus]}`;
}

function eventTime(event: ApiOrderStatusHistory): string {
  if (event.type === 'BASELINE' || event.occurredAt === null) {
    return `Dữ liệu chuyển đổi — không rõ thời điểm xảy ra · ghi nhận ${formatDateTime(event.recordedAt)}`;
  }

  return formatDateTime(event.occurredAt);
}

/** Fallback cho payload danh sách/cũ không tải lịch sử; không dựng mốc thời gian giả. */
function CurrentStatusFallback({ status }: Readonly<{ status: OrderStatus }>) {
  if (status === 'CANCELLED') {
    return (
      <section className="rounded-card border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-100 dark:bg-red-900/60">
            <XIcon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Đơn hàng đã huỷ</p>
            <p className="mt-0.5 text-xs opacity-80">Chưa có dữ liệu các mốc trạng thái.</p>
          </div>
        </div>
      </section>
    );
  }

  const activeIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <section aria-label="Trạng thái hiện tại của đơn hàng" className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <p className="mb-3 text-xs text-ink-muted">Chưa có dữ liệu các mốc trạng thái.</p>
      <ol className="flex">
        {STEPS.map((step, index) => {
          const reached = index <= activeIndex;
          return (
            <li key={step.status} className="relative flex flex-1 flex-col items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-[17px] right-1/2 left-[-50%] h-0.5 ${
                    reached ? 'bg-accent' : 'bg-line'
                  }`}
                />
              ) : null}

              <span
                className={`relative z-10 grid size-9 place-items-center rounded-full border-2 ${
                  reached
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line bg-surface text-ink-muted'
                }`}
              >
                {step.icon}
              </span>

              <span
                className={`px-1 text-center text-xs ${
                  reached ? 'font-medium text-ink' : 'text-ink-muted'
                }`}
              >
                {ORDER_STATUS_LABEL[step.status]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Hiển thị đúng các mốc do backend ghi nhận. Dữ liệu baseline được gọi rõ là
 * dữ liệu chuyển đổi và không suy đoán thời điểm xảy ra từ `updatedAt`.
 */
export function OrderTimeline({ status, statusHistory }: Readonly<OrderTimelineProps>) {
  if (!statusHistory || statusHistory.length === 0) {
    return <CurrentStatusFallback status={status} />;
  }

  return (
    <section aria-label="Lịch sử trạng thái đơn hàng" className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <h2 className="font-semibold">Lịch sử trạng thái</h2>
      <ol className="mt-4 space-y-0">
        {statusHistory.map((event, index) => {
          const cancelled = event.toStatus === 'CANCELLED';
          return (
            <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < statusHistory.length - 1 ? (
                <span aria-hidden="true" className="absolute top-8 bottom-0 left-[15px] w-px bg-line" />
              ) : null}
              <span
                className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border ${
                  cancelled
                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
                    : 'border-accent bg-accent-soft text-accent'
                }`}
              >
                {STATUS_ICON[event.toStatus]}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium">{eventTitle(event)}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{eventTime(event)}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {ACTOR_LABEL[event.actorType]}
                  {event.reason ? ` · ${event.reason}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
