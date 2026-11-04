import { useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { webApi, useSession } from '../api/client';
import { Logo, useAction, useLoad } from '../components/ui';
import { StoreSelect, StoreRedeem, StoreHistory } from './Store';
import { BrandCampaigns, CampaignForm, BrandStores, BrandStaff, BrandReviews, BrandReport, BrandSettlements, BrandProfile, BrandContext } from './Brand';
import { AdminDashboard, AdminBrands, AdminCampaigns, AdminSettlements, AdminCommission, AdminRefunds, AdminCategories, AdminReviews } from './Admin';

const HOME = { STORE_STAFF: '/web/store', BRAND_OWNER: '/web/brand', ADMIN: '/web/admin' };
const TITLE = { STORE_STAFF: 'Web cửa hàng', BRAND_OWNER: 'Kênh thương hiệu', ADMIN: 'Quản trị hệ thống' };
const NAV = {
  STORE_STAFF: [['/web/store/redeem', '▦', 'Xác nhận sử dụng'], ['/web/store/history', '🕘', 'Lịch sử trong ngày'], ['/web/store/select', '⇄', 'Đổi chi nhánh']],
  BRAND_OWNER: [
    ['/web/brand/campaigns', '📣', 'Chiến dịch'], ['/web/brand/stores', '🏬', 'Chi nhánh'], ['/web/brand/staff', '👥', 'Nhân viên'],
    ['/web/brand/reviews', '☆', 'Đánh giá'], ['/web/brand/report', '📈', 'Báo cáo'], ['/web/brand/settlements', '🧾', 'Đối soát'], ['/web/brand/profile', '🏢', 'Hồ sơ thương hiệu'],
  ],
  ADMIN: [
    ['/web/admin/dashboard', '▤', 'Bảng điều khiển'], ['/web/admin/brands', '✓', 'Duyệt thương hiệu'], ['/web/admin/campaigns', '📣', 'Duyệt chiến dịch'],
    ['/web/admin/settlements', '🧾', 'Đối soát'], ['/web/admin/commission', '%', 'Tỷ lệ hoa hồng'], ['/web/admin/refunds', '⟲', 'Hoàn tiền thủ công'],
    ['/web/admin/categories', '🏷️', 'Danh mục ngành hàng'], ['/web/admin/reviews', '☆', 'Đánh giá'],
  ],
};

function WebLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [forgot, setForgot] = useState(false);
  const [info, setInfo] = useState(null);
  const [busy, run] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    if (forgot) {
      const r = await run(() => webApi.post('/auth/password-reset/request', { email: form.email }));
      if (r) setInfo(r);
      return;
    }
    const r = await run(() => webApi.post('/auth/login', form));
    if (r) {
      webApi.setSession(r);
      navigate(HOME[r.user.role], { replace: true });
    }
  };
  const quick = [['admin@voucher.local', 'Quản trị'], ['owner@highlands.local', 'Chủ thương hiệu'], ['staff@highlands.local', 'Nhân viên']];
  return (
    <div className="login-wrap">
      <div className="login-art">
        <Logo size="lg" />
        <h1>Kết nối ưu đãi.<br />Nuôi dưỡng khách hàng.</h1>
        <p style={{ opacity: 0.85 }}>Không gian vận hành dành cho thương hiệu, cửa hàng và những trải nghiệm đáng nhớ.</p>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <Logo />
          <div className="small muted mt">CHÀO MỪNG TRỞ LẠI</div>
          <h2>{forgot ? 'Quên mật khẩu' : 'Đăng nhập'}</h2>
          <p className="small muted mb">Dành cho chủ thương hiệu, nhân viên cửa hàng và quản trị viên.</p>
          <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          {!forgot && <label className="field"><span>Mật khẩu</span><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>}
          <button className="btn btn-block" disabled={busy}>{forgot ? 'Gửi liên kết đặt lại' : 'Đăng nhập'}</button>
          {info && (
            <div className="alert alert-info small">{info.message}
              {info.devLink && <div className="mt">Demo: <a href={info.devLink}>mở liên kết đặt lại mật khẩu</a></div>}
            </div>
          )}
          <div className="row between mt">
            <button type="button" className="link small" onClick={() => { setForgot(!forgot); setInfo(null); }}>{forgot ? '← Đăng nhập' : 'Quên mật khẩu?'}</button>
            <a className="small" href="/">App khách hàng →</a>
          </div>
          <div className="demo-box small mt">
            <div className="bold mb">Tài khoản demo (mật khẩu Voucher@123)</div>
            {quick.map(([email, label]) => (
              <div key={email}><button type="button" className="link small" onClick={() => setForm({ email, password: 'Voucher@123' })}>{label}: {email}</button></div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}

// Kich hoat tai khoan nhan vien / dat lai mat khau tu lien ket email
function SetPassword({ mode }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [password, setPassword] = useState('');
  const [busy, run] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const path = mode === 'activate' ? '/auth/activate' : '/auth/password-reset/confirm';
    const r = await run(() => webApi.post(path, { email: params.get('email'), token: params.get('token'), password }), mode === 'activate' ? 'Đã kích hoạt tài khoản.' : 'Đã đổi mật khẩu.');
    if (r) navigate('/web/login', { replace: true });
  };
  return (
    <div className="login-form" style={{ minHeight: '100vh' }}>
      <form onSubmit={submit} className="card">
        <Logo />
        <h2 className="mt">{mode === 'activate' ? 'Kích hoạt tài khoản' : 'Đặt lại mật khẩu'}</h2>
        <p className="small muted mb">{params.get('email')}</p>
        <label className="field"><span>Mật khẩu mới (tối thiểu 8 ký tự)</span><input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn btn-block" disabled={busy}>Lưu mật khẩu</button>
      </form>
    </div>
  );
}

function Shell({ role, children }) {
  const navigate = useNavigate();
  const session = useSession(webApi);
  const logout = async () => {
    await webApi.logout();
    navigate('/web/login');
  };
  return (
    <div className="web">
      <div className="web-top">
        <div className="row gap"><button type="button" className="back" onClick={() => navigate('/')} title="App khách hàng">←</button><b>{TITLE[role]}</b></div>
        <div className="row gap">
          {role === 'STORE_STAFF' && session?.activeStore && <span className="store-pill">🏬 {session.activeStore.name}</span>}
          <span className="small muted">{session?.user.email}</span>
          <button type="button" className="link" onClick={logout} title="Đăng xuất">⎋</button>
        </div>
      </div>
      <div className="web-body">
        <aside className="sidebar">
          <div className="row gap" style={{ padding: '0 8px' }}><Logo /></div>
          <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
          {NAV[role].map(([to, ico, label]) => <NavLink key={to} to={to}><span>{ico}</span>{label}</NavLink>)}
          <div className="sidebar-foot"><b>Ưu đãi tốt. Kết nối liền.</b><div className="muted">Cùng xây dựng trải nghiệm khách hàng tốt hơn mỗi ngày.</div></div>
        </aside>
        <main className="web-main">{children}</main>
      </div>
    </div>
  );
}

function RequireRole({ role, children }) {
  const session = useSession(webApi);
  if (!session) return <Navigate to="/web/login" replace />;
  if (session.user.role !== role) return <Navigate to={HOME[session.user.role]} replace />;
  return <Shell role={role}>{children}</Shell>;
}

// Chu thuong hieu: lay thuong hieu cua minh truoc khi vao cac trang quan ly
function BrandArea() {
  const brands = useLoad(() => webApi.get('/brand/me'), []);
  if (brands.loading && !brands.data) return <div className="muted">Đang tải...</div>;
  const brand = brands.data?.[0];
  if (!brand) return <BrandProfile brand={null} onSaved={brands.reload} />;
  return (
    <BrandContext.Provider value={{ brand, reloadBrand: brands.reload }}>
      {brand.status !== 'APPROVED' && (
        <div className={`alert ${brand.status === 'PENDING' ? 'alert-warn' : 'alert-bad'}`}>
          Thương hiệu {brand.status === 'PENDING' ? 'đang chờ quản trị viên duyệt' : brand.status === 'SUSPENDED' ? 'đang bị đình chỉ' : 'bị từ chối'}
          {brand.rejectReason ? `: ${brand.rejectReason}` : ''}. {brand.status !== 'SUSPENDED' && 'Chưa thể gửi duyệt chiến dịch (BR-26).'}
        </div>
      )}
      <Routes>
        <Route path="campaigns" element={<BrandCampaigns />} />
        <Route path="campaigns/new" element={<CampaignForm />} />
        <Route path="campaigns/:id/edit" element={<CampaignForm />} />
        <Route path="stores" element={<BrandStores />} />
        <Route path="staff" element={<BrandStaff />} />
        <Route path="reviews" element={<BrandReviews />} />
        <Route path="report" element={<BrandReport />} />
        <Route path="settlements" element={<BrandSettlements />} />
        <Route path="profile" element={<BrandProfile brand={brand} onSaved={brands.reload} />} />
        <Route path="*" element={<Navigate to="campaigns" replace />} />
      </Routes>
    </BrandContext.Provider>
  );
}

export default function WebApp() {
  const session = useSession(webApi);
  return (
    <Routes>
      <Route path="login" element={session ? <Navigate to={HOME[session.user.role]} replace /> : <WebLogin />} />
      <Route path="activate" element={<SetPassword mode="activate" />} />
      <Route path="reset-password" element={<SetPassword mode="reset" />} />
      <Route path="store/*" element={
        <RequireRole role="STORE_STAFF">
          <Routes>
            <Route path="select" element={<StoreSelect />} />
            <Route path="redeem" element={<StoreRedeem />} />
            <Route path="history" element={<StoreHistory />} />
            <Route path="*" element={<Navigate to={session?.activeStoreId ? 'redeem' : 'select'} replace />} />
          </Routes>
        </RequireRole>
      } />
      <Route path="brand/*" element={<RequireRole role="BRAND_OWNER"><BrandArea /></RequireRole>} />
      <Route path="admin/*" element={
        <RequireRole role="ADMIN">
          <Routes>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="brands" element={<AdminBrands />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="settlements" element={<AdminSettlements />} />
            <Route path="commission" element={<AdminCommission />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </RequireRole>
      } />
      <Route path="*" element={<Navigate to={session ? HOME[session.user.role] : '/web/login'} replace />} />
    </Routes>
  );
}
