import { useState } from 'react';
import { customerApi } from '../api/client';
import { useAction } from '../components/ui';
import { dateTime, money } from '../utils/format';
const LABELS = { PENDING_CASHBACK: 'Voucher đã được sử dụng. Đang chờ Merchant hoàn tiền.', MERCHANT_REPORTED_PAID: 'Merchant đã báo hoàn tiền. Vui lòng kiểm tra và xác nhận.', DISPUTED: 'Đang xử lý tranh chấp Cashback.', COMPLETED: 'Cashback đã được xác nhận hoàn tất.' };
export function CashbackPanel({ voucher, reload }) {
  const c = voucher.cashback;
  const [received, setReceived] = useState(false);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, run] = useAction();
  if (!c) return null;
  const act = async (action, body) => {
    if (busy) return;
    const result = await run(() => customerApi.post('/cashback/' + voucher.id + '/' + action, body), action === 'confirm' ? 'Đã ghi nhận bạn nhận đủ tiền.' : 'Đã mở tranh chấp để Admin xem xét.');
    if (result) { setReceived(false); reload(); }
  };
  return <div className="card mt cashback-panel">
    <div className="brand-eyebrow">THEO DÕI CASHBACK</div><h3>{LABELS[c.status]}</h3><div className="cashback-amount">{money(c.cashbackAmount)}</div>
    {c.paymentReport && <div className="small">{c.paymentReport.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản ngân hàng'} · Thực hiện lúc {dateTime(c.paymentReport.paidAt)}<br />Merchant báo lúc {dateTime(c.paymentReport.merchantReportedAt)}<br />Tham chiếu: {c.paymentReport.paymentReference}<br />Mã biên nhận điện tử: {c.paymentReport.receiptId}</div>}
    {c.reminderDue && <div className="alert alert-warn mt">Đã qua 72 giờ. Vui lòng kiểm tra tiền thực nhận rồi xác nhận hoặc báo chưa nhận. Hệ thống không tự hoàn tất.</div>}
    {c.status === 'MERCHANT_REPORTED_PAID' && <>
      <div className="small muted mt">Lời khai/chứng từ Merchant không thay thế việc bạn kiểm tra tiền thực nhận. Chỉ xác nhận khi đã nhận đủ số tiền trên.</div>
      <label className="check mt"><input type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)} />Tôi đã kiểm tra và nhận đủ tiền.</label>
      <button type="button" className="btn btn-block mt" disabled={busy || !received} onClick={() => act('confirm', { receivedInFull: true })}>Tôi đã nhận đủ tiền</button>
      <form className="mt" onSubmit={e => { e.preventDefault(); act('dispute', { reason, ...(evidence.trim() ? { evidence } : {}) }); }}>
        <label className="field"><span>Lý do chưa nhận / nhận thiếu / vấn đề khoản hoàn *</span><textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label className="field"><span>Thông tin đối chiếu hoặc bằng chứng dạng văn bản (không nhập thông tin nhạy cảm, URL)</span><textarea maxLength={2000} value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
        <button className="btn btn-ghost btn-block" disabled={busy || !reason.trim()}>Tôi chưa nhận tiền</button>
      </form>
    </>}
    {c.disputeReason && <p>Lý do tranh chấp: {c.disputeReason}</p>}
    {c.resolutionNote && <p>Admin: {c.resolutionNote}</p>}
    {c.evidenceRequested && <div className="small muted">Admin đang yêu cầu Merchant bổ sung chứng từ.</div>}
    {c.confirmationSource && <div className="small muted">{c.confirmationSource === 'CUSTOMER_CONFIRMED' ? 'Customer xác nhận đã nhận đủ tiền' : 'Admin đã xác minh căn cứ đối soát'} · {dateTime(c.completedAt)}</div>}
  </div>;
}
