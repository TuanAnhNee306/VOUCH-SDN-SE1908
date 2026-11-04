import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BrandOverview, Icon, StaffOverview } from './Dashboard';
import './dashboard.css';
import { AuthLayout } from '../components/AuthLayout';
import { ManagementLogin } from '../components/ManagementLogin';
import { webApi, useSession } from '../api/client';
import { ErrorBox, Logo, Spinner, useAction, useLoad } from '../components/ui';
import { CashbackManagement } from './Cashback';
import { StoreSelect, StoreRedeem, StoreHistory } from './Store';
import { BrandCampaigns, CampaignForm, BrandStores, BrandStaff, BrandReviews, BrandReport, BrandSettlements, BrandProfile, BrandContext } from './Brand';
import { AdminDashboard, AdminBrands, AdminCampaigns, AdminSettlements, AdminCommission, AdminRefunds, AdminCategories, AdminReviews } from './Admin';

const HOME = { STORE_STAFF: '/web/store', BRAND_OWNER: '/web/brand', ADMIN: '/web/admin' };
const TITLE = { STORE_STAFF: 'Web cửa hàng', BRAND_OWNER: 'Kênh thương hiệu', ADMIN: 'Quản trị hệ thống' };
const NAV = {
  STORE_STAFF: [['/web/store/overview', 'grid', 'Tổng quan'], ['/web/store/cashback', 'cash', 'Hoàn Cashback'], ['/web/store/redeem', 'scan', 'Xác nhận sử dụng'], ['/web/store/history', 'clock', 'Lịch sử trong ngày'], ['/web/store/select', 'store', 'Đổi chi nhánh']],
  BRAND_OWNER: [['/web/brand/overview', 'grid', 'Tổng quan'], ['/web/brand/cashback', 'cash', 'Hoàn Cashback'],
    ['/web/brand/campaigns', '📣', 'Chiến dịch'], ['/web/brand/stores', '🏬', 'Chi nhánh'], ['/web/brand/staff', '👥', 'Nhân viên'],
    ['/web/brand/reviews', '☆', 'Đánh giá'], ['/web/brand/report', '📈', 'Báo cáo'], ['/web/brand/settlements', '🧾', 'Đối soát'], ['/web/brand/profile', '🏢', 'Hồ sơ thương hiệu'],
  ],
  ADMIN: [['/web/admin/dashboard', '▤', 'Bảng điều khiển'], ['/web/admin/cashback', '⚖', 'Tranh chấp Cashback'],
    ['/web/admin/brands', '✓', 'Duyệt thương hiệu'], ['/web/admin/campaigns', '📣', 'Duyệt chiến dịch'],
    ['/web/admin/settlements', '🧾', 'Đối soát'], ['/web/admin/commission', '%', 'Tỷ lệ hoa hồng'], ['/web/admin/refunds', '⟲', 'Hoàn tiền thủ công'],
    ['/web/admin/categories', '🏷️', 'Danh mục ngành hàng'], ['/web/admin/reviews', '☆', 'Đánh giá'],
  ],
};

function WebLogin() {
  return <ManagementLogin />;
}

// Kich hoat tai khoan nhan vien / dat lai mat khau tu lien ket email
function SetPassword({ mode }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, run] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const path = mode === 'activate' ? '/auth/activate' : '/auth/password-reset/confirm';
    const r = await run(() => webApi.post(path, { email: params.get('email'), token: params.get('token'), password }), mode === 'activate' ? 'Đã kích hoạt tài khoản.' : 'Đã đổi mật khẩu.');
    if (r) navigate('/web/login', { replace: true });
  };
  return (
    <AuthLayout management>
      <form onSubmit={submit}>
        <div className="brand-eyebrow">BẢO MẬT TÀI KHOẢN</div>
        <h2 className="mt">{mode === 'activate' ? 'Kích hoạt tài khoản' : 'Đặt lại mật khẩu'}</h2>
        <p className="small muted mb">{params.get('email')}</p>
        <label className="field"><span>Mật khẩu mới (tối thiểu 8 ký tự)</span><div className="password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Ẩn' : 'Hiện'}</button></div></label>
        <button className="btn btn-block" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu mật khẩu'}</button>
      </form>
    </AuthLayout>
  );
}

