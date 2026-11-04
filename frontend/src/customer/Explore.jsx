import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerApi, useSession } from '../api/client';
import { Badge, CampaignImage, Empty, ErrorBox, Logo, Spinner, useAction, useLoad } from '../components/ui';
import { km, money } from '../utils/format';
import { useUnread } from './Layout';

export function VoucherCard({ c, onClick }) {
  const navigate = useNavigate();
  const session = useSession(customerApi);
  const [busy, run] = useAction();
  const [favorited, setFavorited] = useState(!!c.favorited);
  useEffect(() => setFavorited(!!c.favorited), [c.favorited]);

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    if (!session) return navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    const r = await run(() => customerApi.post('/favorites', { targetType: 'CAMPAIGN', targetId: c.id }), null);
    if (r) setFavorited(r.favorited);
    return null;
  };

  return (
    <div className={`vcard ${favorited ? 'fav' : ''}`} onClick={onClick} role="button" tabIndex={0}>
      <CampaignImage
        src={c.image || c.brand?.logo}
        className={!c.image && c.brand?.logo ? 'brand-art' : ''}
        fallbackLabel={c.brand?.name}
      />
      {c.discountPercent > 0 && <span className="disc">-{c.discountPercent}%</span>}
      <button type="button" className="fav-btn" disabled={busy} onClick={toggleFavorite} aria-label={favorited ? 'Bỏ yêu thích' : 'Yêu thích'} title={favorited ? 'Bỏ yêu thích' : 'Yêu thích'}>
        {favorited ? '❤️' : '🤍'}
      </button>
      {c.soldOut && <span className="soldout"><Badge tone="bad">Hết hàng</Badge></span>}
      <div className="vbody">
        <div className="vtitle">{c.title}</div>
        {c.brand && (
          <div className="brand-mini">
            {c.brand.logo && <img src={c.brand.logo} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
            <span className="ellipsis">{c.brand.name}</span>
          </div>
        )}
        <div>
          <span className="price" style={{ fontSize: 15 }}>{money(c.salePrice)}</span>
          {c.faceValue > c.salePrice && <span className="small strike" style={{ marginLeft: 6 }}>{money(c.faceValue)}</span>}
        </div>
        <div className="small muted">🔥 Đã bán {c.soldQuantity}{c.distanceKm != null ? ` · ${km(c.distanceKm)}` : ''}</div>
      </div>
    </div>
  );
}

export default function Explore() {
  const navigate = useNavigate();
  const session = useSession(customerApi);
  const { unread } = useUnread();
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const categories = useLoad(() => customerApi.get('/categories'), []);
  const list = useLoad(() => customerApi.get(`/campaigns?sort=${sort}${category ? `&categoryId=${category}` : ''}`), [category, sort, session?.user?.id]);

  return (
    <div className="screen">
      <div className="row between mb mobile-only">
        <div>
          <Logo />
          <div className="small muted">Ưu đãi tốt. Kết nối liền.</div>
        </div>
        <button type="button" className="bell" onClick={() => navigate(session ? '/notifications' : '/login')} aria-label="Thông báo">
          🔔{unread > 0 && <span className="dot">{unread}</span>}
        </button>
      </div>

      <div className="hero" onClick={() => navigate('/search')} role="button">
        <div>
          <h2>Chạm để săn deal</h2>
          <p>Hàng trăm ưu đãi đang chờ bạn khám phá hôm nay.</p>
        </div>
        <div className="hero-icon">🎟️</div>
      </div>

      <div className="searchbox mt" onClick={() => navigate('/search')} role="button">
        🔍 <span className="muted">Tìm voucher hoặc thương hiệu</span>
      </div>

      <div className="section-title">Khám phá theo danh mục</div>
      <div className="chips">
        <button type="button" className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>{!category && '✓ '}Tất cả</button>
        {categories.data?.map((c) => (
          <button type="button" key={c.id} className={`chip ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>
            {category === c.id && '✓ '}{c.name}
          </button>
        ))}
      </div>
      <div className="row gap mt">
        <button type="button" className={`chip ${sort === 'newest' ? 'active' : ''}`} onClick={() => setSort('newest')}>{sort === 'newest' && '✓ '}Voucher mới</button>
        <button type="button" className={`chip ${sort === 'best_seller' ? 'active' : ''}`} onClick={() => setSort('best_seller')}>{sort === 'best_seller' && '✓ '}Bán chạy</button>
      </div>

      <div className="mt">
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Spinner /> : list.data?.items.length === 0 ? (
          <Empty icon="🏷️">Chưa có voucher trong danh mục này.</Empty>
        ) : (
          <div className="vgrid">
            {list.data?.items.map((c) => <VoucherCard key={c.id} c={c} onClick={() => navigate(`/campaigns/${c.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
