import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { customerApi, useSession } from '../api/client';
import { ErrorBox, Spinner, useAction, useLoad } from '../components/ui';
import { dateTime, money } from '../utils/format';
import { TopBar } from './Layout';

export function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: c, error, loading } = useLoad(() => customerApi.get(`/campaigns/${id}`), [id]);
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState(null);
  const [busy, run] = useAction();

  if (loading && !c) return <><TopBar title="Thanh toán" /><Spinner /></>;
  if (error) return <><TopBar title="Thanh toán" /><div className="screen"><ErrorBox error={error} /></div></>;
  const max = Math.max(1, Math.min(c.limitPerUser, c.availableQuantity));

  const submit = async () => {
    setErr(null);
    const r = await run(async () => {
      try {
        return await customerApi.post('/orders', { campaignId: id, quantity: qty });
      } catch (e) {
        setErr(e.message);
        throw e;
      }
    });
    if (!r) return;
    // Chuyen thang sang VNPAY tren cung tab. VNPAY se redirect ve /payment-return;
    // man ket qua sau do van hoi trang thai don tu server, khong tin query string cua trinh duyet.
    if (r.paymentUrl) {
      window.location.assign(r.paymentUrl);
      return;
    }
    navigate(`/orders/${r.order.id}/result`, { replace: true, state: { paymentUrl: r.paymentUrl } });
  };

  return (
    <div>
      <TopBar title="Thanh toán" />
      <div className="screen" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="bold">{c.title}</div>
          <div className="small muted">Đơn giá: {money(c.salePrice)}</div>
        </div>
        <div className="mt">
          <div className="small muted mb">Số lượng</div>
          <div className="qty">
            <button type="button" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
            <b>{qty}</b>
            <button type="button" disabled={qty >= max} onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <div className="small muted mt">Tối đa {c.limitPerUser} voucher cho mỗi tài khoản trong chiến dịch này.</div>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />
        <div className="row between"><b>Tổng tiền</b><span className="price">{money(c.salePrice * qty)}</span></div>
        <p className="small muted">Đơn hàng được giữ chỗ trong 15 phút. Nếu không hoàn tất thanh toán, đơn sẽ tự hủy và trả lại tồn kho.</p>
        {err && <div className="small" style={{ color: 'var(--bad)' }}>{err}</div>}
        <button type="button" className="btn btn-block mt" disabled={busy || !c.canPurchase} onClick={submit}>Tiến hành thanh toán</button>
      </div>
    </div>
  );
}

const RESULT = {
  FULFILLED: ['ok', '✓', 'Thanh toán thành công', 'Voucher đã được phát hành vào ví của bạn.'],
  PAID: ['ok', '✓', 'Thanh toán thành công', 'Đang phát hành voucher...'],
  CANCELLED: ['bad', '✕', 'Đơn hàng đã hủy', 'Thanh toán không thành công hoặc đã quá 15 phút giữ chỗ.'],
  PAYMENT_MISMATCH: ['bad', '!', 'Số tiền không khớp', 'Bộ phận hỗ trợ sẽ hoàn lại số tiền bạn đã thanh toán.'],
  REFUNDED_OVERSOLD: ['bad', '!', 'Voucher đã hết', 'Thanh toán đến sau khi voucher hết hàng. Bạn được hoàn 100% số tiền.'],
};

