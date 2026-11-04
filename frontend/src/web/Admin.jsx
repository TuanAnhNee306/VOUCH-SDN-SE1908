import { useState } from 'react';
import { webApi } from '../api/client';
import { Badge, Empty, ErrorBox, PromptDialog, Spinner, StatusBadge, useAction, useLoad, useToast } from '../components/ui';
import { BRAND_STATUS, CAMPAIGN_STATUS, date, dateTime, money, VOUCHER_TYPES } from '../utils/format';
import { SettlementTable } from './Brand';
import { valueText } from '../customer/Campaign';

export function AdminDashboard() {
  const d = useLoad(() => webApi.get('/admin/dashboard'), []);
  const r = d.data;
  const max = Math.max(1, ...(r?.transactionsByDay.map((x) => x.revenue) ?? [1]));
  return (
    <div>
      <div className="page-head"><h1>Bảng điều khiển</h1><button type="button" className="btn btn-ghost btn-sm" onClick={() => d.reload()}>⟳</button></div>
      <ErrorBox error={d.error} />
      {!r ? <Spinner /> : (
        <>
          <div className="grid4">
            <div className="stat"><div className="small muted">Doanh thu (trừ hoàn)</div><div className="v">{money(r.totalRevenue)}</div></div>
            <div className="stat"><div className="small muted">Hoa hồng nền tảng</div><div className="v">{money(r.totalCommission)}</div></div>
            <div className="stat"><div className="small muted">Giao dịch thành công</div><div className="v">{r.totalTransactions}</div></div>
            <div className="stat"><div className="small muted">Thương hiệu hoạt động</div><div className="v">{r.totalActiveBrands}</div></div>
          </div>
          <div className="grid4 mt">
            <div className="stat"><div className="small muted">Chiến dịch đang bán</div><div className="v">{r.publishedCampaigns}</div></div>
            <div className="stat"><div className="small muted">Chiến dịch chờ duyệt</div><div className="v">{r.pendingCampaigns}</div></div>
            <div className="stat"><div className="small muted">Thương hiệu chờ duyệt</div><div className="v">{r.pendingBrands}</div></div>
            <div className="stat"><div className="small muted">Đơn lệch số tiền</div><div className="v">{r.paymentMismatches}</div></div>
          </div>
          <div className="card mt">
            <div className="card-title">Doanh thu theo ngày</div>
            {r.transactionsByDay.length === 0 ? <div className="muted">Chưa có giao dịch.</div> : (
              <div className="bar-chart" style={{ marginBottom: 22 }}>
                {r.transactionsByDay.slice(-20).map((x) => (
                  <div key={x.date} className="bar" style={{ height: `${(x.revenue / max) * 100}%` }} title={`${x.date}: ${money(x.revenue)} (${x.count} đơn)`}><span>{x.date.slice(5)}</span></div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AdminBrands() {
  const [status, setStatus] = useState('');
  const list = useLoad(() => webApi.get(`/admin/brands${status ? `?status=${status}` : ''}`), [status]);
  const [dialog, setDialog] = useState(null);
  const [busy, run] = useAction();
  const act = async (b, action, body, msg) => {
    const r = await run(() => webApi.patch(`/admin/brands/${b.id}/${action}`, body), msg);
    if (r) { setDialog(null); list.reload(true); }
  };
  return (
    <div>
      <div className="page-head"><h1>Thương hiệu</h1>
        <div className="chips">{[['', 'Tất cả'], ['PENDING', 'Chờ duyệt'], ['APPROVED', 'Hoạt động'], ['SUSPENDED', 'Đình chỉ'], ['REJECTED', 'Từ chối']].map(([v, l]) => (
          <button type="button" key={v} className={`chip ${status === v ? 'active' : ''}`} onClick={() => setStatus(v)}>{l}</button>
        ))}</div>
      </div>
      {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty>Không có thương hiệu.</Empty> : list.data?.map((b) => (
        <div key={b.id} className="card row gap">
          {b.logo ? <img src={b.logo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'contain', background: '#fff' }} /> : <span style={{ fontSize: 30 }}>🏪</span>}
          <div className="grow">
            <div className="row gap"><b>{b.name}</b><StatusBadge map={BRAND_STATUS} value={b.status} /></div>
            <div className="small muted">{b.description} · Chủ: {b.owner?.email} · Liên hệ: {b.contactInfo || '—'}</div>
            {b.rejectReason && <div className="small" style={{ color: 'var(--bad)' }}>Lý do: {b.rejectReason}</div>}
          </div>
          <div className="row gap">
            {b.status === 'PENDING' && <>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act(b, 'approve', {}, 'Đã duyệt thương hiệu.')}>✓ Duyệt</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ b, action: 'reject', title: `Từ chối "${b.name}"`, msg: 'Đã từ chối hồ sơ.' })}>✕ Từ chối</button>
            </>}
            {b.status === 'APPROVED' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ b, action: 'suspend', title: `Đình chỉ "${b.name}"`, msg: 'Đã đình chỉ thương hiệu, các chiến dịch đang bán chuyển tạm dừng.' })}>Đình chỉ</button>}
            {b.status === 'SUSPENDED' && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act(b, 'reinstate', {}, 'Đã khôi phục thương hiệu.')}>Khôi phục</button>}
          </div>
        </div>
      ))}
      <PromptDialog open={!!dialog} title={dialog?.title} label="Lý do" onClose={() => setDialog(null)}
        onConfirm={(reason) => act(dialog.b, dialog.action, { reason }, dialog.msg)} />
    </div>
  );
}

