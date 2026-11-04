import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { webApi, useSession } from '../api/client';
import { Empty, ErrorBox, Spinner, StatusBadge, useLoad } from '../components/ui';
import { CAMPAIGN_STATUS, dateTime, money } from '../utils/format';
import { BrandContext } from './Brand';
import { Icon } from '../components/Icon';
export { Icon } from '../components/Icon';

export function StatCard({ label, value, hint, icon = 'chart' }) {
  return <div className="stat"><div className="row between gap"><span className="small muted">{label}</span><span className="stat-icon"><Icon name={icon} /></span></div><div className="v">{value ?? '—'}</div>{hint && <div className="stat-hint">{hint}</div>}</div>;
}

export function QuickActions({ staff = false }) {
  const root = staff ? '/web/store' : '/web/brand';
  const items = staff ? [['redeem', 'scan', 'Xác minh voucher', 'Quét QR hoặc nhập mã OTP'], ['cashback', 'cash', 'Quản lý Cashback', 'Ghi nhận biên nhận hoàn tiền'], ['history', 'clock', 'Lịch sử hôm nay', 'Tra cứu lượt sử dụng'], ['select', 'store', 'Đổi chi nhánh', 'Chọn nơi làm việc']] : [['campaigns/new', 'campaign', 'Tạo voucher', 'Bắt đầu chiến dịch mới'], ['campaigns', 'grid', 'Chiến dịch', 'Theo dõi trạng thái duyệt'], ['stores', 'store', 'Chi nhánh', 'Quản lý điểm sử dụng'], ['cashback', 'cash', 'Quản lý Cashback', 'Theo dõi nghĩa vụ hoàn tiền']];
  return <div className="quick-actions">{items.map(([path, icon, title, text]) => <Link key={path} to={`${root}/${path}`} className="quick-action"><span className="action-icon"><Icon name={icon} /></span><div><b>{title}</b><p>{text}</p></div><span className="action-arrow">↗</span></Link>)}</div>;
}

export function BrandOverview() {
  const { brand } = useContext(BrandContext);
  const report = useLoad(() => webApi.get(`/brand/${brand.id}/report`), [brand.id]);
  const campaigns = useLoad(() => webApi.get(`/brand/${brand.id}/campaigns`), [brand.id]);
  const claims = useLoad(() => webApi.get(`/brand/${brand.id}/cashback`), [brand.id]);
  return <div><div className="page-head"><div><div className="eyebrow">KHÔNG GIAN THƯƠNG HIỆU</div><h1>Tổng quan kinh doanh</h1><p className="muted">{brand.name} · Quản lý voucher và hoạt động của bạn tại một nơi.</p></div><Link className="btn" to="/web/brand/campaigns/new">+ Tạo voucher</Link></div><ErrorBox error={report.error || campaigns.error} onRetry={() => { report.reload(); campaigns.reload(); }} />
    <div className="grid4"><StatCard label="Doanh thu bán voucher" value={report.data ? money(report.data.totalRevenue) : null} hint="Đã trừ voucher hoàn tiền" icon="cash" /><StatCard label="Voucher đã bán" value={report.data?.totalVoucherSold} hint="Từ báo cáo đơn đã phát hành" /><StatCard label="Chiến dịch đang bán" value={report.data?.activeCampaigns} icon="campaign" /><StatCard label="Chiến dịch chờ duyệt" value={campaigns.data?.filter(c => c.status === 'PENDING').length} icon="clock" /></div>
    <h2 className="section-heading">Thao tác nhanh</h2><QuickActions />
    <div className="overview-columns"><section className="card"><div className="section-header"><div><h2>Chiến dịch gần đây</h2><p className="small muted">Theo danh sách chiến dịch của thương hiệu</p></div><Link to="/web/brand/campaigns">Xem tất cả →</Link></div>{campaigns.loading ? <Spinner /> : !campaigns.data?.length ? <Empty>Chưa có chiến dịch. Tạo voucher đầu tiên để bắt đầu.</Empty> : <div className="table-scroll"><table className="table"><thead><tr><th>Chiến dịch</th><th>Giá bán</th><th>Đã bán</th><th>Trạng thái</th></tr></thead><tbody>{campaigns.data.slice(0, 6).map(c => <tr key={c.id}><td><Link to={`/web/brand/campaigns/${c.id}/edit`}>{c.title}</Link></td><td>{money(c.salePrice)}</td><td>{c.soldQuantity}/{c.totalQuantity}</td><td><StatusBadge map={CAMPAIGN_STATUS} value={c.status} /></td></tr>)}</tbody></table></div>}</section><CashbackSummary load={claims} /></div>
  </div>;
}

