import { formatVnd } from '../../lib/format';

export interface RevenueChartProps {
  series: { date: string; orders: number; revenue: number }[];
}

/** "2026-07-26" → "26/07" cho nhãn trục hoành. */
function shortDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

/**
 * Biểu đồ cột 7 ngày dựng bằng div — không kéo thư viện chart về cho một
 * biểu đồ duy nhất. Cột cao theo tỉ lệ phần trăm của ngày cao nhất; ngày
 * không có đơn vẫn giữ chỗ để trục hoành không bị lệch.
 */
export function RevenueChart({ series }: Readonly<RevenueChartProps>) {
  const max = Math.max(...series.map((point) => point.revenue), 1);
  const today = series.at(-1)?.date;

  return (
    <div className="flex h-40 items-end gap-2">
      {series.map((point) => {
        const percent = point.revenue === 0 ? 0 : Math.max(6, (point.revenue / max) * 100);
        const isToday = point.date === today;

        return (
          /* h-full là bắt buộc: hàng ngoài dùng items-end nên cột không tự
             giãn, thiếu nó thì phần trăm chiều cao của thanh tính trên 0. */
          <div key={point.date} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              {point.revenue === 0 ? (
                /* Ngày trống: một vạch mảnh thay vì khoảng trắng, để mắt vẫn
                   thấy cột đó tồn tại và hiểu là "không có đơn". */
                <div className="h-0.5 w-full rounded-t-control bg-line" />
              ) : (
                <div
                  style={{ height: `${percent}%` }}
                  title={`${shortDay(point.date)}: ${point.orders} đơn · ${formatVnd(point.revenue)}`}
                  className={`w-full rounded-t-control transition-colors duration-[160ms] ${
                    isToday ? 'bg-accent' : 'bg-accent/35 hover:bg-accent/60'
                  }`}
                />
              )}
            </div>
            <span
              className={`text-[0.625rem] whitespace-nowrap ${isToday ? 'font-semibold text-ink' : 'text-ink-muted'}`}
            >
              {shortDay(point.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
