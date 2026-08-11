import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { AlertCircleIcon } from './icons';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dùng <dialog> gốc của trình duyệt thay vì tự dựng lớp phủ: nó cho sẵn bẫy
 * tiêu điểm bàn phím, lớp ::backdrop và phím Esc — ba thứ rất dễ làm sai khi
 * viết tay.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-5 text-ink backdrop:bg-black/40"
    >
      <div className="flex items-start gap-3">
        {danger ? (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
          >
            <AlertCircleIcon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="mt-1.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Huỷ
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          size="sm"
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
