import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerApi, useSession } from '../api/client';
import { Badge, CampaignImage, Empty, ErrorBox, Logo, Spinner, StatusBadge, useAction, useLoad, useToast } from '../components/ui';
import { dateTime, money, ORDER_STATUS } from '../utils/format';
import { useUnread, TopBar } from './Layout';

function askNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}

// Dang nhap bang OTP 6 so gui qua email (hieu luc 5 phut, gui lai sau 60 giay)
export function Login() {
  const navigate = useNavigate();
  // Default successful OTP sign-in to the Explore/home screen. A specific
  // `next` destination (for example, continuing checkout) still takes priority.
  const next = new URLSearchParams(window.location.search).get('next') || '/';
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, run] = useAction();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e) => {
    e?.preventDefault();
    const r = await run(() => customerApi.post('/auth/otp/request', { email }), 'Đã gửi mã OTP.');
    if (r) {
      setDevOtp(r.devOtp || null);
      setStep('otp');
      setCooldown(60);
    }
  };
  const verify = async (e) => {
    e.preventDefault();
    const r = await run(() => customerApi.post('/auth/otp/verify', { email, otp }));
    if (r) {
      customerApi.setSession(r);
      askNotificationPermission();
      navigate(next, { replace: true });
    }
  };

  if (step === 'otp') {
    return (
      <div>
        <TopBar title="Nhập mã OTP" onBack={() => setStep('email')} />
        <form className="screen center" onSubmit={verify}>
          <p className="small muted">Mã xác thực đã được gửi tới {email}</p>
          <input className="input otp-input mt" inputMode="numeric" maxLength={6} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
          {devOtp && (
            <div className="demo-box small mt">Chế độ demo (MAIL_MODE=console): mã OTP là <b className="mono">{devOtp}</b>{' '}
              <button type="button" className="link" onClick={() => setOtp(devOtp)}>Điền</button>
            </div>
          )}
          <button className="btn btn-block mt" disabled={busy || otp.length !== 6}>Xác nhận</button>
          <button type="button" className="link mt" disabled={cooldown > 0 || busy} onClick={send}>
            {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}
          </button>
        </form>
      </div>
    );
  }
  return (
    <div>
      <TopBar title="" />
      <form className="screen center" onSubmit={send}>
        <div style={{ fontSize: 40 }}>🏷️</div>
        <h2>Voucher Platform</h2>
        <p className="small muted mb">Ưu đãi đa thương hiệu, dùng ngay tại cửa hàng</p>
        <label className="field" style={{ textAlign: 'left' }}><span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn btn-block" disabled={busy}>Gửi mã OTP</button>
        <p className="small muted mt">Mã OTP 6 số có hiệu lực 5 phút. Mỗi email tối đa 5 lần / giờ.</p>
      </form>
    </div>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const session = useSession(customerApi);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [busy, run] = useAction();
  if (!session) {
    return (
      <div>
        <TopBar title="Cá nhân" back={false} />
        <div className="screen">
          <div className="card center"><div style={{ fontSize: 40 }}>👤</div><b>Khách</b></div>
          <button type="button" className="btn btn-block mt" onClick={() => navigate('/login')}>Đăng nhập</button>
          <div className="card mt small">
            <div className="bold mb">Dành cho nhân viên / thương hiệu / quản trị</div>
            <button type="button" className="link" onClick={() => navigate('/web')}>Mở web quản lý →</button>
          </div>
        </div>
      </div>
    );
  }
  const u = session.user;
  const save = async (e) => {
    e.preventDefault();
    const r = await run(() => customerApi.patch('/profile', form), 'Đã cập nhật hồ sơ.');
    if (r) {
      customerApi.setSession({ ...session, user: { ...u, fullName: r.fullName, phone: r.phone } });
      setEditing(false);
    }
  };
  const logout = async () => {
    await customerApi.logout();
    Object.keys(localStorage).filter((k) => k.startsWith('vp_wallet_')).forEach((k) => localStorage.removeItem(k));
    toast('Đã đăng xuất.');
  };
  const items = [['❤️', 'Yêu thích', '/favorites'], ['🔔', 'Thông báo', '/notifications'], ['⟲', 'Yêu cầu hoàn tiền', '/refunds']];
  return (
    <div>
      <TopBar title="Cá nhân" back={false} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <div className="card center">
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-soft)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>
          <div className="bold mt">{u.fullName || 'Khách hàng'}</div>
          <div className="small muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
          {!editing && <button type="button" className="link small mt" onClick={() => { setForm({ fullName: u.fullName || '', phone: u.phone || '' }); setEditing(true); }}>Sửa hồ sơ</button>}
          {editing && (
            <form onSubmit={save} className="mt" style={{ textAlign: 'left' }}>
              <label className="field"><span>Họ tên</span><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
              <label className="field"><span>Số điện thoại</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <div className="row end gap"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Hủy</button><button className="btn btn-sm" disabled={busy}>Lưu</button></div>
            </form>
          )}
        </div>
        <div className="card mt" style={{ padding: 0 }}>
          {items.map(([ico, label, to]) => (
            <div key={to} className="row gap" style={{ padding: 14, borderBottom: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => navigate(to)}>
              <span>{ico}</span><span className="grow">{label}</span><span>›</span>
            </div>
          ))}
        </div>
        {'Notification' in window && Notification.permission !== 'granted' && (
          <button type="button" className="btn btn-ghost btn-block mt" onClick={askNotificationPermission}>Cho phép thông báo trên thiết bị</button>
        )}
        <button type="button" className="btn btn-ghost btn-block mt" style={{ color: 'var(--bad)' }} onClick={logout}>⎋ Đăng xuất</button>
      </div>
    </div>
  );
}

