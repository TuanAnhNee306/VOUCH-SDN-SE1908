import { useNavigate, useParams } from 'react-router-dom';
import { customerApi, useSession } from '../api/client';
import { Badge, CampaignImage, ErrorBox, Spinner, useAction, useLoad } from '../components/ui';
import { date, dateTime, km, money, VOUCHER_TYPES } from '../utils/format';
import { VoucherCard } from './Explore';
import { TopBar } from './Layout';

export function valueText(c) {
  if (c.voucherType === 'DISCOUNT') {
    return c.discountType === 'PERCENT' ? `Giảm ${c.discountValue}% (tối đa ${money(c.maxDiscount)})` : `Giảm ${money(c.discountValue)}`;
  }
  if (c.voucherType === 'COMBO') return `Gói: ${c.comboItems} (giá niêm yết ${money(c.faceValue)})`;
  return `Giá trị: ${money(c.faceValue)}`;
}

function Stars({ value }) {
  return <span style={{ color: '#f5a623' }}>{'★'.repeat(Math.round(value || 0))}<span style={{ color: '#d0d8d5' }}>{'★'.repeat(5 - Math.round(value || 0))}</span></span>;
}

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession(customerApi);
  const { data: c, error, loading, setData } = useLoad(() => customerApi.get(`/campaigns/${id}`), [id, session?.user?.id]);
  const [busy, run] = useAction();

  const toggleFavorite = async () => {
    if (!session) return navigate(`/login?next=/campaigns/${id}`);
    const r = await run(() => customerApi.post('/favorites', { targetType: 'CAMPAIGN', targetId: id }), null);
    if (r) setData({ ...c, favorited: r.favorited });
    return null;
  };

  if (loading && !c) return <><TopBar title="Chi tiết voucher" /><Spinner /></>;
  if (error) return <><TopBar title="Chi tiết voucher" /><div className="screen"><ErrorBox error={error} /></div></>;

  return (
    <div>
      <TopBar title="Chi tiết voucher" right={<button type="button" className="bell" disabled={busy} onClick={toggleFavorite} aria-label="Yêu thích">{c.favorited ? '❤️' : '🤍'}</button>} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <CampaignImage src={c.image} className="detail-img" />
        <div className="mt">
          <h2>{c.title}</h2>
          <div className="small muted">{VOUCHER_TYPES[c.voucherType]}</div>
          <div className="row gap mt">
            <span className="price" style={{ fontSize: 22 }}>{money(c.salePrice)}</span>
            {c.discountPercent > 0 && <Badge tone="bad">-{c.discountPercent}%</Badge>}
          </div>
          <div className="small muted">{valueText(c)}</div>
          <div className="small muted">Còn lại: {c.availableQuantity} voucher · Đã bán {c.soldQuantity} · Tối đa {c.limitPerUser} / tài khoản</div>
        </div>

        {c.brand && (
          <div className="card mt row gap" onClick={() => navigate(`/brands/${c.brand.id}`)} role="button">
            {c.brand.logo ? <img src={c.brand.logo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'contain', background: '#fff' }} /> : <span style={{ fontSize: 28 }}>🏪</span>}
            <div className="grow"><div className="bold">{c.brand.name}</div><div className="small muted">Xem trang thương hiệu</div></div>
            <span>›</span>
          </div>
        )}
        {c.description && <div className="card"><div className="card-title">Mô tả</div>{c.description}</div>}
        <div className="card"><div className="card-title">Điều kiện áp dụng</div>{c.terms || 'Không có điều kiện đặc biệt.'}</div>
        <div className="card"><div className="card-title">Thời gian</div>
          <div>Bán đến: {dateTime(c.saleEndAt)}</div>
          <div>Hạn sử dụng: {dateTime(c.voucherExpireAt)}</div>
        </div>
        <div className="card"><div className="card-title">Chính sách hoàn tiền</div>{c.refundPolicy.description}</div>

        <div className="card">
          <div className="row between"><div className="card-title">Chi nhánh áp dụng</div>
            <button type="button" className="link small" onClick={() => navigate('/map')}>🗺️ Xem bản đồ</button>
          </div>
          {c.stores.map((s) => (
            <div key={s.id} className="row gap" style={{ padding: '6px 0' }}>
              <span>🏬</span>
              <div className="grow">
                <div className="bold">{s.name}</div>
                <div className="small muted">{s.address}</div>
                <div className="small muted">{s.openingHours}{s.distanceKm != null ? ` · ${km(s.distanceKm)}` : ''}</div>
              </div>
              <a className="small" href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer">Chỉ đường</a>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Đánh giá ({c.reviewCount}) {c.averageRating ? <span className="small"><Stars value={c.averageRating} /> {c.averageRating}</span> : null}</div>
          {c.reviews.length === 0 ? <div className="muted">Chưa có đánh giá nào.</div> : c.reviews.map((r) => (
            <div key={r.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div className="row between"><b>{r.reviewerName}</b><Stars value={r.rating} /></div>
              {r.comment && <div>{r.comment}</div>}
              <div className="small muted">{date(r.createdAt)}</div>
              {r.brandReply && <div className="alert alert-info small"><b>Phản hồi của thương hiệu:</b> {r.brandReply}</div>}
            </div>
          ))}
        </div>

        <div className="sticky-bottom">
          <button type="button" className="btn btn-block" disabled={!c.canPurchase} onClick={() => navigate(session ? `/checkout/${c.id}` : `/login?next=/checkout/${c.id}`)}>
            {c.canPurchase ? 'Mua ngay' : 'Đã hết hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BrandPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession(customerApi);
  const { data: b, error, loading, setData } = useLoad(() => customerApi.get(`/brands/${id}/public`), [id, session?.user?.id]);
  const [busy, run] = useAction();
  const follow = async () => {
    if (!session) return navigate(`/login?next=/brands/${id}`);
    const r = await run(() => customerApi.post('/favorites', { targetType: 'BRAND', targetId: id }), null);
    if (r) setData({ ...b, following: r.favorited, followerCount: b.followerCount + (r.favorited ? 1 : -1) });
    return null;
  };
  if (loading && !b) return <><TopBar title="Thương hiệu" /><Spinner /></>;
  if (error) return <><TopBar title="Thương hiệu" /><div className="screen"><ErrorBox error={error} /></div></>;
  return (
    <div>
      <TopBar title={b.name} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <div className="card row gap">
          {b.logo ? <img src={b.logo} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'contain', background: '#fff' }} /> : <span style={{ fontSize: 40 }}>🏪</span>}
          <div className="grow">
            <h2>{b.name}</h2>
            <div className="small muted">{b.description}</div>
            <div className="small muted">{b.followerCount} người theo dõi · {b.averageRating ? `${b.averageRating}★ (${b.reviewCount})` : 'Chưa có đánh giá'}</div>
          </div>
          <button type="button" className={`btn btn-sm ${b.following ? 'btn-ghost' : ''}`} disabled={busy} onClick={follow}>{b.following ? 'Đang theo dõi' : '+ Theo dõi'}</button>
        </div>
        <div className="section-title">Voucher đang bán</div>
        <div className="vgrid">{b.campaigns.map((c) => <VoucherCard key={c.id} c={c} onClick={() => navigate(`/campaigns/${c.id}`)} />)}</div>
        {b.campaigns.length === 0 && <div className="muted">Chưa có voucher đang bán.</div>}
        <div className="section-title">Chi nhánh</div>
        {b.stores.map((s) => <div key={s.id} className="card"><b>{s.name}</b><div className="small muted">{s.address} · {s.openingHours}</div></div>)}
      </div>
    </div>
  );
}
