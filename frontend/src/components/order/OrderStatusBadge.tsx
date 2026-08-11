import type { ReactNode } from 'react';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL, type OrderStatus } from '../../lib/format';
import { BoxIcon, CheckIcon, ClockIcon, TruckIcon, XIcon } from '../ui/icons';

export interface OrderStatusBadgeProps {
  status: OrderStatus;
}

/** Icon theo nghĩa từng trạng thái — cùng bảng màu với ORDER_STATUS_CLASS. */
const STATUS_ICON: Record<OrderStatus, ReactNode> = {
  PENDING: <ClockIcon className="size-3" />,
  CONFIRMED: <BoxIcon className="size-3" />,
  SHIPPING: <TruckIcon className="size-3" />,
  DELIVERED: <CheckIcon className="size-3" />,
  CANCELLED: <XIcon className="size-3" />,
};

export function OrderStatusBadge({ status }: Readonly<OrderStatusBadgeProps>) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_CLASS[status]}`}
    >
      {STATUS_ICON[status]}
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