export function Orders() {
  const navigate = useNavigate();
  const list = useLoad(() => customerApi.get('/orders/me'), []);
  const [busy, run] = useAction();
  const pay = async (o) => {
    const r = await run(() => customerApi.post(`/orders/${o.id}/pay`));
    if (r) navigate(`/orders/${o.id}/result`, { state: { paymentUrl: r.paymentUrl } });
  };
  return (
    <div>
      <TopBar title="Đơn hàng" back={false} right={<button type="button" className="link" onClick={() => list.reload()}>⟳</button>} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty icon="🧾">Chưa có đơn hàng nào.</Empty> : list.data?.map((o) => {
          const canPay = o.status === 'PENDING' && new Date(o.reservedUntil) > new Date();
          return (
            <div key={o.id} className="card row gap" onClick={() => navigate(`/orders/${o.id}/result`)} role="button">
              <div className="grow">
                <div className="bold">{o.campaign?.title}</div>
                <div className="small muted">{money(o.totalAmount)} · SL {o.quantity} · {dateTime(o.createdAt)}</div>
                {o.status === 'PENDING' && <div className="small muted">Giữ chỗ đến: {dateTime(o.reservedUntil)}</div>}
                <div className="mt"><StatusBadge map={ORDER_STATUS} value={o.status} /></div>
              </div>
              {canPay ? (
                <button type="button" className="btn btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); pay(o); }}>Tiếp tục thanh toán</button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Cham thong bao mo dung man lien quan
function targetOf(n) {
  const d = n.data || {};
  if (d.voucherItemId) return `/wallet/${d.voucherItemId}`;
  if (d.refundId) return '/refunds';
  if (d.orderId) return `/orders/${d.orderId}/result`;
  if (d.campaignId) return `/campaigns/${d.campaignId}`;
  return null;
}

export function Notifications() {
  const navigate = useNavigate();
  const { refresh } = useUnread();
  const list = useLoad(() => customerApi.get('/notifications'), []);
  const [, run] = useAction();
  const open = async (n) => {
    if (!n.readAt) await customerApi.patch(`/notifications/${n.id}/read`).catch(() => {});
    refresh();
    const to = targetOf(n);
    if (to) navigate(to);
    else list.reload(true);
  };
  const readAll = async () => {
    await run(() => customerApi.patch('/notifications/read-all'));
    refresh();
    list.reload(true);
  };
  return (
    <div>
      <TopBar title="Thông báo" right={<div className="row gap"><button type="button" className="link small" onClick={readAll}>Đọc tất cả</button><button type="button" className="bell" onClick={() => navigate('/notifications/settings')} aria-label="Cài đặt">⚙️</button></div>} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <ErrorBox error={list.error} />
        {list.loading && !list.data ? <Spinner /> : list.data?.items.length === 0 ? <Empty icon="🔔">Chưa có thông báo.</Empty> : list.data?.items.map((n) => (
          <div key={n.id} className={`notice ${n.readAt ? '' : 'unread'}`} onClick={() => open(n)} role="button">
            <span>{n.type === 'VOUCHER_USED' ? '▦' : n.type === 'REFUND_RESULT' ? '⟲' : n.type === 'CAMPAIGN_NEW' ? '📣' : '🎟️'}</span>
            <div className="grow">
              <div className="bold">{n.title}</div>
              <div className="small">{n.body}</div>
              <div className="small muted">{dateTime(n.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const settings = useLoad(() => customerApi.get('/notifications/settings'), []);
  const toggle = async (s) => {
    try {
      settings.setData(await customerApi.put('/notifications/settings', { type: s.type, enabled: !s.enabled }));
    } catch {
      settings.reload(true);
    }
  };
  return (
    <div>
      <TopBar title="Cài đặt thông báo" />
      <div className="screen" style={{ paddingTop: 0 }}>
        <p className="small muted">Chọn những thông báo bạn muốn nhận.</p>
        {settings.loading && !settings.data ? <Spinner /> : settings.data?.map((s) => (
          <div key={s.type} className="row between" style={{ padding: '10px 0' }}>
            <span>{s.label}</span>
            <label className="switch"><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} /><span /></label>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Favorites() {
  const navigate = useNavigate();
  const list = useLoad(() => customerApi.get('/favorites'), []);
  return (
    <div>
      <TopBar title="Yêu thích" />
      <div className="screen" style={{ paddingTop: 0 }}>
        {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty icon="❤️">Chưa có mục yêu thích. Bấm ♡ ở voucher hoặc theo dõi thương hiệu.</Empty> : list.data?.map((f) => (
          <div key={f.id} className="card row gap" role="button" onClick={() => navigate(f.targetType === 'BRAND' ? `/brands/${f.targetId}` : `/campaigns/${f.targetId}`)}>
            <CampaignImage src={f.image} className="fav-img" />
            <div className="grow">
              <div className="bold">{f.title}</div>
              <div className="small muted">{f.targetType === 'BRAND' ? 'Thương hiệu đang theo dõi' : `${f.brandName || ''} · ${money(f.salePrice)}`}</div>
            </div>
            <Badge tone={f.targetType === 'BRAND' ? 'info' : 'ok'}>{f.targetType === 'BRAND' ? 'Thương hiệu' : 'Voucher'}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export { Logo };