export function AdminCampaigns() {
  const [status, setStatus] = useState('PENDING');
  const list = useLoad(() => webApi.get(status === 'PENDING' ? '/admin/campaigns/pending' : `/admin/campaigns${status ? `?status=${status}` : ''}`), [status]);
  const [reject, setReject] = useState(null);
  const [busy, run] = useAction();
  const approve = async (c) => {
    const r = await run(() => webApi.patch(`/admin/campaigns/${c.id}/approve`), `Đã duyệt "${c.title}".`);
    if (r) list.reload(true);
  };
  const runJob = async () => {
    const r = await run(() => webApi.post('/admin/jobs/campaign-transitions'));
    if (r) list.reload(true);
  };
  return (
    <div>
      <div className="page-head"><h1>{status === 'PENDING' ? 'Chiến dịch chờ duyệt' : 'Tất cả chiến dịch'}</h1>
        <div className="row gap">
          <div className="chips">{[['PENDING', 'Chờ duyệt'], ['', 'Tất cả'], ['PUBLISHED', 'Đang bán'], ['APPROVED', 'Đã duyệt']].map(([v, l]) => (
            <button type="button" key={v} className={`chip ${status === v ? 'active' : ''}`} onClick={() => setStatus(v)}>{l}</button>
          ))}</div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={runJob} title="Tác vụ nền chạy 5 phút / lần">⟳ Chạy rà soát trạng thái</button>
        </div>
      </div>
      {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty icon="✓">Không có chiến dịch.</Empty> : list.data?.map((c) => (
        <div key={c.id} className="card">
          <div className="row between gap">
            <div className="grow">
              <div className="row gap"><b>{c.title}</b><StatusBadge map={CAMPAIGN_STATUS} value={c.status} /></div>
              <div className="small muted">{c.brand?.name} · {VOUCHER_TYPES[c.voucherType]} · Giá bán {money(c.salePrice)} · {valueText(c)}</div>
              <div className="small muted">Số lượng {c.totalQuantity} · Tối đa {c.limitPerUser}/người · Bán {date(c.saleStartAt)} – {date(c.saleEndAt)} · HSD {date(c.voucherExpireAt)}</div>
              <div className="small muted">Chi nhánh: {c.stores.map((s) => s.name).join(', ')}</div>
              {c.terms && <div className="small">Điều kiện: {c.terms}</div>}
            </div>
          </div>
          {c.status === 'PENDING' && (
            <div className="row gap mt">
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => approve(c)}>✓ Duyệt</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReject(c)}>✕ Từ chối</button>
            </div>
          )}
        </div>
      ))}
      <PromptDialog open={!!reject} title={`Từ chối "${reject?.title}"`} message="Chiến dịch sẽ về Nháp để thương hiệu sửa." label="Lý do từ chối" confirmText="Từ chối"
        onClose={() => setReject(null)} onConfirm={async (reason) => {
          const r = await run(() => webApi.patch(`/admin/campaigns/${reject.id}/reject`, { reason }), 'Đã từ chối chiến dịch.');
          if (r) { setReject(null); list.reload(true); }
        }} />
    </div>
  );
}

