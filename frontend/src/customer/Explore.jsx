import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { customerApi, useSession } from '../api/client';
import { Badge, CampaignImage, Empty, ErrorBox, useAction, useLoad } from '../components/ui';
import { Icon } from '../components/Icon';
import { date, km, money, VOUCHER_TYPES } from '../utils/format';
import { CatalogSkeleton, Pagination, VoucherBenefit } from './MarketplaceUI';

export function VoucherCard({ c }) {
  const navigate = useNavigate();
  const session = useSession(customerApi);
  const [busy, run] = useAction();
  const [favorited, setFavorited] = useState(!!c.favorited);
  useEffect(() => setFavorited(!!c.favorited), [c.favorited]);
  const toggleFavorite = async () => {
    if (!session) return navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    const r = await run(() => customerApi.post('/favorites', { targetType: 'CAMPAIGN', targetId: c.id }));
    if (r) setFavorited(r.favorited);
  };
  return <article className={`vcard ${favorited ? 'fav' : ''}`}>
    <Link to={`/campaigns/${c.id}`} className="voucher-card-link">
      <div className="voucher-art"><CampaignImage src={c.image || c.brand?.logo} className={!c.image && c.brand?.logo ? 'brand-art' : ''} fallbackLabel={c.brand?.name || c.title} /><span className={`voucher-type type-${c.voucherType}`}>{c.voucherType === 'CASHBACK' ? 'Cashback' : VOUCHER_TYPES[c.voucherType] || c.voucherType}</span></div>
      <div className="vbody"><div className="brand-mini">{c.brand?.logo && <img src={c.brand.logo} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}<span>{c.brand?.name || 'Voucher Marketplace'}</span></div><h3 className="vtitle">{c.title}</h3><VoucherBenefit voucher={c} /><div className="voucher-price"><div><span>Giá mua voucher</span><b>{money(c.salePrice)}</b></div><Icon name="arrow" /></div><div className="voucher-availability"><span>{c.soldOut ? <Badge tone="bad">Hết hàng</Badge> : `Đã bán ${c.soldQuantity ?? 0}`}{c.distanceKm != null ? ` · ${km(c.distanceKm)}` : ''}</span>{c.voucherExpireAt && <span>HSD {date(c.voucherExpireAt)}</span>}</div><div className="voucher-detail-label">Xem chi tiết →</div></div>
    </Link>
    <button type="button" className="fav-btn" disabled={busy} onClick={toggleFavorite} aria-pressed={favorited} aria-label={favorited ? `Bỏ yêu thích ${c.title}` : `Yêu thích ${c.title}`}><Icon name="heart" /></button>
  </article>;
}

