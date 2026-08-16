import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../lib/errors';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface RegisterPageProps {}

export function RegisterPage({}: Readonly<RegisterPageProps>) {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form) {
    return (event: { target: { value: string } }) => {
      setForm((previous) => ({ ...previous, [key]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setFields({});

    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        // Số điện thoại không bắt buộc — gửi chuỗi rỗng sẽ trượt regex ở backend.
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      void navigate('/', { replace: true });
    } catch (error) {
      setMessage(errorMessage(error));
      setFields(fieldErrors(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      subtitle="Đăng ký để lưu giỏ hàng, quản lý địa chỉ giao và theo dõi đơn."
      imageSeed="tamdang-dang-ky"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {message ? <Alert>{message}</Alert> : null}

        <TextField
          label="Họ và tên"
          required
          autoComplete="name"
          value={form.fullName}
          error={fields['fullName']}
          onChange={update('fullName')}
        />

        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          error={fields['email']}
          onChange={update('email')}
        />

        <TextField
          label="Số điện thoại"
          hint="Không bắt buộc. Gồm 10 chữ số, bắt đầu bằng 0."
          inputMode="numeric"
          autoComplete="tel"
          value={form.phone}
          error={fields['phone']}
          onChange={update('phone')}
        />

        <TextField
          label="Mật khẩu"
          type="password"
          required
          autoComplete="new-password"
          hint="Ít nhất 8 ký tự."
          value={form.password}
          error={fields['password']}
          onChange={update('password')}
        />

        <Button type="submit" loading={busy} className="mt-2 w-full">
          Đăng ký
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Đã có tài khoản?{' '}
        <Link to="/dang-nhap" className="font-semibold text-accent hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