export function AdminSettlements() {
  const list = useLoad(() => webApi.get('/admin/settlements'), []);
  const [confirm, setConfirm] = useState(false);
  const [pay, setPay] = useState(null);
  const toast = useToast();
  const [busy, run] = useAction();
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return (
    <div>
      <div className="page-head"><div><h1>Đối soát</h1><div className="small muted">Tự động chốt 01:00 ngày 01 hằng tháng (giờ VN)</div></div>
        <div className="row gap">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(true)}>⊙ Chốt đối soát tháng trước</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => list.reload()}>⟳</button>
        </div>
      </div>
      <div className="alert alert-info small">Phiếu chỉ gồm voucher đã hết quyền hoàn tại thời điểm chốt (đã dùng, hết hạn, hoặc quá hạn hoàn) và không có yêu cầu hoàn đang xử lý (BR-14). Chạy lại không sinh phiếu trùng (DC-06).</div>
      <ErrorBox error={list.error} />
      <SettlementTable list={list.data} admin onPay={setPay} />
      <PromptDialog open={confirm} title="Chốt đối soát" message={`Chốt đối soát tháng ${prev.getMonth() + 1}/${prev.getFullYear()} cho tất cả thương hiệu?`} confirmText="Chốt" required={false}
        onClose={() => setConfirm(false)} onConfirm={async () => {
          const r = await run(() => webApi.post('/admin/settlements/run-previous-month'));
          if (r) {
            setConfirm(false);
            list.reload(true);
            toast(`Đã tạo ${r.created} phiếu đối soát.`, 'ok');
          }
        }} />
      <PromptDialog open={!!pay} title="Đánh dấu đã chi trả" message={`Chuyển khoản ${money(pay?.payableAmount)} cho ${pay?.brandName} ngoài hệ thống rồi nhập mã giao dịch.`} label="Mã giao dịch ngân hàng"
        onClose={() => setPay(null)} onConfirm={async (bankTxnRef) => {
          const r = await run(() => webApi.patch(`/admin/settlements/${pay.id}/mark-paid`, { bankTxnRef }), 'Đã ghi nhận chi trả.');
          if (r) { setPay(null); list.reload(true); }
        }} />
    </div>
  );
}

export function AdminCommission() {
  const info = useLoad(() => webApi.get('/admin/commission-rate'), []);
  const [rate, setRate] = useState('');
  const [busy, run] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const r = await run(() => webApi.post('/admin/commission-rate', { rate: Number(rate) / 100 }), 'Đã cập nhật tỷ lệ hoa hồng.');
    if (r) { setRate(''); info.reload(true); }
  };
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head"><div><h1>Tỷ lệ hoa hồng</h1><div className="small muted">Tỷ lệ chung áp dụng cho đơn tại thời điểm thanh toán</div></div></div>
      <div className="stat" style={{ width: 200 }}><div className="small muted">Tỷ lệ đang áp dụng</div><div className="v">{info.data ? `${(info.data.rate * 100).toFixed(1)}%` : '...'}</div></div>
      <form className="card mt row gap" onSubmit={save}>
        <label className="field grow" style={{ margin: 0 }}><span>Tỷ lệ mới (%)</span><input type="number" step="0.1" min="0.1" max="99.9" required value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <button className="btn" disabled={busy} style={{ alignSelf: 'flex-end' }}>Lưu tỷ lệ</button>
      </form>
      <p className="small muted">Tỷ lệ mới chỉ áp dụng cho đơn thanh toán sau thời điểm lưu. Đơn đã thanh toán giữ nguyên tỷ lệ đã chốt (BR-09).
        {info.data?.updatedAt && ` Thay đổi gần nhất: ${dateTime(info.data.updatedAt)}.`}</p>
    </div>
  );
}