function CashbackSummary({ load }) {
  const pending = load.data?.filter(x => x.status === 'PENDING_CASHBACK');
  return <section className="card"><div className="section-header"><h2>Nghĩa vụ Cashback</h2><Icon name="cash" /></div><ErrorBox error={load.error} onRetry={load.reload} />{load.loading ? <Spinner /> : load.data && <><div className="summary-amount">{money(pending.reduce((n, x) => n + x.claim.cashbackAmount, 0))}</div><p className="small muted">Chờ Merchant hoàn trực tiếp · {pending.length} claim</p><div className="summary-line"><span>Merchant đã báo hoàn</span><b>{load.data.filter(x => x.status === 'MERCHANT_REPORTED_PAID').length}</b></div><div className="summary-line"><span>Đang tranh chấp</span><b>{load.data.filter(x => x.status === 'DISPUTED').length}</b></div><p className="small muted mt">Trong tối đa 200 claim gần nhất. Khoản hoàn này là nghĩa vụ Merchant, tách riêng doanh thu bán voucher.</p></>}</section>;
}

export function StaffOverview() {
  const session = useSession(webApi);
  const history = useLoad(() => session?.activeStoreId ? webApi.get('/staff/history/today') : Promise.resolve([]), [session?.activeStoreId]);
  const claims = useLoad(() => session?.activeStoreId ? webApi.get('/staff/cashback') : Promise.resolve([]), [session?.activeStoreId]);
  return <div>
    <div className="page-head">
      <div><div className="eyebrow">VẬN HÀNH TẠI QUẦY</div><h1>{session?.activeStore?.name || 'Bắt đầu ca làm việc'}</h1><p className="muted">Xác minh voucher nhanh chóng, phục vụ khách hàng thuận tiện.</p></div>
      <Link className="btn btn-ghost" to="/web/store/select">Đổi chi nhánh</Link>
    </div>
    {!session?.activeStoreId && <div className="alert alert-warn">Chọn chi nhánh trước khi xác minh voucher và quản lý Cashback.</div>}
    <QuickActions staff />
    {session?.activeStoreId && <div className="overview-columns mt">
      <section className="card">
        <div className="section-header"><div><h2>Lượt xác minh hôm nay</h2>{history.data && <p className="small muted">{history.data.length} lượt do bạn xác minh tại chi nhánh</p>}</div><Link to="/web/store/history">Xem lịch sử →</Link></div>
        <ErrorBox error={history.error} onRetry={history.reload} />
        {history.loading ? <Spinner /> : history.data?.length === 0 ? <Empty>Chưa có lượt xác minh tại chi nhánh hôm nay.</Empty> : history.data?.slice(0, 6).map(h => (
          <div className="activity-row" key={h.id}><span className="action-icon"><Icon name="scan" /></span><div className="grow"><b>{h.campaignTitle}</b><div className="small muted">{h.voucherCode} · {dateTime(h.redeemedAt)}</div></div><b>{money(h.billAmount)}</b></div>
        ))}
      </section>
      <CashbackSummary load={claims} />
    </div>}
  </div>;
}
