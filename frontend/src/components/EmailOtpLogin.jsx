import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerApi } from '../api/client';
import { authDestination } from '../utils/auth-route';
import { AuthLayout } from './AuthLayout';
import { Icon } from './Icon';
import { ErrorBox, useAction } from './ui';

export function EmailOtpLogin() {
  const navigate = useNavigate();
  const client = customerApi;
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [error, setError] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const otpInput = useRef(null);
  const [busy, run] = useAction();
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  useEffect(() => {
    if (step !== 'otp') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    otpInput.current?.focus();
    return () => clearInterval(timer);
  }, [step]);

  const attempt = async fn => {
    if (pending.current) return undefined;
    pending.current = true;
    setError(null);
    try {
      return await run(async () => {
        try { return await fn(); }
        catch (e) {
          setError(e);
          if (e.details?.retryAfterSeconds) setResendAt(Date.now() + e.details.retryAfterSeconds * 1000);
          throw e;
        }
      });
    } finally { pending.current = false; }
  };
  const send = async event => {
    event?.preventDefault();
    if (step === 'otp' && Date.now() < resendAt) return;
    const result = await attempt(() => client.post('/auth/otp/request', { email: email.trim() }));
    if (!result) return;
    const time = Date.now();
    setNow(time); setExpiresAt(time + result.expiresInSeconds * 1000); setResendAt(time + result.resendAfterSeconds * 1000);
    setOtp(''); setStep('otp'); otpInput.current?.focus();
  };
  const verify = async event => {
    event.preventDefault();
    if (left <= 0 || !/^\d{6}$/.test(otp)) return;
    const result = await attempt(() => client.post('/auth/otp/verify', { email: email.trim(), otp }));
    if (!result) return;
    // Roles are authenticated by the backend; neither portal selects privileges.
    if (result.user.role !== 'CUSTOMER') { setError(new Error('Tài khoản không hợp lệ cho Customer Marketplace.')); return; }
    customerApi.setSession(result);
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    navigate(authDestination(result.user.role, next), { replace: true });
  };

  return <AuthLayout>
    <div className="brand-eyebrow">CHÀO MỪNG ĐẾN VỚI VOUCH.</div>
    {step === 'email' ? <>
      <h2>Đăng nhập bằng email</h2>
      <p className="auth-description">Nhập email tài khoản đang hoạt động. Chúng tôi sẽ gửi mã xác thực để bạn đăng nhập, không cần mật khẩu.</p>
      <form onSubmit={send}>
        <label className="field"><span>Địa chỉ email</span><input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@example.com" /></label>
        <ErrorBox error={error} />
        <button className="btn btn-block" disabled={busy}>{busy ? 'Đang gửi mã…' : 'Gửi mã OTP'} <Icon name="arrow" /></button>
        <p className="auth-help">Mã gồm 6 chữ số, có hiệu lực 5 phút và chỉ dùng một lần.</p>
      </form>
    </> : <>
      <h2>Kiểm tra hộp thư của bạn</h2>
      <p className="auth-description">Nếu <b>{email}</b> thuộc tài khoản đang hoạt động, mã OTP sẽ được gửi. Kiểm tra cả thư mục spam.</p>
      <form onSubmit={verify}>
        <label className="field"><span>Mã xác thực OTP</span><input ref={otpInput} className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} aria-describedby="otp-expiry" /></label>
        <p id="otp-expiry" className="small muted mb">{left > 0 ? `Mã còn hiệu lực ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Mã đã hết hạn. Vui lòng gửi lại mã mới.'}</p>
        <ErrorBox error={error} />
        <button className="btn btn-block" disabled={busy || otp.length !== 6 || left <= 0}>{busy ? 'Đang xác thực…' : 'Xác nhận & Đăng nhập'} <Icon name="arrow" /></button>
        <button type="button" className="link mt" disabled={busy || wait > 0} onClick={send}>{wait > 0 ? `Gửi lại mã sau ${wait}s` : 'Gửi lại mã OTP'}</button>
        <div className="mt"><button type="button" className="link small" disabled={busy} onClick={() => { setStep('email'); setOtp(''); setError(null); }}>← Đổi email</button></div>
        <p className="auth-help">Không chia sẻ OTP với bất kỳ ai, kể cả nhân viên Voucher Marketplace.</p>
      </form>
    </>}
  </AuthLayout>;
}
