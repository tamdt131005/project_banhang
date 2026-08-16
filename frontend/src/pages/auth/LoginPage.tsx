import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../lib/errors';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface LoginPageProps {}

export function LoginPage({}: Readonly<LoginPageProps>) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Quay lại đúng trang người dùng định vào trước khi bị chặn.
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setFields({});

    try {
      await login({ email, password });
      void navigate(from, { replace: true });
    } catch (error) {
      setMessage(errorMessage(error));
      setFields(fieldErrors(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục giỏ hàng đang dở và theo dõi đơn của bạn."
      imageSeed="tamdang-dang-nhap"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {message ? <Alert>{message}</Alert> : null}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          required
          value={email}
          error={fields['email']}
          onChange={(event) => setEmail(event.target.value)}
        />

        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          error={fields['password']}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={busy} className="mt-2 w-full">
          Đăng nhập
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Bạn chưa có tài khoản?{' '}
        <Link to="/dang-ky" className="font-semibold text-accent hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  );
}
