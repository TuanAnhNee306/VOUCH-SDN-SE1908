import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { customerApi, useSession } from '../api/client';
import { useToast } from '../components/ui';

const UnreadCtx = createContext({ unread: 0, refresh: () => {} });
export const useUnread = () => useContext(UnreadCtx);

const TABS = [
  ['/', '🧭', 'Khám phá'],
  ['/search', '🔍', 'Tìm kiếm'],
  ['/wallet', '🎟️', 'Ví voucher'],
  ['/orders', '🧾', 'Đơn hàng'],
  ['/me', '👤', 'Cá nhân'],
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
  return (
    <header className="desk-nav">
      <div className="desk-nav-inner">
        <NavLink to="/" className="logo logo-md">vouch<span>.</span></NavLink>
        <nav className="desk-links">
          {TABS.map(([to, ico, label]) => (
            <NavLink key={to} to={to} end={to === '/'}><span>{ico}</span>{label}</NavLink>
          ))}
        </nav>
        <div className="row gap">
          <button type="button" className="bell" onClick={() => navigate(session ? '/notifications' : '/login')} aria-label="Thông báo">
            🔔{unread > 0 && <span className="dot">{unread}</span>}
          </button>
          {session ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/me')}>👤 {session.user.fullName || session.user.email}</button>
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
  return (
    <UnreadCtx.Provider value={value}>
      <DesktopHeader session={session} unread={value.unread} />
      <div className={`phone ${nav ? '' : 'no-nav'}`}>
        <Outlet />
        {nav && (
          <nav className="bottom-nav">
            {TABS.map(([to, ico, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                <span className="ico">{ico}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
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