// UC-07: hang doi hoan tien thu cong + don lech so tien (BR-20)
export function AdminRefunds() {
  const [tab, setTab] = useState('manual');
  const manual = useLoad(() => webApi.get('/admin/refunds/manual-pending'), []);
  const mismatch = useLoad(() => webApi.get('/admin/payment-mismatches'), []);
  const sandbox = useLoad(() => webApi.get('/admin/refund-sandbox'), []);
  const [dialog, setDialog] = useState(null);
  const [busy, run] = useAction();
  const reload = () => { manual.reload(true); mismatch.reload(true); };
  const setMode = async (mode) => {
    const r = await run(() => webApi.put('/admin/refund-sandbox', { mode }), `Cổng hoàn giả lập: ${mode}`);
    if (r) sandbox.setData(r);
  };
  return (
    <div>
      <div className="page-head"><div><h1>Hàng đợi hoàn tiền</h1><div className="small muted">Yêu cầu hoàn không qua được cổng tự động và đơn khách thanh toán sai số tiền (BR-20), chờ hoàn tiền thủ công.</div></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>⟳</button></div>
      <div className="demo-box small mb row gap wrap">
        <b>Cổng hoàn giả lập (demo Luồng 4):</b>
        {[['success', 'Thành công'], ['declined', 'Từ chối'], ['unavailable', 'Không phản hồi']].map(([m, l]) => (
          <button type="button" key={m} className={`chip ${sandbox.data?.mode === m ? 'active' : ''}`} disabled={busy} onClick={() => setMode(m)}>{l}</button>
        ))}
      </div>
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>Hoàn tiền thủ công ({manual.data?.length ?? 0})</button>
        <button type="button" className={`tab ${tab === 'mismatch' ? 'active' : ''}`} onClick={() => setTab('mismatch')}>Đơn lệch số tiền ({mismatch.data?.length ?? 0})</button>
      </div>
      {tab === 'manual' ? (
        manual.loading && !manual.data ? <Spinner /> : manual.data?.length === 0 ? <Empty icon="⟲">Không có yêu cầu nào chờ xử lý thủ công.</Empty> : manual.data?.map((r) => (
          <div key={r.id} className="card">
            <div className="row between"><b>⟲ {r.campaignTitle}</b><Badge tone="warn">Chờ quản trị viên hoàn tiền</Badge></div>
            <div className="small">Mã voucher: {r.voucherCode} · Số tiền cần hoàn: <b>{money(r.amount)}</b></div>
            <div className="small">Khách hàng: {r.customer?.fullName} · {r.customer?.email} · {r.customer?.phone}</div>
            <div className="small">Giao dịch gốc: {r.payment?.gateway} · <span className="mono">{r.payment?.gatewayTxnId}</span> · {money(r.payment?.amount)}</div>
            <div className="small muted">Lý do: {r.reason || '—'} · Yêu cầu lúc {dateTime(r.createdAt)}</div>
            <div className="row gap mt">
              <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'confirm', r })}>✓ Đã hoàn tiền</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: 'fail', r })}>⊘ Không hoàn được</button>
            </div>
          </div>
        ))
      ) : (
        mismatch.loading && !mismatch.data ? <Spinner /> : mismatch.data?.length === 0 ? <Empty icon="✓">Không có đơn lệch số tiền.</Empty> : mismatch.data?.map((o) => (
          <div key={o.id} className="card">
            <div className="row between"><b>{o.campaignTitle}</b><Badge tone="bad">Lệch số tiền</Badge></div>
            <div className="small">Mã đơn: <span className="mono">{o.id}</span> · Khách hàng: {o.customer?.fullName} · {o.customer?.email}</div>
            <div className="small">Số tiền phải trả: {money(o.totalAmount)} · Số tiền đã nhận: <b>{money(o.receivedAmount)}</b> · Cần hoàn: <b>{money(o.receivedAmount)}</b></div>
            <div className="small muted">Giao dịch: {o.payments.map((p) => p.gatewayTxnId).join(', ')} · Tạo lúc {dateTime(o.createdAt)}</div>
            <button type="button" className="btn btn-sm mt" onClick={() => setDialog({ kind: 'mismatch', o })}>✓ Đã hoàn tiền</button>
          </div>
        ))
      )}
      <PromptDialog open={!!dialog} onClose={() => setDialog(null)}
        title={dialog?.kind === 'fail' ? 'Không hoàn được tiền' : 'Xác nhận đã hoàn tiền'}
        message={dialog?.kind === 'fail' ? 'Yêu cầu sẽ chuyển thất bại và voucher được khôi phục cho khách.'
          : `Chỉ xác nhận sau khi đã chuyển ${money(dialog?.kind === 'mismatch' ? dialog?.o?.receivedAmount : dialog?.r?.amount)} cho khách qua cổng thanh toán / ngân hàng.`}
        label={dialog?.kind === 'fail' ? 'Lý do' : 'Mã giao dịch hoàn tiền'}
        onConfirm={async (v) => {
          const call = dialog.kind === 'confirm' ? () => webApi.patch(`/admin/refunds/${dialog.r.id}/confirm-manual`, { gatewayRefundId: v })
            : dialog.kind === 'fail' ? () => webApi.patch(`/admin/refunds/${dialog.r.id}/fail-manual`, { reason: v })
              : () => webApi.patch(`/admin/payment-mismatches/${dialog.o.id}/confirm`, { gatewayRefundId: v });
          const r = await run(call, 'Đã xác nhận hoàn tiền.');
          if (r) { setDialog(null); reload(); }
        }} />
    </div>
  );
}

