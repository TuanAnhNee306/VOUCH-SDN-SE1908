import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { CatalogSkeleton, Pagination } from './MarketplaceUI';
import { loadAllCampaigns, loadCatalogPage } from '../utils/catalog';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { customerApi } from '../api/client';
import { Empty, ErrorBox, Spinner, useLoad, useToast } from '../components/ui';
import { VoucherCard } from './Explore';
import { TopBar } from './Layout';

const SORTS = [
  ['newest', 'Mới nhất'], ['price_asc', 'Giá tăng dần'], ['price_desc', 'Giá giảm dần'],
  ['discount_desc', 'Giảm nhiều nhất'], ['best_seller', 'Bán chạy'],
];
const EMPTY_FILTER = { categoryId: '', brandId: '', sort: 'newest', minPrice: '', maxPrice: '', minDiscount: '', maxDiscount: '' };


function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Trình duyệt không hỗ trợ định vị.'));
    return navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? 'Bạn chưa cho phép truy cập vị trí. Đang hiển thị danh sách mặc định.'
        : 'Không lấy được vị trí hiện tại. Đang hiển thị danh sách mặc định.')),
      { timeout: 10000, maximumAge: 60000 },
    );
  });
}

export function Search() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const urlKeyword = searchParams.get('keyword') || '';
  const [keyword, setKeyword] = useState(urlKeyword);
  const [query, setQuery] = useState(urlKeyword);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const dialogRef = useRef(null);
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [draft, setDraft] = useState(EMPTY_FILTER);
  const [sheet, setSheet] = useState(false);
  const [radius, setRadius] = useState(null);
  const [pos, setPos] = useState(null);
  const [locMsg, setLocMsg] = useState('');
  const categories = useLoad(() => customerApi.get('/categories'), []);
  const brands = useLoad(async () => [...new Map((await loadAllCampaigns(customerApi)).filter(c => c.brand).map(c => [c.brand.id, c.brand])).values()], []);
  useEffect(() => { setKeyword(urlKeyword); setQuery(urlKeyword); setPage(1); }, [urlKeyword]);
  useEffect(() => {
    if (sheet) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [sheet]);

  const params = new URLSearchParams();
  if (query) params.set('keyword', query);
  Object.entries(filter).forEach(([k, v]) => v !== '' && params.set(k, v));
  if (radius && pos) {
    params.set('radiusKm', radius);
    params.set('lat', pos.lat);
    params.set('lng', pos.lng);
    if (filter.sort === 'newest') params.set('sort', 'distance_asc');
  }
  const qs = params.toString();
  const list = useLoad(() => loadCatalogPage(customerApi, qs, { type, page }), [qs, type, page]);

  const pickRadius = async (r) => {
    setPage(1);
    if (radius === r) return setRadius(null);
    try {
      const p = pos || (await getPosition());
      setPos(p);
      setLocMsg('');
      return setRadius(r);
    } catch (e) {
      setLocMsg(e.message);
      setRadius(null);
      return toast(e.message, 'bad');
    }
  };

  const setF = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <div>
      <TopBar title="Tìm kiếm voucher" back={false} right={<button type="button" className="bell" onClick={() => navigate('/map')} aria-label="Bản đồ">🗺️</button>} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <p className="muted mb small">Tìm quyền lợi phù hợp với nhu cầu, giá mua và thương hiệu của bạn.</p>
        <form className="row gap" onSubmit={(e) => { e.preventDefault(); setQuery(keyword.trim()); setPage(1); }}>
          <div className="searchbox grow">
            <Icon name="search" /><input aria-label="Tên voucher hoặc thương hiệu" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tên voucher hoặc thương hiệu" />
            <button type="submit" className="link" aria-label="Tìm kiếm voucher"><Icon name="arrow" /></button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft(filter); setSheet(true); }}><Icon name="filter" />Lọc</button>
        </form>
        <div className="category-chips mt">{[['', 'Tất cả voucher'], ['CASHBACK', 'Cashback'], ['STORED_VALUE', 'Voucher mệnh giá']].map(([v,l]) => <button type="button" className={`category-chip ${type === v ? 'active' : ''}`} aria-pressed={type === v} key={v} onClick={() => { setType(v); setPage(1); }}>{l}</button>)}</div>
        <div className="chips mt">
          {[1, 3, 5].map((r) => (
            <button type="button" key={r} className={`chip ${radius === r ? 'active' : ''}`} onClick={() => pickRadius(r)}>
              {radius === r && '✓ '}Gần tôi {r} km
            </button>
          ))}
        </div>
        {locMsg && <div className="alert alert-warn small">{locMsg}</div>}
        <div className="small muted mt">{list.data ? `${list.data.total} kết quả` : ''}</div>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading ? <CatalogSkeleton /> : list.error ? null : list.data?.items.length === 0 ? (
          <Empty icon="🔎">Không tìm thấy voucher phù hợp.</Empty>
        ) : (
          <div className="vgrid mt">
            {list.data?.items.map((c) => <VoucherCard key={c.id} c={c} onClick={() => navigate(`/campaigns/${c.id}`)} />)}
          </div>
        )}
        <Pagination page={page} total={list.data?.total || 0} pageSize={12} onChange={setPage} busy={list.loading} />
      </div>

      <dialog ref={dialogRef} className="catalog-filter-dialog" aria-labelledby="filter-dialog-title" onCancel={() => setSheet(false)} onClick={e => { if (e.target === dialogRef.current) { const box = dialogRef.current.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) setSheet(false); } }}>
            <div className="filter-dialog-head"><h3 id="filter-dialog-title">Lọc và sắp xếp</h3><button type="button" aria-label="Đóng bộ lọc" onClick={() => setSheet(false)}>×</button></div>
            <label className="field"><span>Danh mục</span>
              <select value={draft.categoryId} onChange={setF('categoryId')}>
                <option value="">Tất cả</option>
                {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Sắp xếp</span>
              <select value={draft.sort} onChange={setF('sort')}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <ErrorBox error={brands.error || categories.error} />
            <label className="field"><span>Thương hiệu</span><select value={draft.brandId} onChange={setF('brandId')}><option value="">Tất cả thương hiệu</option>{brands.data?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <div className="grid2">
              <label className="field"><span>Giá từ (VND)</span><input type="number" min="0" value={draft.minPrice} onChange={setF('minPrice')} /></label>
              <label className="field"><span>Giá đến (VND)</span><input type="number" min="0" value={draft.maxPrice} onChange={setF('maxPrice')} /></label>
              <label className="field"><span>Giảm tối thiểu (%)</span><input type="number" min="0" max="100" value={draft.minDiscount} onChange={setF('minDiscount')} /></label>
              <label className="field"><span>Giảm tối đa (%)</span><input type="number" min="0" max="100" value={draft.maxDiscount} onChange={setF('maxDiscount')} /></label>
            </div>
            <button type="button" className="btn btn-block" onClick={() => { setFilter(draft); setPage(1); setSheet(false); }}>Áp dụng</button>
            <button type="button" className="link btn-block mt" onClick={() => { setFilter(EMPTY_FILTER); setDraft(EMPTY_FILTER); setPage(1); setSheet(false); }}>Xóa bộ lọc</button>
      </dialog>
    </div>
  );
}

