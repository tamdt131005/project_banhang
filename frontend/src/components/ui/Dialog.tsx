import { type ReactNode, useEffect, useRef } from 'react';
import { XIcon } from './icons';

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Hộp thoại nội dung tuỳ ý trên nền <dialog> gốc — cùng lý do với
 * ConfirmDialog: bẫy tiêu điểm, ::backdrop và phím Esc có sẵn, khỏi tự chế.
 */
export function Dialog({ open, title, onClose, children }: Readonly<DialogProps>) {
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
        onClose();
      }}
      /* Bấm ra vùng backdrop thì target chính là <dialog> — nội dung bên trong
         đã được bọc kín nên bấm trong hộp không bao giờ trúng target này. */
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="grid size-8 place-items-center rounded-full text-ink-muted transition-colors duration-[160ms] hover:bg-sunken hover:text-ink"
        >
          <XIcon />
        </button>
      </div>

      <div className="max-h-[70dvh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}
