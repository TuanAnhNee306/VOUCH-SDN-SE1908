import { useContext, useState } from 'react';
import { webApi, useSession } from '../api/client';
import { BrandContext } from './Brand';
import { ErrorBox, Spinner, Empty, useAction, useLoad } from '../components/ui';
import { dateTime, money, toLocalInput } from '../utils/format';
export const CASHBACK_LABELS = { PENDING_CASHBACK: 'Chờ Merchant hoàn tiền', MERCHANT_REPORTED_PAID: 'Merchant đã báo hoàn; chờ Customer xác nhận', DISPUTED: 'Đang tranh chấp', COMPLETED: 'Đã xác nhận hoàn tất' };
function ReportForm({ item, endpoint, done }) {
  const [form, setForm] = useState({ paymentMethod: 'BANK_TRANSFER', paymentReference: '', paidAt: toLocalInput(new Date()) + ':' + String(new Date().getSeconds()).padStart(2, '0'), statement: '', note: '', attested: false });
  const [busy, run] = useAction();
  const set = k => e => setForm({ ...form, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    const result = await run(() => webApi.post(endpoint + '/' + item.id + (item.status === 'DISPUTED' ? '/supplement' : '/report-paid'), {
      paymentMethod: form.paymentMethod, paymentReference: form.paymentReference, paidAt: new Date(form.paidAt).toISOString(),
      evidence: { kind: 'ELECTRONIC_RECEIPT', statement: form.statement }, attested: form.attested, note: form.note,
    }), 'Đã ghi nhận lời khai và biên nhận Merchant. Chưa xác nhận Customer đã nhận tiền.');
    if (result) done();
  };
  return <form className="card mt" onSubmit={submit}>
    <h3>{item.status === 'DISPUTED' ? 'Bổ sung biên nhận theo yêu cầu Admin' : 'Báo đã hoàn tiền trực tiếp'}</h3>
    <div className="alert alert-warn small">Chỉ gửi sau khi đã thực sự trả tiền bên ngoài ứng dụng. Biên nhận điện tử là lời khai có lưu vết, chưa được ngân hàng hoặc Customer xác minh. Không nhập số tài khoản, CCCD hoặc thông tin nhạy cảm. Chưa hỗ trợ upload/URL chứng từ.</div>
    <label className="field"><span>Số tiền phải hoàn (VND)</span><input readOnly value={money(item.claim.cashbackAmount)} /></label>
    <label className="field"><span>Phương thức *</span><select value={form.paymentMethod} onChange={set('paymentMethod')}><option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option><option value="CASH">Tiền mặt</option></select></label>
    <label className="field"><span>Thời điểm thực tế đã hoàn *</span><input type="datetime-local" step="1" required value={form.paidAt} onChange={set('paidAt')} /></label>
    <label className="field"><span>Mã giao dịch / biên nhận duy nhất trong Brand *</span><input required maxLength={100} pattern="[A-Za-z0-9_-]+" value={form.paymentReference} onChange={set('paymentReference')} /></label>
    <label className="field"><span>{form.paymentMethod === 'CASH' ? 'Biên nhận giao tiền mặt: nội dung giao nhận và giao dịch liên quan *' : 'Biên nhận chuyển khoản: nội dung giao dịch và căn cứ tra soát *'}</span><textarea required maxLength={2000} value={form.statement} onChange={set('statement')} /></label>
    <label className="field"><span>Ghi chú</span><textarea maxLength={2000} value={form.note} onChange={set('note')} /></label>
    <label className="check"><input type="checkbox" required checked={form.attested} onChange={e => setForm({ ...form, attested: e.target.checked })} />Tôi cam kết đã trực tiếp hoàn đủ số tiền trên và chịu trách nhiệm về biên nhận này.</label>
    <button className="btn mt" disabled={busy || !form.attested}>Gửi biên nhận điện tử</button>
  </form>;
}
function ResolutionForm({ item, done }) {
  const [action, setAction] = useState('NOTE');
  const [note, setNote] = useState('');
  const [source, setSource] = useState('INDEPENDENT_RECONCILIATION');
  const [reference, setReference] = useState('');
  const [record, setRecord] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, run] = useAction();
  const submit = async e => {
    e.preventDefault(); if (busy) return;
    const r = await run(() => webApi.post('/admin/cashback/' + item.id + '/resolve', { action, note,
      ...(action === 'COMPLETE' ? { verification: { source, reference, record, independentlyVerified: verified } } : {}),
    }), 'Đã lưu quyết định và audit trail.');
    if (r) done();
  };
  return <form className="card mt" onSubmit={submit}>
    <h3>Xử lý tranh chấp Cashback</h3>
    <label className="field"><span>Hành động</span><select value={action} onChange={e => setAction(e.target.value)}>
      <option value="NOTE">Ghi chú, giữ tranh chấp</option><option value="REQUEST_EVIDENCE">Yêu cầu Merchant bổ sung chứng từ</option>
      <option value="REOPEN">Chuyển lại chờ Customer kiểm tra/xác nhận</option><option value="COMPLETE">Hoàn tất bằng căn cứ Admin xác minh</option>
    </select></label>
    <label className="field"><span>Ghi chú / kết luận được gửi cho Customer và Merchant *</span><textarea required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
    {action === 'COMPLETE' && <>
      <div className="alert alert-warn">Ảnh/mã chuyển khoản hay biên nhận Merchant riêng lẻ không đủ căn cứ. Admin phải thực hiện xác minh độc lập ngoài ứng dụng trước khi ghi nhận.</div>
      <label className="field"><span>Nguồn căn cứ</span><select value={source} onChange={e => setSource(e.target.value)}><option value="INDEPENDENT_RECONCILIATION">Đối soát độc lập</option><option value="CUSTOMER_ACKNOWLEDGEMENT">Customer xác nhận qua kênh đã kiểm chứng</option></select></label>
      <label className="field"><span>Mã biên bản đối soát / xác minh riêng *</span><input required maxLength={150} value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label className="field"><span>Biên bản xác minh: nguồn, cách kiểm chứng, kết quả nhận đủ tiền *</span><textarea required maxLength={4000} value={record} onChange={e => setRecord(e.target.value)} /></label>
      <label className="check"><input type="checkbox" required checked={verified} onChange={e => setVerified(e.target.checked)} />Tôi đã kiểm chứng căn cứ độc lập; không chỉ dựa vào lời khai Merchant.</label>
    </>}
    <button className="btn mt" disabled={busy || (action === 'COMPLETE' && !verified)}>Lưu xử lý</button>
  </form>;
}
export function CashbackManagement({ admin = false, brandMode = false }) {
  const { brand } = useContext(BrandContext);
  const session = useSession(webApi);
  const endpoint = admin ? '/admin/cashback' : brandMode ? '/brand/' + brand?.id + '/cashback' : '/staff/cashback';
  const [filter, setFilter] = useState(admin ? 'DISPUTED' : '');
  const [selected, setSelected] = useState(null);
  const list = useLoad(() => webApi.get(endpoint + (filter ? '?status=' + filter : '')), [endpoint, filter, session?.activeStoreId]);
  const item = list.data?.find(x => x.id === selected);
  const done = () => list.reload(true);
  return <div>
    <div className="page-head"><h1>{admin ? 'Tranh chấp Cashback' : 'Hoàn Cashback trực tiếp'}</h1><button type="button" className="btn btn-ghost btn-sm" onClick={done}>⟳</button></div>
    <div className="alert alert-info small">Marketplace chỉ ghi nhận trạng thái và chứng từ. Merchant tự chi trả; ứng dụng không chuyển tiền. Danh sách hiển thị tối đa 200 claim gần nhất trong phạm vi quản lý.</div>
    <label className="field"><span>Lọc trạng thái</span><select value={filter} onChange={e => { setFilter(e.target.value); setSelected(null); }}>{!admin && <option value="">Tất cả</option>}{Object.entries(CASHBACK_LABELS).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></label>
    <ErrorBox error={list.error} />
    {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty>Không có claim phù hợp.</Empty> : list.data?.map(x => <div key={x.id} className="card">
      <div className="bold">{x.campaignTitle} · {money(x.claim.cashbackAmount)}</div>
      <div className="small">{x.code} · {x.customer.name || x.customer.id} · {x.brand.name} / {x.storeName}</div>
      <div className="small muted">Hóa đơn {x.redemption.invoiceCode} · {money(x.claim.billAmount)} · Claim lúc {dateTime(x.claim.requestedAt || x.redemption.usedAt)}</div>
      <div>{CASHBACK_LABELS[x.status]}{x.reminderDue && ' · Đã quá 72 giờ chờ xác nhận'}</div>
      <button type="button" className="btn btn-ghost btn-sm mt" onClick={() => setSelected(selected === x.id ? null : x.id)}>Chi tiết / xử lý</button>
    </div>)}
    {item && <div className="card mt">
      <h2>Claim {item.code}</h2><div className="small mono">ID: {item.id}</div>
      {item.claim.paymentReport && <div className="card"><h3>Biên nhận Merchant</h3><div>{item.claim.paymentReport.paymentMethod} · {money(item.claim.paymentReport.amount)} · {dateTime(item.claim.paymentReport.paidAt)}</div><div>Tham chiếu: {item.claim.paymentReport.paymentReference}</div><div>Mã biên nhận: {item.claim.paymentReport.evidence.id}</div><p style={{ whiteSpace: 'pre-wrap' }}>{item.claim.paymentReport.evidence.statement}</p><div className="small muted">Lời khai Merchant; không phải xác nhận ngân hàng. SHA256: {item.claim.paymentReport.evidence.sha256}</div></div>}
      {item.claim.disputeReason && <div className="alert alert-warn">Tranh chấp: {item.claim.disputeReason}</div>}
      {item.claim.resolutionNote && <div>Kết luận/ghi chú gần nhất: {item.claim.resolutionNote}</div>}
      {item.claim.evidenceRequested && <div className="alert alert-warn">Admin yêu cầu Merchant bổ sung biên nhận.</div>}
      {!admin && (item.status === 'PENDING_CASHBACK' || (item.status === 'DISPUTED' && item.claim.evidenceRequested)) && <ReportForm key={item.id + ':' + item.claim.revision} item={item} endpoint={endpoint} done={done} />}
      {admin && item.status === 'DISPUTED' && <ResolutionForm key={item.id} item={item} done={done} />}
      {item.claim.confirmationSource && <div>Nguồn hoàn tất: {item.claim.confirmationSource} · {dateTime(item.claim.completedAt)}</div>}
      <details className="mt"><summary>Lịch sử xử lý và chứng từ (chỉ đọc)</summary>{item.history.map(h => <div className="card" key={h.id}><div>{dateTime(h.at)} · {h.actorRole} / {h.actorId} · {h.action}</div><div>{h.from} → {h.to}</div><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(h.data, null, 2)}</pre></div>)}</details>
    </div>}
  </div>;
}