export default function Explore() {
  const session = useSession(customerApi);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const categories = useLoad(() => customerApi.get('/categories'), []);
  const list = useLoad(() => customerApi.get(`/campaigns?sort=${sort}&page=${page}&pageSize=12${category ? `&categoryId=${category}` : ''}`), [category, sort, page, session?.user?.id]);
  return <div className="screen home-screen">
    <section className="market-hero"><div className="hero-copy"><div className="brand-eyebrow">VOUCHER CHO NHỮNG ĐIỀU BẠN YÊU</div><h1>Mỗi lựa chọn,<br />thêm một <em>trải nghiệm.</em></h1><p>Từ những buổi cà phê đến kế hoạch mua sắm. Khám phá voucher phù hợp, chọn quyền lợi và tận hưởng theo cách của bạn.</p><a className="btn" href="#catalog">Khám phá voucher <Icon name="arrow" /></a><div className="hero-note"><Icon name="ticket" size={16} /> Mua trực tuyến · Sử dụng tại thương hiệu</div></div><div className="hero-tickets" aria-label="Hai hình thức voucher"><div className="hero-ticket ticket-cashback"><span className="ticket-mark">vouch.</span><Icon name="cash" size={28} /><small>MUA QUYỀN NHẬN</small><b>Cashback</b><p>Thanh toán đủ hóa đơn.<br />Merchant hoàn theo điều kiện.</p><div className="ticket-dashes" /><span>Quyền lợi rõ ràng, chủ động lựa chọn</span></div><div className="hero-ticket ticket-value"><span className="ticket-mark">vouch.</span><Icon name="ticket" size={28} /><small>VOUCHER GIẢM GIÁ</small><b>Giảm trực tiếp.<br />Rõ quyền lợi.</b><p>Áp dụng hóa đơn tối thiểu<br />và mức giảm tối đa.</p></div></div></section>
    <div className="market-reassurance"><div><Icon name="search" /><span>Dễ dàng tìm ưu đãi phù hợp</span></div><div><Icon name="ticket" /><span>Voucher lưu ngay trong ví</span></div><div><Icon name="store" /><span>Sử dụng tại chi nhánh áp dụng</span></div></div>
    <section id="catalog" className="catalog-section"><div className="market-section-head"><div><div className="brand-eyebrow">KHÁM PHÁ MỖI NGÀY</div><h2>Chọn voucher dành cho bạn</h2><p className="muted">Thông tin giá mua và quyền lợi luôn hiển thị riêng.</p></div><Link to="/search" className="text-action">Tìm kiếm nâng cao <Icon name="arrow" size={16} /></Link></div>
      <ErrorBox error={categories.error} onRetry={categories.reload} /><div className="category-chips"><button type="button" className={`category-chip ${!category ? 'active' : ''}`} aria-pressed={!category} onClick={() => { setCategory(''); setPage(1); }}><Icon name="grid" size={18} />Tất cả</button>{categories.data?.map(c => <button type="button" key={c.id} className={`category-chip ${category === c.id ? 'active' : ''}`} aria-pressed={category === c.id} onClick={() => { setCategory(c.id); setPage(1); }}>{c.name}</button>)}</div>
      <div className="catalog-toolbar"><span className="small muted">{list.data ? `${list.data.total} voucher` : 'Đang tìm ưu đãi…'}</span><label>Sắp xếp <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="newest">Mới nhất</option><option value="best_seller">Bán chạy</option><option value="price_asc">Giá tăng dần</option></select></label></div><ErrorBox error={list.error} onRetry={list.reload} />{list.loading ? <CatalogSkeleton /> : list.data?.items.length === 0 ? <Empty icon="◇">Chưa có voucher trong danh mục này. Hãy thử danh mục khác.</Empty> : <div className="vgrid">{list.data?.items.map(c => <VoucherCard key={c.id} c={c} />)}</div>}<Pagination page={page} total={list.data?.total || 0} pageSize={12} onChange={setPage} busy={list.loading} />
    </section>
    <section className="how-it-works"><div className="brand-eyebrow">TỪ KHÁM PHÁ ĐẾN TRẢI NGHIỆM</div><h2>Đơn giản, trong từng bước.</h2><div className="how-grid">{[['01', 'Khám phá', 'Tìm theo nhu cầu, danh mục hoặc thương hiệu.'], ['02', 'Chọn quyền lợi', 'Đọc giá mua, điều kiện và chi nhánh áp dụng.'], ['03', 'Mua voucher', 'Hoàn tất thanh toán theo hướng dẫn để nhận vào ví.'], ['04', 'Sử dụng tại quầy', 'Mở mã trong ví và đưa cho nhân viên xác minh.']].map(([n, title, text]) => <div key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></div>)}</div><div className="voucher-explainer"><p><b>Cashback</b> · Bạn mua quyền nhận hoàn tiền. Thanh toán đủ hóa đơn, Merchant trực tiếp hoàn theo điều kiện.</p><p><b>Voucher giảm giá</b> · Merchant giảm trực tiếp trên hóa đơn đủ điều kiện, theo tỷ lệ hoặc số tiền đã công bố.</p></div></section>
  </div>;
}
