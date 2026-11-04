import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { webApi } from '../api/client';
import { AuthLayout } from './AuthLayout';
import { ErrorBox, useAction } from './ui';

const HOME = { ADMIN: '/web/admin', BRAND_OWNER: '/web/brand', STORE_STAFF: '/web/store' };
export function ManagementLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState(null);
  const pending = useRef(false);
  const [busy, run] = useAction();
  const submit = async event => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setError(null); setInfo('');
    try {
      await run(async () => {
        try {
          if (forgot) {
            const result = await webApi.post('/auth/password-reset/request', { email });
            setInfo(result.message);
          } else {
            const result = await webApi.post('/auth/login', { email, password });
            if (!HOME[result.user.role]) throw new Error('Tài khoản không có quyền truy cập Management Portal.');
            webApi.setSession(result);
            navigate(HOME[result.user.role], { replace: true });
          }
        } catch (e) { setError(e); throw e; }
      });
    } finally { pending.current = false; }
  };
  return <AuthLayout management>
    <div className="brand-eyebrow">VOUCH. MANAGEMENT</div>
    <h2>{forgot ? 'Quên mật khẩu?' : 'Đăng nhập hệ thống quản lý'}</h2>
    <p className="auth-description">{forgot ? 'Nhập email để nhận hướng dẫn đặt lại mật khẩu.' : 'Truy cập không gian quản lý bằng tài khoản của bạn.'}</p>
    <form onSubmit={submit}>
      <label className="field"><span>Email công việc</span><input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      {!forgot && <label className="field"><span>Mật khẩu</span><input type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" className="link small" onClick={() => setVisible(!visible)}>{visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</button></label>}
      <ErrorBox error={error} />
      {info && <p role="status" className="auth-help">{info}</p>}
      <button className="btn btn-block" disabled={busy}>{busy ? 'Đang xử lý…' : forgot ? 'Gửi hướng dẫn' : 'Đăng nhập'}</button>
      <button type="button" className="link mt" disabled={busy} onClick={() => { setForgot(!forgot); setError(null); setInfo(''); }}>{forgot ? '← Quay lại đăng nhập' : 'Quên mật khẩu?'}</button>
    </form>
    {!forgot && <details className="demo-box mt"><summary>Tài khoản dùng thử</summary><p className="small">Mật khẩu demo: Voucher@123</p>{['admin@voucher.local', 'owner@highlands.local', 'staff@highlands.local'].map(account => <div key={account}><button type="button" className="link small" onClick={() => { setEmail(account); setPassword('Voucher@123'); }}>{account}</button></div>)}</details>}
  </AuthLayout>;
}
