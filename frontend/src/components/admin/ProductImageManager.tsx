import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, type DragEvent, useState } from 'react';
import { adminGateway } from '../../api/admin';
import { errorMessage } from '../../lib/errors';
import type { ApiProductImage } from '../../types/api';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Alert } from '../ui/Feedback';
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, StarIcon, TrashIcon } from '../ui/icons';

export interface ProductImageManagerProps {
  productId: number;
  images: ApiProductImage[];
}

/** Trùng hàng rào phía backend để báo lỗi ngay, không tốn một vòng request. */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_MB = 5;
const MAX_PER_UPLOAD = 6;

/**
 * Khu ảnh sản phẩm: kéo thả hoặc chọn tệp, xem trước trước khi tải lên, đổi
 * thứ tự và chọn ảnh bìa. Ảnh ĐẦU TIÊN là ảnh bìa — chính là ảnh mà lưới sản
 * phẩm, giỏ hàng và đơn hàng lấy ra, nên phải chỉnh được thứ tự.
 */
export function ProductImageManager({ productId, images }: Readonly<ProductImageManagerProps>) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ApiProductImage | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const upload = useMutation({
    mutationFn: () => adminGateway.products.uploadImages(productId, files),
    onSuccess: () => {
      invalidate();
      setFiles([]);
    },
  });

  const reorder = useMutation({
    mutationFn: (imageIds: number[]) => adminGateway.products.reorderImages(productId, imageIds),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (imageId: number) => adminGateway.products.removeImage(imageId),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
  });

  /** Lọc tệp hợp lệ và báo rõ tệp nào bị loại vì lý do gì. */
  function acceptFiles(incoming: File[]) {
    setLocalError(null);

    const rejected: string[] = [];
    const accepted = incoming.filter((file) => {
      if (!ALLOWED_TYPES.has(file.type)) {
        rejected.push(`${file.name} (không phải ảnh hợp lệ)`);
        return false;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        rejected.push(`${file.name} (quá ${MAX_MB}MB)`);
        return false;
      }
      return true;
    });

    if (rejected.length > 0) setLocalError(`Bỏ qua: ${rejected.join(', ')}.`);
    if (accepted.length === 0) return;

    setFiles((previous) => {
      const merged = [...previous, ...accepted];
      if (merged.length > MAX_PER_UPLOAD) {
        setLocalError(`Mỗi lần tải tối đa ${MAX_PER_UPLOAD} ảnh.`);
        return merged.slice(0, MAX_PER_UPLOAD);
      }
      return merged;
    });
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    acceptFiles([...(event.target.files ?? [])]);
    // Reset để chọn lại đúng tệp vừa bỏ ra vẫn kích hoạt onChange.
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    acceptFiles([...event.dataTransfer.files]);
  }

  /** Đổi chỗ hai ảnh liền kề rồi gửi nguyên bộ thứ tự mới lên server. */
  function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorder.mutate(next.map((image) => image.id));
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const picked = images[index]!;
    reorder.mutate([picked.id, ...images.filter((image) => image.id !== picked.id).map((i) => i.id)]);
  }

  return (
    <section className="space-y-3 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Ảnh sản phẩm</h2>
        <p className="text-xs text-ink-muted">
          {images.length > 0 ? `${images.length} ảnh · ảnh đầu tiên là ảnh bìa` : 'Chưa có ảnh nào'}
        </p>
      </div>

      {localError ? <Alert>{localError}</Alert> : null}
      {upload.isError ? <Alert>{errorMessage(upload.error)}</Alert> : null}
      {reorder.isError ? <Alert>{errorMessage(reorder.error)}</Alert> : null}
      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className={`overflow-hidden rounded-control border bg-sunken ${
                index === 0 ? 'border-accent' : 'border-line'
              }`}
            >
              <div className="relative aspect-[4/5]">
                <img
                  src={image.thumbUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-control bg-accent px-1.5 py-0.5 text-[0.625rem] font-bold text-accent-ink">
                    <StarIcon className="size-3" />
                    Ảnh bìa
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-1 border-t border-line bg-surface p-1.5">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorder.isPending}
                    aria-label="Chuyển lên trước"
                    className="grid size-7 place-items-center rounded-control text-ink-muted transition-colors duration-[160ms] hover:bg-sunken hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeftIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1 || reorder.isPending}
                    aria-label="Chuyển xuống sau"
                    className="grid size-7 place-items-center rounded-control text-ink-muted transition-colors duration-[160ms] hover:bg-sunken hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronRightIcon className="size-3.5" />
                  </button>
                </div>

                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    disabled={index === 0 || reorder.isPending}
                    aria-label="Đặt làm ảnh bìa"
                    title="Đặt làm ảnh bìa"
                    className="grid size-7 place-items-center rounded-control text-ink-muted transition-colors duration-[160ms] hover:bg-accent-soft hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <StarIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(image)}
                    aria-label="Xoá ảnh"
                    className="grid size-7 place-items-center rounded-control text-ink-muted transition-colors duration-[160ms] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Vùng kéo thả — vẫn là <label> bọc input thật nên bàn phím dùng được. */}
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-control border-2 border-dashed p-6 text-center transition-colors duration-[160ms] ${
          dragOver ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken'
        }`}
      >
        <CameraIcon className="size-6 text-ink-muted" />
        <span className="text-sm font-medium">Kéo ảnh vào đây hoặc bấm để chọn</span>
        <span className="text-xs text-ink-muted">
          JPEG, PNG, WebP, AVIF · tối đa {MAX_MB}MB mỗi ảnh · {MAX_PER_UPLOAD} ảnh mỗi lần
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          onChange={onPick}
          className="sr-only"
        />
      </label>

      {files.length > 0 ? (
        <div className="space-y-2 rounded-control border border-line bg-sunken p-3">
          <p className="text-xs font-medium">Sẽ tải lên {files.length} ảnh:</p>
          <ul className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="relative">
                {/* Xem trước bằng blob URL — không tốn request nào. */}
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="size-16 rounded-control border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFiles((rows) => rows.filter((_, i) => i !== index))}
                  aria-label={`Bỏ ${file.name}`}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-red-600 text-white"
                >
                  <TrashIcon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button size="sm" loading={upload.isPending} onClick={() => upload.mutate()}>
              Tải lên {files.length} ảnh
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setFiles([])}>
              Bỏ hết
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-ink-muted">
        Hệ thống tự nén về WebP và sinh sẵn bản 400×500 cho lưới sản phẩm.
      </p>

      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Xoá ảnh này?"
        description="Ảnh sẽ bị xoá khỏi ổ đĩa và không khôi phục được."
        confirmLabel="Xoá ảnh"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
