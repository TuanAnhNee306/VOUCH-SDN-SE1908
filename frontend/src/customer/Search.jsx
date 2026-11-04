import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { customerApi } from '../api/client';
import { Empty, ErrorBox, Spinner, useLoad, useToast } from '../components/ui';
import { VoucherCard } from './Explore';
import { TopBar } from './Layout';

const SORTS = [
  ['newest', 'Mới nhất'], ['price_asc', 'Giá tăng dần'], ['price_desc', 'Giá giảm dần'],
  ['discount_desc', 'Giảm nhiều nhất'], ['best_seller', 'Bán chạy'],
];
const EMPTY_FILTER = { categoryId: '', sort: 'newest', minPrice: '', maxPrice: '', minDiscount: '', maxDiscount: '' };

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
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [draft, setDraft] = useState(EMPTY_FILTER);
  const [sheet, setSheet] = useState(false);
  const [radius, setRadius] = useState(null);
  const [pos, setPos] = useState(null);
  const [locMsg, setLocMsg] = useState('');
  const categories = useLoad(() => customerApi.get('/categories'), []);

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
  const list = useLoad(() => customerApi.get(`/campaigns?${qs}`), [qs]);

  const pickRadius = async (r) => {
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
        <form className="row gap" onSubmit={(e) => { e.preventDefault(); setQuery(keyword.trim()); }}>
          <div className="searchbox grow">
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tên voucher hoặc thương hiệu" />
            <button type="submit" className="link">🔍</button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft(filter); setSheet(true); }}>⚙️ Lọc</button>
        </form>
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
        {list.loading && !list.data ? <Spinner /> : list.data?.items.length === 0 ? (
          <Empty icon="🔎">Không tìm thấy voucher phù hợp.</Empty>
        ) : (
          <div className="vlist mt">
            {list.data?.items.map((c) => <VoucherCard key={c.id} c={c} onClick={() => navigate(`/campaigns/${c.id}`)} />)}
          </div>
        )}
      </div>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Lọc và sắp xếp</h3>
            <label className="field"><span>Danh mục</span>
              <select value={draft.categoryId} onChange={setF('categoryId')}>
                <option value="">Tất cả</option>
                {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Sắp xếp</span>
              <select value={draft.sort} onChange={setF('sort')}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <div className="grid2">
              <label className="field"><span>Giá từ (VND)</span><input type="number" min="0" value={draft.minPrice} onChange={setF('minPrice')} /></label>
              <label className="field"><span>Giá đến (VND)</span><input type="number" min="0" value={draft.maxPrice} onChange={setF('maxPrice')} /></label>
              <label className="field"><span>Giảm tối thiểu (%)</span><input type="number" min="0" max="100" value={draft.minDiscount} onChange={setF('minDiscount')} /></label>
              <label className="field"><span>Giảm tối đa (%)</span><input type="number" min="0" max="100" value={draft.maxDiscount} onChange={setF('maxDiscount')} /></label>
            </div>
            <button type="button" className="btn btn-block" onClick={() => { setFilter(draft); setSheet(false); }}>Áp dụng</button>
            <button type="button" className="link btn-block mt" onClick={() => { setFilter(EMPTY_FILTER); setDraft(EMPTY_FILTER); setSheet(false); }}>Xóa bộ lọc</button>
          </div>
        </div>
      )}
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