export function AdminCategories() {
  const list = useLoad(() => webApi.get('/admin/categories'), []);
  const [form, setForm] = useState({ name: '', displayOrder: '' });
  const [busy, run] = useAction();
  const add = async (e) => {
    e.preventDefault();
    const r = await run(() => webApi.post('/admin/categories', form), 'Đã thêm danh mục.');
    if (r) { setForm({ name: '', displayOrder: '' }); list.reload(true); }
  };
  const remove = async (c) => {
    const r = await run(() => webApi.del(`/admin/categories/${c.id}`), 'Đã xóa danh mục.');
    if (r) list.reload(true);
  };
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head"><h1>Danh mục ngành hàng</h1></div>
      <form className="card row gap mb" onSubmit={add}>
        <input className="input grow" required placeholder="Tên danh mục" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" style={{ width: 110 }} type="number" placeholder="Thứ tự" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
        <button className="btn" disabled={busy}>+ Thêm</button>
      </form>
      {list.data?.map((c) => (
        <div key={c.id} className="card row between"><span><b>{c.name}</b> <span className="small muted">#{c.displayOrder}</span></span>
          <button type="button" className="link small" disabled={busy} onClick={() => remove(c)}>Xóa</button></div>
      ))}
    </div>
  );
}

export function AdminReviews() {
  const list = useLoad(() => webApi.get('/admin/reviews'), []);
  const [hide, setHide] = useState(null);
  const [busy, run] = useAction();
  return (
    <div>
      <div className="page-head"><h1>Đánh giá</h1></div>
      {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty icon="☆">Chưa có đánh giá.</Empty> : list.data?.map((r) => (
        <div key={r.id} className="card">
          <div className="row between"><b>{r.reviewerName} · {r.campaignTitle} <span className="small muted">({r.brandName})</span></b><span style={{ color: '#f5a623' }}>{'★'.repeat(r.rating)}</span></div>
          <div>{r.comment}</div>
          <div className="row between mt"><span className="small muted">{dateTime(r.createdAt)}</span>
            {r.status === 'VISIBLE' ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHide(r)}>Ẩn đánh giá</button>
              : <span className="row gap"><Badge tone="gray">Đã ẩn</Badge><button type="button" className="link small" disabled={busy} onClick={async () => { if (await run(() => webApi.patch(`/admin/reviews/${r.id}/unhide`), 'Đã hiện lại.')) list.reload(true); }}>Hiện lại</button></span>}
          </div>
        </div>
      ))}
      <PromptDialog open={!!hide} title="Ẩn đánh giá vi phạm" label="Lý do" onClose={() => setHide(null)} onConfirm={async (reason) => {
        if (await run(() => webApi.patch(`/admin/reviews/${hide.id}/hide`, { reason }), 'Đã ẩn đánh giá.')) { setHide(null); list.reload(true); }
      }} />
    </div>
  );
}
