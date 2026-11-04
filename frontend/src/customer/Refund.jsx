import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerApi } from '../api/client';
import { Empty, ErrorBox, Spinner, useAction, useLoad } from '../components/ui';
import { dateTime, money } from '../utils/format';
import { TopBar } from './Layout';

const RESULT_TEXT = {
  COMPLETED: ['alert-ok', 'Hoàn tiền thành công', (r) => `Hoàn tiền thành công ${money(r.amount)}. Tiền sẽ về tài khoản / phương thức bạn đã thanh toán.`],
  FAILED: ['alert-bad', 'Hoàn tiền không thành công', (r) => `${r.rejectReason || 'Cổng thanh toán từ chối giao dịch hoàn tiền.'} Voucher đã được khôi phục trong ví.`],
  MANUAL_PENDING: ['alert-warn', 'Chờ quản trị viên hoàn tiền', () => 'Yêu cầu đang chờ quản trị viên hoàn tiền thủ công. Voucher tạm khóa trong lúc chờ.'],
  REJECTED: ['alert-bad', 'Không đủ điều kiện hoàn tiền', (r) => r.rejectReason],
  PROCESSING: ['alert-info', 'Đang xử lý', () => 'Yêu cầu đang được xử lý qua cổng thanh toán.'],
};

export function RefundRequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const v = useLoad(() => customerApi.get(`/wallet/${id}`), [id]);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState(null);
  const [busy, run] = useAction();

  if (v.loading && !v.data) return <><TopBar title="Yêu cầu hoàn tiền" /><Spinner /></>;
  if (v.error) return <><TopBar title="Yêu cầu hoàn tiền" /><div className="screen"><ErrorBox error={v.error} /></div></>;
  const d = v.data;
  const submit = async () => {
    const r = await run(() => customerApi.post('/refunds', { voucherItemId: id, reason }));
    if (r) setResult(r);
  };
  const info = result && RESULT_TEXT[result.status];

  return (
    <div>
      <TopBar title="Yêu cầu hoàn tiền" />
      <div className="screen" style={{ paddingTop: 0 }}>
        <div className="bold">{d.campaign.title}</div>
        <div className="small muted">Mã tra cứu: {d.code}</div>
        <div className="small muted">Số tiền hoàn dự kiến: {money(d.unitPrice)}</div>
        <div className="small bold">Hạn chót yêu cầu hoàn: {dateTime(d.refundableUntil)}</div>
        <p className="small muted">Chỉ áp dụng cho voucher chưa sử dụng, trong vòng 7 ngày kể từ ngày mua và còn ít nhất 3 ngày trước hạn sử dụng (BR-05).</p>
        {result ? (
          <>
            <div className={`alert ${info[0]}`}><div className="bold">{info[1]}</div>{info[2](result)}</div>
            <button type="button" className="btn btn-block" onClick={() => navigate('/refunds', { replace: true })}>Theo dõi yêu cầu hoàn tiền</button>
            <button type="button" className="btn btn-ghost btn-block mt" onClick={() => navigate('/wallet', { replace: true })}>Đóng</button>
          </>
        ) : (
          <>
            <label className="field mt"><span>Lý do hoàn tiền (không bắt buộc)</span>
              <textarea rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="small muted" style={{ textAlign: 'right' }}>{reason.length}/500</div>
            {!d.refund.canRefund && <div className="alert alert-bad small">{d.refund.reason}</div>}
            <button type="button" className="btn btn-block" disabled={busy || !d.refund.canRefund} onClick={submit}>Gửi yêu cầu</button>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ state, label, time }) {
  const icon = { done: '✓', wait: '…', fail: '✕', todo: '' }[state];
  return (
    <li>
      <span className={`tdot ${state}`}>{icon}</span>
      <span className="grow">{label}</span>
      {time && <span className="small muted">{dateTime(time)}</span>}
    </li>
  );
}

export function RefundList() {
  const list = useLoad(() => customerApi.get('/refunds/me'), []);
  return (
    <div>
      <TopBar title="Yêu cầu hoàn tiền" />
      <div className="screen" style={{ paddingTop: 0 }}>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty icon="⟲">Bạn chưa có yêu cầu hoàn tiền nào.</Empty> : list.data?.map((r) => (
          <div key={r.id} className="card">
            <div className="bold">{r.campaignTitle}</div>
            <div className="small muted">Mã tra cứu: {r.voucherCode} · Số tiền: {money(r.amount)}</div>
            <ul className="timeline">
              <Step state="done" label="Đã gửi yêu cầu" time={r.createdAt} />
              {r.status === 'REJECTED' ? (
                <Step state="fail" label="Không đủ điều kiện hoàn tiền" time={r.decidedAt} />
              ) : (
                <>
                  <Step state="done" label="Đang xử lý qua cổng thanh toán" />
                  {(r.status === 'MANUAL_PENDING' || r.paymentRefund?.mode === 'MANUAL' || (r.status === 'FAILED' && !r.rejectReason?.includes('Cổng'))) && (
                    <Step state={r.status === 'MANUAL_PENDING' ? 'wait' : 'done'} label="Chờ quản trị viên hoàn tiền" />
                  )}
                  {r.status === 'COMPLETED' && <Step state="done" label="Hoàn tiền thành công" time={r.decidedAt} />}
                  {r.status === 'FAILED' && <Step state="fail" label="Hoàn tiền không thành công" time={r.decidedAt} />}
                  {r.status === 'MANUAL_PENDING' && <Step state="todo" label="Chờ kết quả" />}
                </>
              )}
            </ul>
            {r.rejectReason && <div className="small" style={{ color: 'var(--bad)' }}>Lý do: {r.rejectReason}</div>}
            {r.paymentRefund?.gatewayRefundId && <div className="small muted">Mã giao dịch hoàn: <span className="mono">{r.paymentRefund.gatewayRefundId}</span></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