// MapContainer chi doc center luc mount: khi co vi tri thi bay toi do, chua co thi thu vua tat ca ghim
function FitView({ me, stores }) {
  const map = useMap();
  useEffect(() => {
    if (me) map.setView([me.lat, me.lng], 14);
    else if (stores?.length) map.fitBounds(stores.map((s) => [s.latitude, s.longitude]), { padding: [30, 30], maxZoom: 14 });
  }, [map, me, stores]);
  return null;
}

// Ban do cac chi nhanh cua voucher dang ban; cham ghim xem ten, dia chi va nut chi duong
export function MapPage() {
  const navigate = useNavigate();
  const stores = useLoad(() => customerApi.get('/map/stores'), []);
  const [me, setMe] = useState(null);
  useEffect(() => {
    getPosition().then(setMe).catch(() => {});
  }, []);
  return (
    <div>
      <TopBar title="Bản đồ chi nhánh" />
      <div className="screen" style={{ paddingTop: 0 }}>
        <p className="small muted mb">Chi nhánh của các voucher đang bán. Chạm ghim để xem và chỉ đường.</p>
        <ErrorBox error={stores.error} />
        <div className="map">
          <MapContainer center={[10.776, 106.70]} zoom={13} style={{ height: '100%' }}>
            <FitView me={me} stores={stores.data} />
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {me && <CircleMarker center={[me.lat, me.lng]} radius={8} pathOptions={{ color: '#d23434', fillOpacity: 0.9 }}><Popup>Vị trí của bạn</Popup></CircleMarker>}
            {stores.data?.map((s) => (
              <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={9} pathOptions={{ color: '#0b7a65', fillOpacity: 0.85 }}>
                <Popup>
                  <b>{s.name}</b><br />{s.address}<br />
                  {s.campaigns.slice(0, 3).map((c) => (
                    <div key={c.id}><button type="button" className="link small" onClick={() => navigate(`/campaigns/${c.id}`)}>🏷️ {c.title}</button></div>
                  ))}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer">➤ Chỉ đường</a>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