export function PaymentResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const order = useLoad(() => customerApi.get(`/orders/${id}`), [id]);
  const config = useLoad(() => customerApi.get('/config'), []);
  const [busy, run] = useAction();
  const [paymentUrl, setPaymentUrl] = useState(location.state?.paymentUrl || null);
  const o = order.data;

  // Khong tin ket qua tra ve tu trinh duyet: hoi trang thai don tu may chu moi 3 giay khi con cho
  useEffect(() => {
    if (o?.status !== 'PENDING') return undefined;
    const t = setInterval(() => order.reload(true), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o?.status]);

  const simulate = async (result) => {
    const r = await run(() => customerApi.post(`/orders/${id}/simulate-payment`, { result }));
    if (r) order.setData(r.order);
  };
  const retry = async () => {
    const r = await run(() => customerApi.post(`/orders/${id}/pay`));
    if (r?.paymentUrl) {
      setPaymentUrl(r.paymentUrl);
      window.location.assign(r.paymentUrl);
      return;
    }
    if (r) order.setData(r.order);
  };

  if (order.loading && !o) return <><TopBar title="Kết quả thanh toán" /><Spinner /></>;
  if (order.error) return <><TopBar title="Kết quả thanh toán" /><div className="screen"><ErrorBox error={order.error} /></div></>;
  const r = RESULT[o.status];

  return (
    <div>
      <TopBar title="Kết quả thanh toán" onBack={() => navigate('/orders')} />
      <div className="screen center">
        {o.status === 'PENDING' ? (
          <>
            <div className="status-icon warn">⏱</div>
            <h3>Đang chờ thanh toán</h3>
            <p className="small muted">Hoàn tất thanh toán trên trang VNPAY, kết quả sẽ tự cập nhật.</p>
          </>
        ) : (
          <>
            <div className={`status-icon ${r[0]}`}>{r[1]}</div>
            <h3>{r[2]}</h3>
            <p className="small muted">{r[3]}</p>
          </>
        )}
        <div className="card mt" style={{ textAlign: 'left' }}>
          <div className="bold">{o.campaign?.title}</div>
          <div className="small">Số lượng: {o.quantity} · Tổng tiền: {money(o.totalAmount)}</div>
          {o.status === 'PENDING' && <div className="small muted">Giữ chỗ đến: {dateTime(o.reservedUntil)}</div>}
        </div>

        {o.status === 'PENDING' && (
          <div className="col gap mt">
            {paymentUrl && <a className="btn btn-block" href={paymentUrl}>Tiếp tục thanh toán qua VNPAY</a>}
            {config.data?.paymentSimulator && (
              <>
                <button type="button" className="btn btn-block" disabled={busy} onClick={() => simulate('success')}>Thanh toán thử (demo)</button>
                <div className="demo-box small" style={{ textAlign: 'left' }}>
                  <div className="bold mb">Nhánh ngoại lệ (demo)</div>
                  <div className="row gap wrap">
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => simulate('failed')}>Thanh toán thất bại</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => simulate('mismatch')}>Thanh toán sai số tiền</button>
                  </div>
                </div>
              </>
            )}
            {!paymentUrl && !config.data?.paymentSimulator && (
              <button type="button" className="btn btn-block" disabled={busy} onClick={retry}>Tiếp tục thanh toán</button>
            )}
            <button type="button" className="btn btn-ghost btn-block" onClick={() => order.reload()}>⟳ Kiểm tra lại</button>
          </div>
        )}
        {(o.status === 'FULFILLED' || o.status === 'PAID') && (
          <button type="button" className="btn btn-block mt" onClick={() => navigate('/wallet')}>Xem voucher trong ví</button>
        )}
        {['CANCELLED', 'PAYMENT_MISMATCH', 'REFUNDED_OVERSOLD'].includes(o.status) && (
          <button type="button" className="btn btn-ghost btn-block mt" onClick={() => navigate('/')}>Về trang khám phá</button>
        )}
      </div>
    </div>
  );
}

// VNPAY chuyen khach ve day: tim don theo orderCode roi mo man ket qua.
export function PaymentReturn() {
  const navigate = useNavigate();
  const session = useSession(customerApi);
  // VNPAY sends the merchant order reference as vnp_TxnRef. Keep orderCode
  // as a compatibility fallback for the existing demo gateway.
  const params = new URLSearchParams(window.location.search);
  const code = params.get('vnp_TxnRef') || params.get('orderCode');
  useEffect(() => {
    if (!session) return;
    const signedReturn = params.has('vnp_SecureHash')
      ? customerApi.get(`/orders/vnpay-return?${params.toString()}`).catch(() => null)
      : Promise.resolve();
    signedReturn.then(() => customerApi.get('/orders/me')).then((list) => {
      const o = list.find((x) => x.paymentOrderCode === code);
      navigate(o ? `/orders/${o.id}/result` : '/orders', { replace: true });
    }).catch(() => navigate('/orders', { replace: true }));
  }, [session, code, navigate]);
  return <div className="screen center"><Spinner text="Đang kiểm tra kết quả thanh toán..." /></div>;
}
