import { useMutation } from '@tanstack/react-query';
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { CameraIcon, TrashIcon } from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../lib/errors';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface ProfilePageProps {}

/** Trùng hàng rào phía backend (middleware/upload.ts) để lỗi hiện ngay không tốn request. */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_AVATAR_MB = 5;

export function ProfilePage({}: Readonly<ProfilePageProps>) {
  const { user, isAdmin, updateProfile, uploadAvatar, removeAvatar } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saved, setSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarNotice, setAvatarNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(
    null,
  );

  const save = useMutation({
    mutationFn: () =>
      updateProfile({
        fullName: fullName.trim(),
        // Chuỗi rỗng nghĩa là muốn xoá số — backend hiểu null là xoá.
        phone: phone.trim() === '' ? null : phone.trim(),
      }),
    onSuccess: () => setSaved(true),
  });

  const changeAvatar = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => setAvatarNotice({ tone: 'success', text: 'Đã cập nhật ảnh đại diện.' }),
    onError: (error) => setAvatarNotice({ tone: 'error', text: errorMessage(error) }),
  });

  const clearAvatar = useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: () => setAvatarNotice({ tone: 'success', text: 'Đã xoá ảnh đại diện.' }),
    onError: (error) => setAvatarNotice({ tone: 'error', text: errorMessage(error) }),
  });

  if (!user) return null;

  function pickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset để chọn lại đúng tệp cũ vẫn kích hoạt onChange lần nữa.
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setAvatarNotice({ tone: 'error', text: 'Chỉ nhận ảnh JPEG, PNG, WebP hoặc AVIF.' });
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setAvatarNotice({ tone: 'error', text: `Ảnh tối đa ${MAX_AVATAR_MB}MB.` });
      return;
    }

    setAvatarNotice(null);
    changeAvatar.mutate(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    save.mutate();
  }

  const errors = fieldErrors(save.error);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold">Hồ sơ của tôi</h1>
          {isAdmin ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
              Quản trị viên
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Quản lý thông tin cá nhân để việc đặt hàng nhanh và chính xác hơn.
        </p>
      </div>

      <section className="max-w-lg space-y-3 rounded-card border border-line bg-surface p-5">
        {avatarNotice ? <Alert tone={avatarNotice.tone}>{avatarNotice.text}</Alert> : null}

        <div className="flex items-center gap-4">
          <Avatar name={user.fullName} src={user.avatarUrl} size="xl" />

          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                loading={changeAvatar.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <CameraIcon className="size-3.5" />
                {user.avatarUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
              </Button>

              {user.avatarUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={clearAvatar.isPending}
                  onClick={() => {
                    setAvatarNotice(null);
                    clearAvatar.mutate();
                  }}
                >
                  <TrashIcon className="size-3.5" />
                  Xoá ảnh
                </Button>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              JPEG, PNG, WebP hoặc AVIF, tối đa {MAX_AVATAR_MB}MB. Ảnh được cắt vuông tự động.
            </p>
          </div>

          {/* Input file thật nằm ẩn — nút "Chọn ảnh" bấm hộ để giao diện đồng bộ. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={pickAvatar}
            aria-label="Chọn ảnh đại diện"
            className="sr-only"
          />
        </div>
      </section>

      <form onSubmit={submit} className="max-w-lg space-y-4 rounded-card border border-line bg-surface p-5">
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        {saved && !save.isError ? <Alert tone="success">Đã lưu thông tin hồ sơ.</Alert> : null}

        <TextField
          label="Email"
          value={user.email}
          disabled
          hint="Email dùng để đăng nhập nên không thay đổi được."
        />

        <TextField
          label="Họ và tên"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={errors.fullName}
          autoComplete="name"
        />

        <TextField
          label="Số điện thoại"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={errors.phone}
          hint="10 chữ số, bắt đầu bằng 0. Để trống nếu chưa muốn lưu."
          autoComplete="tel"
          inputMode="numeric"
        />

        <Button type="submit" loading={save.isPending}>
          Lưu thay đổi
        </Button>
      </form>
    </div>
  );
}
