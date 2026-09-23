import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../lib/errors';

export function ForgotPasswordPage() {
  const { requestPasswordResetOtp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestOtp() {
    setRequestBusy(true);
    setMessage(null);
    setFields({});
    try {
      const result = await requestPasswordResetOtp(email);
      setOtpSent(true);
      setOtp('');
      setCooldown(result.retryAfterSeconds);
      setMessage(result.message);
      setMessageTone('success');
    } catch (error) {
      setMessage(errorMessage(error));
      setFields(fieldErrors(error));
      setMessageTone('error');
    } finally {
      setRequestBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setFields({});
    if (!otpSent) {
      setMessage('Hãy yêu cầu mã xác nhận trước.');
      setMessageTone('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Mật khẩu xác nhận chưa khớp.');
      setMessageTone('error');
      return;
    }

    setBusy(true);
    try {
      await resetPassword({ email, otp, newPassword });
      setComplete(true);
      setMessageTone('success');
    } catch (error) {
      setMessage(errorMessage(error));
      setFields(fieldErrors(error));
      setMessageTone('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={complete ? 'Mật khẩu đã được đặt lại' : 'Quên mật khẩu?'}
      subtitle={complete
        ? 'Bạn có thể đăng nhập bằng mật khẩu mới.'
        : 'Nhập email để nhận mã xác nhận và tạo mật khẩu mới.'}
      imageSeed="tamdang-quen-mat-khau"
    >
      {message ? <div className="mb-4"><Alert tone={messageTone}>{message}</Alert></div> : null}

      {complete ? (
        <Link
          to="/dang-nhap"
          className="inline-flex h-11 w-full items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Quay lại đăng nhập
        </Link>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            error={fields['email']}
            onChange={(event) => {
              setEmail(event.target.value);
              setOtpSent(false);
              setOtp('');
              setCooldown(0);
            }}
          />
          <Button
            variant="secondary"
            className="w-full"
            loading={requestBusy}
            disabled={requestBusy || cooldown > 0 || !email.trim()}
            onClick={() => void requestOtp()}
          >
            {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : otpSent ? 'Gửi lại mã xác nhận' : 'Gửi mã xác nhận'}
          </Button>

          {otpSent ? (
            <>
              <TextField
                label="Mã xác nhận"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                error={fields['otp']}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <TextField
                label="Mật khẩu mới"
                type="password"
                required
                autoComplete="new-password"
                hint="Ít nhất 8 ký tự."
                value={newPassword}
                error={fields['newPassword']}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <TextField
                label="Nhập lại mật khẩu mới"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <Button type="submit" loading={busy} className="w-full">
                Đặt lại mật khẩu
              </Button>
            </>
          ) : null}
        </form>
      )}

      {!complete ? (
        <p className="mt-8 text-center text-sm text-ink-muted">
          Nhớ mật khẩu rồi?{' '}
          <Link to="/dang-nhap" className="font-semibold text-accent hover:underline">Đăng nhập</Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