function Shell({ role, children }) {
  const navigate = useNavigate();
  const session = useSession(webApi);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuButton = useRef(null);
  const sidebar = useRef(null);
  const current = [...NAV[role]].reverse().find(([path]) => location.pathname.startsWith(path));
  const pageTitle = location.pathname.endsWith('/new') ? 'Tạo voucher mới' : location.pathname.endsWith('/edit') ? 'Chỉnh sửa voucher' : current?.[2] || 'Tổng quan';
  useEffect(() => { setDrawer(false); }, [location.pathname]);
  useEffect(() => {
    if (!drawer) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector('button, a')?.focus();
    const keyboard = e => {
      if (e.key === 'Escape') { setDrawer(false); menuButton.current?.focus(); }
      if (e.key === 'Tab') {
        const nodes = [...sidebar.current.querySelectorAll('button, a')];
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keyboard); };
  }, [drawer]);
  const logout = async () => {
    await webApi.logout();
    navigate('/web/login');
  };
  return (
    <div className={`web dashboard ${collapsed ? 'is-collapsed' : ''} ${drawer ? 'drawer-open' : ''}`}>
      <a className="skip-link" href="#dashboard-content">Đi đến nội dung</a>
      <div className="web-top">
        <div className="row gap"><button ref={menuButton} type="button" className="icon-button mobile-menu" aria-label="Mở menu" aria-expanded={drawer} aria-controls="dashboard-sidebar" onClick={() => setDrawer(true)}><Icon name="menu" /></button><div><div className="breadcrumb">{TITLE[role]} <span>/</span> {pageTitle}</div><b className="top-page-title">{pageTitle}</b></div></div>
        <div className="row gap">
          {role === 'STORE_STAFF' && session?.activeStore && <span className="store-pill">{session.activeStore.name}</span>}
          <details className="account-menu"><summary><span className="avatar">{(session?.user.fullName || session?.user.email || 'V').slice(0, 1).toUpperCase()}</span><span className="account-copy"><b>{session?.user.fullName || session?.user.email?.split('@')[0]}</b><span>{TITLE[role]}</span></span><span>⌄</span></summary><div className="account-dropdown"><div className="small muted">{session?.user.email}</div><a href="/">Mở Marketplace ↗</a>{role === 'BRAND_OWNER' && <NavLink to="/web/brand/profile">Hồ sơ thương hiệu</NavLink>}<button type="button" onClick={logout}>Đăng xuất</button></div></details>
        </div>
      </div>
      <div className="web-body">
        {drawer && <button className="sidebar-scrim" aria-label="Đóng menu" onClick={() => { setDrawer(false); menuButton.current?.focus(); }} />}
        <aside id="dashboard-sidebar" ref={sidebar} className="sidebar" aria-label="Điều hướng quản trị">
          <div className="sidebar-brand"><Logo /><button type="button" className="icon-button collapse-button" aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><Icon name="back" /></button><button type="button" className="icon-button drawer-close" aria-label="Đóng menu" onClick={() => { setDrawer(false); menuButton.current?.focus(); }}>×</button></div>
          <div className="workspace-role"><span className="workspace-dot" /><span>{TITLE[role]}</span></div>
          <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
          <nav>{NAV[role].map(([to, ico, label]) => <NavLink key={to} to={to} title={label}><Icon name={ico === '📣' ? 'campaign' : ico === '🏬' || ico === '🏢' || ico === '✓' ? 'store' : ico === '👥' ? 'users' : ico === '☆' ? 'star' : ico === '📈' || ico === '▤' ? 'chart' : ico === '🧾' || ico === '↩' || ico === '⚖' || ico === '%' || ico === '⟲' ? 'cash' : ico} /><span className="nav-text">{label}</span></NavLink>)}</nav>
          <div className="sidebar-foot"><div className="small muted">VOUCHER MARKETPLACE</div><b>Vận hành tốt hơn mỗi ngày.</b><a href="/">Khám phá Marketplace ↗</a><button type="button" className="sidebar-logout" onClick={logout} title="Đăng xuất"><Icon name="logout" /><span>Đăng xuất</span></button></div>
        </aside>
        <main id="dashboard-content" className="web-main" tabIndex={-1}>{children}<footer className="dashboard-footer">vouch. <span>Không gian quản lý voucher</span></footer></main>
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
  if (brands.loading && !brands.data) return <Spinner />;
  if (brands.error && !brands.data) return <ErrorBox error={brands.error} onRetry={brands.reload} />;
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
        <Route path="overview" element={<BrandOverview />} />
        <Route path="cashback" element={<CashbackManagement brandMode />} />
        <Route path="campaigns" element={<BrandCampaigns />} />
        <Route path="campaigns/new" element={<CampaignForm />} />
        <Route path="campaigns/:id/edit" element={<CampaignForm />} />
        <Route path="stores" element={<BrandStores />} />
        <Route path="staff" element={<BrandStaff />} />
        <Route path="reviews" element={<BrandReviews />} />
        <Route path="report" element={<BrandReport />} />
        <Route path="settlements" element={<BrandSettlements />} />
        <Route path="profile" element={<BrandProfile brand={brand} onSaved={brands.reload} />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
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
            <Route path="overview" element={<StaffOverview />} />
            <Route path="cashback" element={<CashbackManagement />} />
            <Route path="select" element={<StoreSelect />} />
            <Route path="redeem" element={<StoreRedeem />} />
            <Route path="history" element={<StoreHistory />} />
            <Route path="*" element={<Navigate to={session?.activeStoreId ? 'overview' : 'select'} replace />} />
          </Routes>
        </RequireRole>
      } />
      <Route path="brand/*" element={<RequireRole role="BRAND_OWNER"><BrandArea /></RequireRole>} />
      <Route path="admin/*" element={
        <RequireRole role="ADMIN">
          <Routes>
            <Route path="cashback" element={<CashbackManagement admin />} />
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
