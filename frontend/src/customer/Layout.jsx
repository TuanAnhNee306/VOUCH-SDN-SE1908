import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { customerApi, useSession } from '../api/client';
import { useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import './marketplace.css';

const UnreadCtx = createContext({ unread: 0, refresh: () => {} });
export const useUnread = () => useContext(UnreadCtx);

const TABS = [
  ['/', 'grid', 'Khám phá'],
  ['/search', 'search', 'Tìm kiếm'],
  ['/wallet', 'ticket', 'Ví voucher'],
  ['/orders', 'campaign', 'Đơn hàng'],
  ['/me', 'users', 'Cá nhân'],
];

// Hoi may chu thong bao moi moi 10 giay; thong bao moi hien banner trong app va thong bao cua trinh duyet / dien thoai
function useNotificationPoller(session) {
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const seen = useRef(null);
  const refresh = async () => {
    if (!customerApi.getSession()) return;
    try {
      const { items, unread: count } = await customerApi.get('/notifications');
      setUnread(count);
      const ids = new Set(items.map((n) => n.id));
      if (seen.current) {
        for (const n of items.filter((x) => !x.readAt && !seen.current.has(x.id)).reverse()) {
          toast(`${n.title}: ${n.body}`, 'ok');
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(n.title, { body: n.body, tag: n.id });
            } catch {
              // mot so trinh duyet di dong chi cho thong bao qua service worker
            }
          }
        }
      }
      seen.current = ids;
    } catch {
      // mat mang: thu lai o luot sau
    }
  };
  useEffect(() => {
    seen.current = null;
    setUnread(0);
    if (!session) return undefined;
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);
  return { unread, refresh };
}

// Thanh dieu huong tren cung cho man hinh may tinh (tren dien thoai an di, dung bottom-nav)
function DesktopHeader({ session, unread }) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  return (
    <header className="market-header">
      <div className="market-announcement">Thêm lựa chọn. Thêm trải nghiệm. <span>Khám phá voucher phù hợp với bạn.</span></div>
      <div className="desk-nav-inner">
        <NavLink to="/" className="logo logo-md" aria-label="vouch. Trang chủ">vouch<span>.</span></NavLink>
        <nav className="desk-links">
          {TABS.filter(([to]) => ['/', '/wallet', '/orders'].includes(to)).map(([to, ico, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
          ))}
        </nav>
        <form className="header-search" role="search" onSubmit={e => { e.preventDefault(); navigate(`/search?keyword=${encodeURIComponent(keyword.trim())}`); }}><Icon name="search" /><input aria-label="Tìm voucher hoặc thương hiệu" placeholder="Tìm voucher, thương hiệu…" value={keyword} onChange={e => setKeyword(e.target.value)} /><button type="submit" aria-label="Tìm kiếm"><Icon name="arrow" size={16} /></button></form>
        <div className="row gap">
          <button type="button" className="bell" onClick={() => navigate(session ? '/notifications' : '/login')} aria-label="Thông báo">
            <Icon name="bell" />{unread > 0 && <span className="dot">{unread}</span>}
          </button>
          {session ? (
            <button type="button" className="customer-avatar" aria-label="Mở tài khoản" title={session.user.fullName || session.user.email} onClick={() => navigate('/me')}>{(session.user.fullName || session.user.email || 'V').slice(0, 1).toUpperCase()}</button>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => navigate('/login')}>Đăng nhập</button>
          )}
        </div>
      </div>
    </header>
  );
}

export function CustomerLayout({ nav = false }) {
  const session = useSession(customerApi);
  const value = useNotificationPoller(session);
  const location = useLocation();
  if (location.pathname === '/login') return <UnreadCtx.Provider value={value}><Outlet /></UnreadCtx.Provider>;
  return (
    <UnreadCtx.Provider value={value}>
      <div className="marketplace">
      <a className="market-skip" href="#market-content">Đến nội dung chính</a>
      <DesktopHeader session={session} unread={value.unread} />
      <main id="market-content" className={`phone ${nav ? '' : 'no-nav'}`}>
        <Outlet />
        {nav && (
          <nav className="bottom-nav">
            {TABS.map(([to, ico, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                <span className="ico"><Icon name={ico} /></span>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </main>
      <footer className="market-footer"><div><NavLink to="/" className="logo">vouch<span>.</span></NavLink><p>Chọn ưu đãi phù hợp. Tận hưởng từng trải nghiệm.</p></div><div><NavLink to="/search">Khám phá voucher</NavLink><NavLink to="/wallet">Ví của bạn</NavLink><NavLink to="/web/login">Cổng quản lý ↗</NavLink></div><span>Voucher Marketplace</span></footer>
      </div>
    </UnreadCtx.Provider>
  );
}

export function RequireCustomer({ children }) {
  const session = useSession(customerApi);
  const location = useLocation();
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

export function TopBar({ title, back = true, right = null, onBack }) {
  const navigate = useNavigate();
  return (
    <div className="topbar">
      {back && (
        <button type="button" className="back" onClick={() => (onBack ? onBack() : window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Quay lại">
          ←
        </button>
      )}
      <h1 className="grow ellipsis">{title}</h1>
      {right}
    </div>
  );
}
