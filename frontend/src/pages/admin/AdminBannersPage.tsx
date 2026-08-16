import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { type BannerInput, adminGateway } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import {
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  XIcon,
} from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import type { ApiBanner } from '../../types/api';

export interface AdminBannersPageProps {}

const EMPTY: BannerInput = {
  name: '',
  altText: '',
  linkUrl: '',
  placement: 'HOME_HERO',
  sortOrder: 0,
  isActive: true,
};

export function AdminBannersPage({}: Readonly<AdminBannersPageProps>) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BannerInput>(EMPTY);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<ApiBanner | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const banners = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: () => adminGateway.banners.list().then((response) => response.banners),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    void queryClient.invalidateQueries({ queryKey: ['banners'] });
  };

  const create = useMutation({
    mutationFn: ({ input, file }: { input: BannerInput; file: File }) =>
      adminGateway.banners.create(input, file),
    onSuccess: () => {
      refresh();
      setForm(EMPTY);
      setImage(null);
      setIsCreating(false);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: BannerInput }) =>
      adminGateway.banners.update(id, input),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adminGateway.banners.setActive(id, isActive),
    onSuccess: refresh,
  });

  const replace = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      adminGateway.banners.replaceImage(id, file),
    onSuccess: refresh,
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImage(file);
    if (file && !form.name) {
      // Tự động gợi ý tên từ tệp
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setForm((prev) => ({ ...prev, name: cleanName, altText: cleanName }));
    }
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (image) {
      create.mutate({ input: form, file: image });
    }
  }

  const mutationError = create.error ?? update.error ?? toggle.error ?? replace.error;

  const bannerList = banners.data ?? [];
  const activeCount = bannerList.filter((b) => b.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header section with Stats & Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Quản lý Banner</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Tuỳ chỉnh các banner quảng cáo & khuyến mãi lớn xuất hiện ở đầu trang chủ (Hero Banner).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            title="Tải lại danh sách"
            className="inline-flex items-center gap-1.5"
          >
            <RefreshIcon className="size-3.5" />
            <span>Làm mới</span>
          </Button>

          {!isCreating && (
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 shadow-xs"
            >
              <PlusIcon className="size-3.5" />
              <span>Thêm banner mới</span>
            </Button>
          )}
        </div>
      </div>

      {/* Guide Note Box */}
      <div className="flex items-start gap-3 rounded-card border border-accent/25 bg-accent-soft/30 p-4 text-xs text-ink-muted">
        <InfoIcon className="size-4 shrink-0 text-accent mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-ink">Hướng dẫn cấu hình Banner chuẩn:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <strong>Kích thước đề xuất:</strong> 1920 × 600 px hoặc 16:9 tỷ lệ ngang, định dạng JPG/PNG/WebP/AVIF (hệ thống tự động tối ưu sang WebP).
            </li>
            <li>
              <strong>Thứ tự hiển thị:</strong> Banner có số thứ tự nhỏ hơn sẽ được ưu tiên hiển thị trước trong thanh trượt (Hero Carousel).
            </li>
            <li>
              <strong>Đường dẫn liên kết:</strong> Dùng đường dẫn nội bộ (vd: <code className="bg-sunken px-1 rounded font-mono">/san-pham</code>, <code className="bg-sunken px-1 rounded font-mono">/danh-muc/ao-nam</code>) hoặc link ngoài hợp lệ (<code className="bg-sunken px-1 rounded font-mono">https://...</code>).
            </li>
          </ul>
        </div>
      </div>

      {mutationError ? <Alert>{errorMessage(mutationError)}</Alert> : null}

      {/* Form Tạo Mới Banner (Collapsible Card) */}
      {isCreating && (
        <section
          aria-label="Thêm banner mới"
          className="rounded-card border-2 border-accent/40 bg-surface p-5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-ink text-xs font-bold">
                <PlusIcon className="size-4" />
              </span>
              <h2 className="font-semibold text-base text-ink">Thêm Banner quảng cáo mới</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setForm(EMPTY);
                setImage(null);
              }}
              className="text-ink-muted hover:text-ink transition"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Tên banner <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ví dụ: BST Thu Đông 2026, Giảm giá 50%..."
                  className="w-full h-10 rounded-control border border-line bg-sunken px-3 text-sm outline-none transition focus:border-accent focus:bg-surface"
                />
                <p className="text-[0.6875rem] text-ink-muted">Tên nhận diện banner trong quản trị.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Mô tả ảnh (Alt text) <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.altText}
                  onChange={(e) => setForm({ ...form, altText: e.target.value })}
                  placeholder="Mô tả nội dung ảnh cho SEO & người khiếm thị"
                  className="w-full h-10 rounded-control border border-line bg-sunken px-3 text-sm outline-none transition focus:border-accent focus:bg-surface"
                />
                <p className="text-[0.6875rem] text-ink-muted">Tối ưu trải nghiệm và khả năng tiếp cận.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">Liên kết khi click (Link URL)</label>
                <input
                  value={form.linkUrl ?? ''}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="/san-pham hoặc https://..."
                  className="w-full h-10 rounded-control border border-line bg-sunken px-3 text-sm outline-none transition focus:border-accent focus:bg-surface"
                />
                <p className="text-[0.6875rem] text-ink-muted">Để trống nếu banner chỉ xem không chuyển trang.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink">Vị trí hiển thị</label>
                  <select
                    value={form.placement}
                    onChange={(e) =>
                      setForm({ ...form, placement: e.target.value as BannerInput['placement'] })
                    }
                    className="w-full h-10 rounded-control border border-line bg-sunken px-3 text-sm outline-none focus:border-accent"
                  >
                    <option value="HOME_HERO">Đầu trang chủ (Hero)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full h-10 rounded-control border border-line bg-sunken px-3 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* File Upload Box */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink">
                Tệp hình ảnh banner <span className="text-red-500">*</span>
              </label>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-sunken/60 p-6 text-center transition cursor-pointer hover:border-accent hover:bg-accent-soft/20"
              >
                <input
                  ref={fileInputRef}
                  required
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                {imagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={imagePreview}
                      alt="Xem trước"
                      className="mx-auto max-h-48 rounded-lg object-cover shadow-sm border border-line"
                    />
                    <p className="text-xs font-medium text-accent">Nhấp vào đây để chọn ảnh khác ({image?.name})</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent group-hover:scale-105 transition">
                      <CameraIcon className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">Kéo thả hoặc nhấp để tải ảnh lên</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        Hỗ trợ PNG, JPG, WebP, AVIF. Đề xuất kích thước 1920 × 600 px.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="size-4 rounded text-accent focus:ring-accent"
                />
                <span>Kích hoạt và hiển thị ngay trên trang chủ</span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setForm(EMPTY);
                    setImage(null);
                  }}
                >
                  Huỷ
                </Button>
                <Button type="submit" loading={create.isPending} disabled={!image}>
                  Thêm banner
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Danh sách Banner hiện có */}
      <section aria-label="Danh sách banner hiện tại" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">
            Danh sách banner ({bannerList.length} banner · {activeCount} đang bật)
          </h2>
        </div>

        {banners.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : banners.isError ? (
          <Alert>{errorMessage(banners.error)}</Alert>
        ) : bannerList.length === 0 ? (
          <EmptyState
            title="Chưa có banner nào"
            description="Hãy nhấn 'Thêm banner mới' để đăng banner quảng bá sản phẩm lên đầu trang chủ."
            icon={<CameraIcon className="size-8" />}
          />
        ) : (
          <div className="grid gap-4">
            {bannerList.map((banner) => {
              const draft = editing?.id === banner.id ? editing : null;

              return (
                <article
                  key={banner.id}
                  className={`overflow-hidden rounded-card border transition-all duration-200 ${
                    banner.isActive
                      ? 'border-line bg-surface shadow-xs'
                      : 'border-line/60 bg-sunken/40 opacity-75'
                  }`}
                >
                  {draft ? (
                    /* Inline Editing Form */
                    <form
                      className="p-5 space-y-4 bg-accent-soft/10"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const input: BannerInput = {
                          name: draft.name.trim(),
                          altText: draft.altText.trim(),
                          linkUrl: draft.linkUrl?.trim() || null,
                          placement: draft.placement,
                          sortOrder: draft.sortOrder,
                          isActive: draft.isActive,
                        };
                        update.mutate({ id: banner.id, input });
                      }}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-line">
                        <span className="font-semibold text-sm">Chỉnh sửa Banner #{banner.id}</span>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(null)}>
                          Đóng
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-ink">Tên banner</label>
                          <input
                            required
                            value={draft.name}
                            onChange={(e) => setEditing({ ...draft, name: e.target.value })}
                            className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-ink">Mô tả ảnh (Alt text)</label>
                          <input
                            required
                            value={draft.altText}
                            onChange={(e) => setEditing({ ...draft, altText: e.target.value })}
                            className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-ink">Liên kết (Link URL)</label>
                          <input
                            value={draft.linkUrl ?? ''}
                            onChange={(e) => setEditing({ ...draft, linkUrl: e.target.value })}
                            placeholder="/san-pham hoặc https://..."
                            className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-ink">Thứ tự hiển thị</label>
                          <input
                            type="number"
                            min="0"
                            value={draft.sortOrder}
                            onChange={(e) =>
                              setEditing({ ...draft, sortOrder: Number(e.target.value) })
                            }
                            className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-ink">Vị trí</label>
                          <select
                            value={draft.placement}
                            onChange={(e) =>
                              setEditing({
                                ...draft,
                                placement: e.target.value as ApiBanner['placement'],
                              })
                            }
                            className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
                          >
                            <option value="HOME_HERO">Đầu trang chủ</option>
                          </select>
                        </div>

                        <div className="flex items-end pb-1">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draft.isActive}
                              onChange={(e) => setEditing({ ...draft, isActive: e.target.checked })}
                              className="size-4 rounded text-accent"
                            />
                            <span>Đang kích hoạt</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-line">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditing(null)}
                        >
                          Huỷ bỏ
                        </Button>
                        <Button type="submit" size="sm" loading={update.isPending}>
                          <CheckIcon className="size-3.5" />
                          <span>Lưu thay đổi</span>
                        </Button>
                      </div>
                    </form>
                  ) : (
                    /* Display View Card */
                    <div className="grid gap-4 p-4 md:grid-cols-[260px_1fr_auto] items-center">
                      <div className="relative aspect-[16/7] w-full overflow-hidden rounded-control bg-sunken border border-line">
                        <img
                          src={banner.imageUrl}
                          alt={banner.altText}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                        <span
                          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.625rem] font-bold shadow-xs ${
                            banner.isActive
                              ? 'bg-emerald-500 text-white'
                              : 'bg-neutral-800/80 text-neutral-300'
                          }`}
                        >
                          {banner.isActive ? 'Đang hiển thị' : 'Đã tắt'}
                        </span>
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base text-ink truncate">{banner.name}</h3>
                          <span className="rounded-control bg-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-muted">
                            Thứ tự: {banner.sortOrder}
                          </span>
                        </div>

                        <p className="text-xs text-ink-muted leading-relaxed">
                          <strong>Mô tả ảnh:</strong> {banner.altText}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted pt-1">
                          <p className="truncate max-w-sm">
                            <span className="font-medium text-ink">Liên kết:</span>{' '}
                            {banner.linkUrl ? (
                              <span className="text-accent font-medium">{banner.linkUrl}</span>
                            ) : (
                              <span className="text-ink-muted/70 italic">Không chuyển trang</span>
                            )}
                          </p>
                          <p>
                            <span className="font-medium text-ink">Cập nhật:</span>{' '}
                            {formatDateTime(banner.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-line pt-3 md:pt-0 md:pl-4">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditing(banner)}
                          className="inline-flex items-center justify-center gap-1 flex-1 md:flex-initial"
                        >
                          <PencilIcon className="size-3.5" />
                          <span>Chỉnh sửa</span>
                        </Button>

                        <Button
                          size="sm"
                          variant={banner.isActive ? 'secondary' : 'primary'}
                          loading={toggle.isPending}
                          onClick={() => toggle.mutate({ id: banner.id, isActive: !banner.isActive })}
                          className="inline-flex items-center justify-center gap-1 flex-1 md:flex-initial"
                        >
                          <span>{banner.isActive ? 'Tắt hiển thị' : 'Bật hiển thị'}</span>
                        </Button>

                        <label className="inline-flex items-center justify-center gap-1 cursor-pointer rounded-control border border-line bg-surface hover:bg-sunken px-3 py-1.5 text-center text-xs font-medium text-ink transition flex-1 md:flex-initial">
                          <CameraIcon className="size-3.5 text-ink-muted" />
                          <span>Đổi ảnh</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) replace.mutate({ id: banner.id, file });
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
