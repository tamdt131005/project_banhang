import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../lib/errors';

export function AdminAccountPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(new Error('Mật khẩu xác nhận chưa khớp.'));
      return;
    }
    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      void navigate('/dang-nhap', { replace: true });
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  const fields = fieldErrors(error);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tài khoản & mật khẩu</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Đổi mật khẩu ban đầu do chủ shop cung cấp. Sau khi đổi, bạn cần đăng nhập lại.
        </p>
      </div>

      <section className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-xs">
        <Avatar name={user.fullName} src={user.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.fullName}</p>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
          <p className="text-xs text-accent">{user.role === 'ADMIN' ? 'Chủ shop' : 'Nhân viên'}</p>
        </div>
      </section>

      <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-xs sm:p-5">
        <h2 className="font-semibold">Đổi mật khẩu</h2>
        {error ? <Alert>{errorMessage(error)}</Alert> : null}
        <TextField
          label="Mật khẩu hiện tại"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          error={fields.currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <TextField
          label="Mật khẩu mới"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          error={fields.newPassword}
          hint="Ít nhất 8 ký tự."
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <TextField
          label="Nhập lại mật khẩu mới"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <Button type="submit" loading={busy}>Lưu mật khẩu mới</Button>
      </form>
    </div>
  );
}
