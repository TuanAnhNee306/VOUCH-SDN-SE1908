import { createContext, useContext, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { webApi } from '../api/client';
import { Badge, Empty, ErrorBox, PromptDialog, Spinner, StatusBadge, useAction, useLoad, useToast } from '../components/ui';
import { BRAND_STATUS, CAMPAIGN_STATUS, date, dateTime, money, toLocalInput, VOUCHER_TYPES } from '../utils/format';
import { valueText } from '../customer/Campaign';

export const BrandContext = createContext({ brand: null });
const useBrand = () => useContext(BrandContext);

// ---------- Chien dich ----------
export function BrandCampaigns() {
  const navigate = useNavigate();
  const { brand } = useBrand();
  const list = useLoad(() => webApi.get(`/brand/${brand.id}/campaigns`), [brand.id]);
  const [confirm, setConfirm] = useState(null);
  const [busy, run] = useAction();
  const act = async (c, action, msg) => {
    const r = await run(() => webApi.patch(`/brand/${brand.id}/campaigns/${c.id}/${action}`), msg);
    if (r) list.reload(true);
    setConfirm(null);
  };
  return (
    <div>
      <div className="page-head">
        <div><h1>Chiến dịch voucher</h1><div className="small muted">{brand.name}</div></div>
        <div className="row gap">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => list.reload()}>⟳</button>
          <button type="button" className="btn" onClick={() => navigate('/web/brand/campaigns/new')}>+ Tạo chiến dịch</button>
        </div>
      </div>
      <ErrorBox error={list.error} />
      {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty icon="📣">Chưa có chiến dịch nào.</Empty> : list.data?.map((c) => (
        <div key={c.id} className="card">
          <div className="row between gap">
            <div className="grow">
              <div className="row gap"><span className="bold" style={{ fontSize: 15 }}>{c.title}</span><StatusBadge map={CAMPAIGN_STATUS} value={c.status} /></div>
              <div className="small muted">{VOUCHER_TYPES[c.voucherType]} · Giá bán {money(c.salePrice)} · {valueText(c)} · Đã bán {c.soldQuantity}/{c.totalQuantity} · Còn {c.availableQuantity} · Tối đa {c.limitPerUser}/người</div>
              <div className="small muted">Bán {date(c.saleStartAt)} – {date(c.saleEndAt)} · HSD {date(c.voucherExpireAt)} · Chi nhánh: {c.stores.map((s) => s.name).join(', ')}</div>
              {c.rejectReason && c.status === 'DRAFT' && <div className="alert alert-bad small">Bị từ chối: {c.rejectReason}</div>}
            </div>
            <div className="price">{money(c.salePrice)}</div>
          </div>
          <div className="row gap mt wrap">
            {!['PENDING', 'ENDED'].includes(c.status) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/web/brand/campaigns/${c.id}/edit`)}>✎ Sửa</button>}
            {c.status === 'DRAFT' && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setConfirm({ c, action: 'submit', title: 'Gửi duyệt chiến dịch', message: `Gửi "${c.title}" cho quản trị viên duyệt? Chiến dịch sẽ bị khóa chỉnh sửa trong lúc chờ.`, ok: 'Đã gửi duyệt chiến dịch.' })}>➤ Gửi duyệt</button>}
            {c.status === 'PENDING' && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(c, 'withdraw', 'Đã rút về nháp.')}>↩ Rút về nháp</button>}
            {['PUBLISHED', 'SOLD_OUT'].includes(c.status) && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(c, 'pause', 'Đã tạm dừng chiến dịch.')}>❚❚ Tạm dừng</button>}
            {c.status === 'PAUSED' && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act(c, 'resume', 'Đã mở bán lại.')}>▶ Tiếp tục bán</button>}
          </div>
        </div>
      ))}
      <PromptDialog open={!!confirm} title={confirm?.title} message={confirm?.message} confirmText="Gửi duyệt" required={false}
        onClose={() => setConfirm(null)} onConfirm={() => act(confirm.c, confirm.action, confirm.ok)} />
    </div>
  );
}

const EMPTY = {
  title: '', voucherType: 'DISCOUNT', image: '', description: '', terms: '', categoryId: '', salePrice: '', faceValue: '',
  discountType: 'PERCENT', discountValue: '', maxDiscount: '', comboItems: '', totalQuantity: 100, limitPerUser: 5,
  saleStartAt: '', saleEndAt: '', voucherExpireAt: '', storeIds: [],
};

// Gia tri khach nhan duoc: ma giam gia = so tien giam / muc giam toi da; loai khac = menh gia / gia niem yet
const valueOf = (f) => Number(f.voucherType !== 'DISCOUNT' ? f.faceValue : f.discountType === 'PERCENT' ? f.maxDiscount : f.discountValue) || 0;

// Kiem tra ngay tren form (may chu van kiem tra lai): khach phai tra it hon gia tri nhan duoc
function valueProblem(f) {
  const price = Number(f.salePrice);
  if (!price) return null;
  if (f.voucherType === 'DISCOUNT' && f.discountType === 'PERCENT' && Number(f.discountValue) > 100) return 'Phần trăm giảm phải từ 1 đến 100.';
  if (!valueOf(f)) return null;
  if (valueOf(f) > price) return null;
  if (f.voucherType === 'PREPAID') return `Mệnh giá phải lớn hơn giá bán ${money(price)}.`;
  if (f.voucherType === 'COMBO') return `Giá niêm yết của gói phải lớn hơn giá bán ${money(price)}.`;
  return `${f.discountType === 'PERCENT' ? 'Mức giảm tối đa' : 'Số tiền giảm'} phải lớn hơn giá bán ${money(price)}, nếu không khách mua mã sẽ bị lỗ.`;
}

export function CampaignForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { brand } = useBrand();
  const stores = useLoad(() => webApi.get(`/brand/${brand.id}/stores`), [brand.id]);
  const categories = useLoad(() => webApi.get('/categories'), []);
  const [form, setForm] = useState(null);
  const [locked, setLocked] = useState(false);
  const [busy, run] = useAction();
  useLoad(async () => {
    if (!id) return setForm(EMPTY);
    const list = await webApi.get(`/brand/${brand.id}/campaigns`);
    const c = list.find((x) => x.id === id);
    if (!c) return toast('Không tìm thấy chiến dịch.', 'bad');
    setLocked(c.soldQuantity > 0);
    return setForm({
      ...EMPTY, ...c, categoryId: c.categoryId || '', image: c.image || '', discountType: c.discountType || 'PERCENT',
      discountValue: c.discountValue ?? '', maxDiscount: c.maxDiscount ?? '', comboItems: c.comboItems || '',
      saleStartAt: toLocalInput(c.saleStartAt), saleEndAt: toLocalInput(c.saleEndAt), voucherExpireAt: toLocalInput(c.voucherExpireAt),
      storeIds: c.storeIds.map(String), status: c.status,
    });
  }, [id]);
  if (!form) return <Spinner />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleStore = (sid) => setForm({ ...form, storeIds: form.storeIds.includes(sid) ? form.storeIds.filter((x) => x !== sid) : [...form.storeIds, sid] });

  const submit = async (e) => {
    e.preventDefault();
    if (!locked && valueProblem(form)) return toast(valueProblem(form), 'bad');
    const body = {
      ...form,
      saleStartAt: form.saleStartAt ? new Date(form.saleStartAt).toISOString() : '',
      saleEndAt: form.saleEndAt ? new Date(form.saleEndAt).toISOString() : '',
      voucherExpireAt: form.voucherExpireAt ? new Date(form.voucherExpireAt).toISOString() : '',
    };
    for (const k of ['id', 'status', 'stores', 'brand', 'availableQuantity', 'soldQuantity', 'reservedQuantity', 'brandId', 'createdAt', 'updatedAt', 'searchText', 'approvedAt', 'approvedBy', 'submittedAt', 'rejectReason']) delete body[k];
    if (form.voucherType === 'DISCOUNT') delete body.faceValue; // may chu tu tinh
    if (locked) ['salePrice', 'faceValue', 'voucherType', 'discountType', 'discountValue', 'maxDiscount', 'voucherExpireAt'].forEach((k) => delete body[k]);
    const r = await run(() => (id ? webApi.patch(`/brand/${brand.id}/campaigns/${id}`, body) : webApi.post(`/brand/${brand.id}/campaigns`, body)),
      id ? (['APPROVED', 'PUBLISHED', 'SOLD_OUT', 'PAUSED'].includes(form.status) ? 'Đã lưu. Chiến dịch chuyển sang chờ duyệt lại.' : 'Đã lưu chiến dịch.') : 'Đã lưu nháp.');
    if (r) navigate('/web/brand/campaigns');
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 760 }}>
      <div className="page-head"><h1>{id ? 'Sửa chiến dịch' : 'Tạo chiến dịch mới'}</h1></div>
      {locked && <div className="alert alert-warn small">Chiến dịch đã bán được voucher: không sửa được giá bán, giá trị, loại voucher và hạn sử dụng (BR-17).</div>}
      <div className="card">
        <div className="card-title">Thông tin chung</div>
        <label className="field"><span>Tiêu đề *</span><input required value={form.title} onChange={set('title')} /></label>
        <div className="grid2">
          <label className="field"><span>Loại voucher *</span>
            <select value={form.voucherType} onChange={set('voucherType')} disabled={locked}>{Object.entries(VOUCHER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <label className="field"><span>Danh mục</span>
            <select value={form.categoryId} onChange={set('categoryId')}><option value="">— Chọn —</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
        </div>
        <label className="field"><span>Đường dẫn ảnh</span><input value={form.image} onChange={set('image')} placeholder="https://..." /></label>
        <label className="field"><span>Mô tả</span><textarea rows={2} value={form.description} onChange={set('description')} /></label>
        <label className="field"><span>Điều kiện áp dụng</span><textarea rows={2} value={form.terms} onChange={set('terms')} /></label>
      </div>
      <div className="card">
        <div className="card-title">Giá và số lượng</div>
        <div className="grid2">
          <label className="field"><span>Giá bán (VND) *</span><input type="number" min="1" step="1" required disabled={locked} value={form.salePrice} onChange={set('salePrice')} /></label>
          {form.voucherType === 'DISCOUNT' ? (
            <div className="field"><span>Giá trị voucher</span>
              <div className="input muted" style={{ background: 'var(--bg, #f4f7f6)' }}>{valueOf(form) > 0 ? `${money(valueOf(form))} (tự tính)` : 'Tự tính từ mức giảm bên dưới'}</div>
            </div>
          ) : (
            <label className="field"><span>{form.voucherType === 'PREPAID' ? 'Mệnh giá voucher (VND) *' : 'Giá niêm yết của gói (VND) *'}</span>
              <input type="number" min="1" step="1" required disabled={locked} value={form.faceValue} onChange={set('faceValue')} /></label>
          )}
        </div>
        {!locked && valueProblem(form) && <div className="alert alert-bad small">{valueProblem(form)}</div>}
        {form.voucherType === 'DISCOUNT' && (
          <div className="grid3">
            <label className="field"><span>Kiểu giảm *</span>
              <select value={form.discountType} onChange={set('discountType')} disabled={locked}><option value="PERCENT">Giảm theo phần trăm</option><option value="AMOUNT">Giảm theo số tiền</option></select>
            </label>
            <label className="field"><span>{form.discountType === 'PERCENT' ? 'Phần trăm giảm (1-100) *' : 'Số tiền giảm (VND) *'}</span><input type="number" min="1" disabled={locked} value={form.discountValue} onChange={set('discountValue')} /></label>
            {form.discountType === 'PERCENT' && <label className="field"><span>Giảm tối đa (VND) *</span><input type="number" min="1" disabled={locked} value={form.maxDiscount} onChange={set('maxDiscount')} /></label>}
          </div>
        )}
        {form.voucherType === 'COMBO' && <label className="field"><span>Nội dung gói combo *</span><input value={form.comboItems} onChange={set('comboItems')} /></label>}
        <div className="grid2">
          <label className="field"><span>Số lượng phát hành *</span><input type="number" min="1" required value={form.totalQuantity} onChange={set('totalQuantity')} /></label>
          <label className="field"><span>Giới hạn mua mỗi người *</span><input type="number" min="1" required value={form.limitPerUser} onChange={set('limitPerUser')} /></label>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Thời gian (giờ Việt Nam)</div>
        <div className="grid3">
          <label className="field"><span>Bắt đầu bán *</span><input type="datetime-local" required value={form.saleStartAt} onChange={set('saleStartAt')} /></label>
          <label className="field"><span>Kết thúc bán *</span><input type="datetime-local" required value={form.saleEndAt} onChange={set('saleEndAt')} /></label>
          <label className="field"><span>Hạn sử dụng *</span><input type="datetime-local" required disabled={locked} value={form.voucherExpireAt} onChange={set('voucherExpireAt')} /></label>
        </div>
        <div className="small muted">Hạn sử dụng phải sau ngày kết thúc bán ít nhất 10 ngày (BR-21).</div>
      </div>
      <div className="card">
        <div className="card-title">Chi nhánh áp dụng *</div>
        {stores.data?.filter((s) => s.status).map((s) => (
          <label key={s.id} className="check"><input type="checkbox" checked={form.storeIds.includes(s.id)} onChange={() => toggleStore(s.id)} /><span><b>{s.name}</b> <span className="small muted">{s.address}</span></span></label>
        ))}
        {stores.data?.length === 0 && <div className="muted small">Chưa có chi nhánh. Hãy tạo chi nhánh trước.</div>}
      </div>
      <div className="row end gap mt">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/web/brand/campaigns')}>Hủy</button>
        <button className="btn" disabled={busy}>{id ? 'Lưu thay đổi' : 'Lưu nháp'}</button>
      </div>
    </form>
  );
}

// ---------- Chi nhanh ----------
const STORE_EMPTY = { name: '', address: '', latitude: '', longitude: '', phone: '', openingHours: '' };
export function BrandStores() {
  const { brand } = useBrand();
  const list = useLoad(() => webApi.get(`/brand/${brand.id}/stores`), [brand.id]);
  const [form, setForm] = useState(null);
  const [busy, run] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) };
    const r = await run(() => (form.id ? webApi.patch(`/brand/${brand.id}/stores/${form.id}`, body) : webApi.post(`/brand/${brand.id}/stores`, body)), 'Đã lưu chi nhánh.');
    if (r) { setForm(null); list.reload(true); }
  };
  const toggle = async (s) => {
    const r = await run(() => webApi.patch(`/brand/${brand.id}/stores/${s.id}`, { status: !s.status }), s.status ? 'Đã vô hiệu hóa chi nhánh.' : 'Đã mở lại chi nhánh.');
    if (r) list.reload(true);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div>
      <div className="page-head"><h1>Chi nhánh</h1><button type="button" className="btn" onClick={() => setForm(STORE_EMPTY)}>+ Thêm chi nhánh</button></div>
      {form && (
        <form className="card mb" onSubmit={save}>
          <div className="card-title">{form.id ? 'Sửa chi nhánh' : 'Chi nhánh mới'}</div>
          <div className="grid2">
            <label className="field"><span>Tên *</span><input required value={form.name} onChange={set('name')} /></label>
            <label className="field"><span>Địa chỉ *</span><input required value={form.address} onChange={set('address')} /></label>
            <label className="field"><span>Vĩ độ * (DC-05)</span><input type="number" step="any" required value={form.latitude} onChange={set('latitude')} /></label>
            <label className="field"><span>Kinh độ *</span><input type="number" step="any" required value={form.longitude} onChange={set('longitude')} /></label>
            <label className="field"><span>Điện thoại</span><input value={form.phone || ''} onChange={set('phone')} /></label>
            <label className="field"><span>Giờ mở cửa</span><input value={form.openingHours || ''} onChange={set('openingHours')} placeholder="07:00 - 22:00" /></label>
          </div>
          <div className="row end gap"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Hủy</button><button className="btn" disabled={busy}>Lưu</button></div>
        </form>
      )}
      <ErrorBox error={list.error} />
      {list.loading && !list.data ? <Spinner /> : (
        <table className="table">
          <thead><tr><th>Chi nhánh</th><th>Tọa độ</th><th>Giờ mở cửa</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>{list.data?.map((s) => (
            <tr key={s.id}>
              <td><b>{s.name}</b><div className="small muted">{s.address}</div></td>
              <td className="small">{s.latitude}, {s.longitude}</td>
              <td className="small">{s.openingHours}</td>
              <td><Badge tone={s.status ? 'ok' : 'gray'}>{s.status ? 'Hoạt động' : 'Vô hiệu'}</Badge></td>
              <td className="row gap"><button type="button" className="link small" onClick={() => setForm(s)}>Sửa</button><button type="button" className="link small" disabled={busy} onClick={() => toggle(s)}>{s.status ? 'Vô hiệu hóa' : 'Mở lại'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Nhan vien ----------
export function BrandStaff() {
  const { brand } = useBrand();
  const list = useLoad(() => webApi.get(`/brand/${brand.id}/staff`), [brand.id]);
  const stores = useLoad(() => webApi.get(`/brand/${brand.id}/stores`), [brand.id]);
  const [form, setForm] = useState({ email: '', fullName: '', storeId: '' });
  const [link, setLink] = useState(null);
  const [confirmOff, setConfirmOff] = useState(null);
  const [busy, run] = useAction();
  const add = async (e) => {
    e.preventDefault();
    const r = await run(() => webApi.post(`/brand/${brand.id}/staff`, form), 'Đã gán nhân viên vào chi nhánh.');
    if (r) { setLink(r.activationLink); setForm({ ...form, email: '', fullName: '' }); list.reload(true); }
  };
  const deactivate = async (a) => {
    const r = await run(() => webApi.patch(`/brand/${brand.id}/staff/${a.id}/deactivate`), 'Đã vô hiệu hóa nhân viên và thu hồi phiên đăng nhập.');
    if (r) list.reload(true);
    setConfirmOff(null);
  };
  return (
    <div>
      <div className="page-head"><h1>Nhân viên</h1></div>
      <form className="card mb" onSubmit={add}>
        <div className="card-title">Gán nhân viên vào chi nhánh</div>
        <div className="grid3">
          <label className="field"><span>Email *</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span>Họ tên</span><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
          <label className="field"><span>Chi nhánh *</span>
            <select required value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}><option value="">— Chọn —</option>{stores.data?.filter((s) => s.status).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </label>
        </div>
        <div className="small muted">Tài khoản mới sẽ nhận liên kết kích hoạt qua email để tự đặt mật khẩu.</div>
        {link && <div className="alert alert-info small">Demo: <a href={link}>liên kết kích hoạt tài khoản</a></div>}
        <div className="row end"><button className="btn" disabled={busy}>+ Gán nhân viên</button></div>
      </form>
      {list.loading && !list.data ? <Spinner /> : (
        <table className="table">
          <thead><tr><th>Nhân viên</th><th>Chi nhánh</th><th>Ngày gán</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>{list.data?.map((a) => (
            <tr key={a.id}>
              <td><b>{a.fullName || '—'}</b><div className="small muted">{a.email}</div></td>
              <td>{a.storeName}</td>
              <td className="small">{date(a.assignedAt)}</td>
              <td><Badge tone={a.active ? (a.userStatus === 'ACTIVE' ? 'ok' : 'warn') : 'gray'}>{a.active ? (a.userStatus === 'ACTIVE' ? 'Hoạt động' : 'Chờ kích hoạt') : 'Vô hiệu'}</Badge></td>
              <td>{a.active && <button type="button" className="link small" disabled={busy} onClick={() => setConfirmOff(a)}>Vô hiệu hóa</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <ErrorBox error={list.error} onRetry={list.reload} />
      <PromptDialog open={!!confirmOff} title={`Vô hiệu hóa ${confirmOff?.email}`} required={false} confirmText="Vô hiệu hóa"
        message="Tài khoản bị khóa ở tất cả chi nhánh và bị đăng xuất ngay. Muốn dùng lại phải gán lại và kích hoạt lại qua email."
        onClose={() => setConfirmOff(null)} onConfirm={() => deactivate(confirmOff)} />
    </div>
  );
}

// ---------- Danh gia ----------
export function BrandReviews() {
  const { brand } = useBrand();
  const list = useLoad(() => webApi.get(`/brand/${brand.id}/reviews`), [brand.id]);
  const [reply, setReply] = useState(null);
  const [, run] = useAction();
  return (
    <div>
      <div className="page-head"><h1>Đánh giá của khách</h1></div>
      {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty icon="☆">Chưa có đánh giá.</Empty> : list.data?.map((r) => (
        <div key={r.id} className="card">
          <div className="row between"><b>{r.reviewerName} · {r.campaignTitle}</b><span style={{ color: '#f5a623' }}>{'★'.repeat(r.rating)}</span></div>
          <div>{r.comment || <i className="muted">Không có nhận xét</i>}</div>
          <div className="small muted">{dateTime(r.createdAt)} {r.status === 'HIDDEN' && <Badge tone="gray">Đã bị ẩn bởi quản trị viên</Badge>}</div>
          {r.brandReply ? <div className="alert alert-info small"><b>Phản hồi:</b> {r.brandReply}</div> : (
            <button type="button" className="btn btn-ghost btn-sm mt" onClick={() => setReply(r)}>Phản hồi</button>
          )}
        </div>
      ))}
      <PromptDialog open={!!reply} title="Phản hồi đánh giá" message="Mỗi đánh giá chỉ phản hồi một lần và hiển thị công khai." label="Nội dung phản hồi"
        onClose={() => setReply(null)} onConfirm={async (text) => {
          const r = await run(() => webApi.patch(`/brand/${brand.id}/reviews/${reply.id}/reply`, { reply: text }), 'Đã phản hồi.');
          if (r) { setReply(null); list.reload(true); }
        }} />
    </div>
  );
}

// ---------- Bao cao ----------
export function BrandReport() {
  const { brand } = useBrand();
  const [q, setQ] = useState({ from: '', to: '', campaignId: '', storeId: '' });
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
  const report = useLoad(() => webApi.get(`/brand/${brand.id}/report?${qs}`), [brand.id, qs]);
  const stores = useLoad(() => webApi.get(`/brand/${brand.id}/stores`), [brand.id]);
  const campaigns = useLoad(() => webApi.get(`/brand/${brand.id}/campaigns`), [brand.id]);
  const r = report.data;
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  return (
    <div>
      <div className="page-head"><h1>Báo cáo</h1></div>
      <div className="card mb grid4">
        <label className="field"><span>Từ ngày</span><input type="date" value={q.from} onChange={set('from')} /></label>
        <label className="field"><span>Đến ngày</span><input type="date" value={q.to} onChange={set('to')} /></label>
        <label className="field"><span>Chiến dịch</span><select value={q.campaignId} onChange={set('campaignId')}><option value="">Tất cả</option>{campaigns.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className="field"><span>Chi nhánh (nơi sử dụng)</span><select value={q.storeId} onChange={set('storeId')}><option value="">Tất cả</option>{stores.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </div>
      <ErrorBox error={report.error} />
      {r && (
        <>
          <div className="grid4">
            <div className="stat"><div className="small muted">Voucher đã bán</div><div className="v">{r.totalVoucherSold}</div></div>
            <div className="stat"><div className="small muted">Doanh thu (trừ hoàn)</div><div className="v">{money(r.totalRevenue)}</div></div>
            <div className="stat"><div className="small muted">Đã sử dụng</div><div className="v">{r.totalVoucherUsed}</div></div>
            <div className="stat"><div className="small muted">Tỷ lệ sử dụng</div><div className="v">{r.usageRate.toFixed(1)}%</div></div>
          </div>
          <div className="grid4 mt">
            <div className="stat"><div className="small muted">Chiến dịch</div><div className="v">{r.totalCampaigns}</div></div>
            <div className="stat"><div className="small muted">Đang bán</div><div className="v">{r.activeCampaigns}</div></div>
            <div className="stat"><div className="small muted">Đã hoàn tiền</div><div className="v">{r.totalVoucherRefunded}</div></div>
            <div className="stat"><div className="small muted">Hết hạn</div><div className="v">{r.totalVoucherExpired}</div></div>
          </div>
          <table className="table mt">
            <thead><tr><th>Chiến dịch</th><th>Trạng thái</th><th>Đã bán</th><th>Đã dùng</th><th>Doanh thu</th></tr></thead>
            <tbody>{r.byCampaign.map((c) => <tr key={c.id}><td>{c.title}</td><td><StatusBadge map={CAMPAIGN_STATUS} value={c.status} /></td><td>{c.sold}</td><td>{c.used}</td><td>{money(c.revenue)}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------- Doi soat ----------
export function SettlementTable({ list, admin = false, onPay }) {
  if (!list) return <Spinner />;
  if (list.length === 0) return <Empty icon="🧾">Chưa có phiếu đối soát nào.</Empty>;
  return list.map((s) => (
    <div key={s.id} className="card">
      <div className="row between gap">
        <div className="grow">
          <div className="bold">{admin && `${s.brandName} · `}Kỳ {date(s.periodStart)} – {date(new Date(new Date(s.periodEnd).getTime() - 1))}</div>
          <div className="small">Doanh thu gộp {money(s.grossRevenue)} · {s.voucherCount} voucher · Hoa hồng {money(s.commissionAmount)} · <b>Thực nhận {money(s.payableAmount)}</b></div>
          {s.status === 'PAID' && <div className="small muted">Chi trả {dateTime(s.paidAt)} · Mã GD {s.bankTxnRef}</div>}
        </div>
        <Badge tone={s.status === 'PAID' ? 'ok' : 'warn'}>{s.status === 'PAID' ? 'Đã chi trả' : 'Chờ chi trả'}</Badge>
      </div>
      {admin && s.status === 'PENDING' && <button type="button" className="btn btn-ghost btn-sm mt" onClick={() => onPay(s)}>✓ Đánh dấu đã chi trả</button>}
    </div>
  ));
}

export function BrandSettlements() {
  const { brand } = useBrand();
  const list = useLoad(() => webApi.get(`/brand/${brand.id}/settlements`), [brand.id]);
  return (
    <div>
      <div className="page-head"><div><h1>Phiếu đối soát</h1><div className="small muted">Doanh thu đã trừ hoa hồng nền tảng, chốt theo tháng</div></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => list.reload()}>⟳</button></div>
      <ErrorBox error={list.error} />
      <SettlementTable list={list.data} />
    </div>
  );
}

// ---------- Ho so thuong hieu / dang ky thuong hieu ----------
export function BrandProfile({ brand, onSaved }) {
  const categories = useLoad(() => webApi.get('/categories'), []);
  const [form, setForm] = useState({
    name: brand?.name || '', logo: brand?.logo || '', description: brand?.description || '', categoryId: brand?.categoryId || '',
    contactInfo: brand?.contactInfo || '', bankInfo: brand?.bankInfo || '',
  });
  const [busy, run] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const r = await run(() => (brand ? webApi.patch(`/brand/${brand.id}`, form) : webApi.post('/brand', form)), brand ? 'Đã lưu hồ sơ.' : 'Đã gửi hồ sơ, chờ quản trị viên duyệt.');
    if (r) onSaved();
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={save} style={{ maxWidth: 680 }}>
      <div className="page-head"><h1>{brand ? 'Hồ sơ thương hiệu' : 'Đăng ký thương hiệu'}</h1>{brand && <StatusBadge map={BRAND_STATUS} value={brand.status} />}</div>
      {!brand && <div className="alert alert-info">Tài khoản chưa có thương hiệu. Gửi hồ sơ để quản trị viên duyệt.</div>}
      <div className="card">
        <label className="field"><span>Tên thương hiệu *</span><input required value={form.name} onChange={set('name')} /></label>
        <label className="field"><span>Logo (đường dẫn ảnh)</span><input value={form.logo} onChange={set('logo')} /></label>
        <label className="field"><span>Mô tả</span><textarea rows={3} value={form.description} onChange={set('description')} /></label>
        <div className="grid2">
          <label className="field"><span>Ngành hàng</span><select value={form.categoryId} onChange={set('categoryId')}><option value="">— Chọn —</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>Liên hệ</span><input value={form.contactInfo} onChange={set('contactInfo')} /></label>
        </div>
        <label className="field"><span>Tài khoản ngân hàng nhận đối soát</span><input value={form.bankInfo} onChange={set('bankInfo')} /></label>
        <div className="row end"><button className="btn" disabled={busy}>{brand ? 'Lưu' : 'Gửi hồ sơ'}</button></div>
      </div>
    </form>
  );
}
