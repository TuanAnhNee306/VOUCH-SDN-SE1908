import { Link } from 'react-router-dom';
import { Logo } from './ui';
import { Icon } from './Icon';

export function AuthLayout({ management = false, children }) {
  return <div className={`auth-page ${management ? 'management-auth' : 'customer-auth'}`}>
    <aside className="auth-branding">
      <Link to="/" aria-label="Về Marketplace"><Logo /></Link>
      <div className="auth-story"><div className="brand-eyebrow">{management ? 'MANAGEMENT PORTAL' : 'ƯU ĐÃI CHO MỖI NGÀY'}</div>
        <h1>{management ? <>Một không gian.<br />Mọi hoạt động.</> : <>Trải nghiệm nhiều hơn.<br />Chi tiêu thông minh hơn.</>}</h1>
        <p>{management ? 'Quản lý chiến dịch, kết nối khách hàng và theo dõi hoạt động thương hiệu trong một hệ thống thống nhất.' : 'Khám phá voucher từ các thương hiệu yêu thích. Chọn quyền lợi phù hợp và lưu ngay trong ví của bạn.'}</p>
        <div className="auth-illustration" aria-hidden="true"><div className="auth-ticket"><Icon name={management ? 'chart' : 'ticket'} size={32} /><span>vouch.</span><b>{management ? 'Không gian vận hành' : 'Một voucher, thêm trải nghiệm'}</b><div className="ticket-dashes" /><small>{management ? 'Campaigns · Stores · Cashback' : 'Khám phá · Lưu vào ví · Sử dụng'}</small></div></div>
        <div className="auth-assurance"><Icon name="shield" /><span>{management ? 'Quyền truy cập theo vai trò tài khoản' : 'Ví voucher và lịch sử trong cùng một tài khoản'}</span></div>
      </div>
      <p className="auth-copyright">vouch. · Voucher Marketplace</p>
    </aside>
    <main className="auth-main"><Link to="/" className="auth-back"><Icon name="back" /> Về Marketplace</Link><div className="auth-form-wrap"><div className="auth-mobile-logo"><Logo /></div>{children}</div><div className="auth-bottom">{management ? 'Dành cho Admin, Brand Owner và Store Staff.' : <>Bạn quản lý thương hiệu? <Link to="/web/login">Mở cổng quản lý →</Link></>}</div></main>
  </div>;
}
