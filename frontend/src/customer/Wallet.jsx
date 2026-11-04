import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { customerApi, useSession } from '../api/client';
import { Badge, Empty, ErrorBox, Spinner, useAction, useLoad, useToast } from '../components/ui';
import { dateTime, money, REFUND_STATUS, VOUCHER_STATUS_TONE } from '../utils/format';
import { valueText } from './Campaign';
import { TopBar } from './Layout';

const AUTO_REFRESH_MAX = 5;
const TABS = [['ACTIVE', 'Đang hiệu lực'], ['USED', 'Đã dùng'], ['EXPIRED', 'Hết hạn'], ['REFUNDED', 'Đã hoàn']];

// Vi xem duoc khi mat mang: luu ban sao danh sach gan nhat tren may
function useWallet(userId) {
  const key = `vp_wallet_${userId}`;
  const [offline, setOffline] = useState(false);
  const load = useLoad(async () => {
    try {
      const data = await customerApi.get('/wallet');
      localStorage.setItem(key, JSON.stringify(data));
      setOffline(false);
      return data;
    } catch (e) {
      const cached = localStorage.getItem(key);
      if (e.code === 'NETWORK' && cached) {
        setOffline(true);
        return JSON.parse(cached);
      }
      throw e;
    }
  }, [userId]);
  return { ...load, offline };
}

export function Wallet() {
  const navigate = useNavigate();
  const session = useSession(customerApi);
  const [tab, setTab] = useState('ACTIVE');
  const { data, error, loading, reload, offline } = useWallet(session?.user?.id);
  const list = (data || []).filter((v) => v.tab === tab);

  return (
    <div>
      <TopBar title="Ví voucher" back={false} right={<button type="button" className="link" onClick={() => reload()}>⟳</button>} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <div className="chips mb">
          {TABS.map(([k, l]) => (
            <button type="button" key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{tab === k && '✓ '}{l}</button>
          ))}
        </div>
        {offline && <div className="alert alert-warn small">Đang mất mạng: hiển thị ví đã lưu trên máy, chưa tạo được mã sử dụng.</div>}
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? <Spinner /> : list.length === 0 ? <Empty icon="🎟️">Chưa có voucher ở mục này.</Empty> : list.map((v) => (
          <div key={v.id} className="card" onClick={() => navigate(`/wallet/${v.id}`)} role="button">
            <div className="row between gap">
              <div className="bold grow">{v.campaign?.title}</div>
              <Badge tone={VOUCHER_STATUS_TONE[v.displayStatus]}>{v.statusLabel}</Badge>
            </div>
            <div className="small muted">{v.campaign?.brand?.name} · Mã tra cứu: <span className="mono">{v.code}</span></div>
            <div className="small muted">Hạn sử dụng: {dateTime(v.expireAt)}</div>
            {v.displayStatus === 'REFUND_PENDING' && <div className="small" style={{ color: 'var(--warn)' }}>Đang chờ hoàn tiền, tạm thời không sử dụng được.</div>}
            {v.usedAt && <div className="small muted">Đã dùng lúc: {dateTime(v.usedAt)}</div>}
            {v.canRedeem && !offline && (
              <button type="button" className="btn btn-block mt" onClick={(e) => { e.stopPropagation(); navigate(`/wallet/${v.id}/use`); }}>
                ▦ Sử dụng ngay
              </button>
            )}
            {v.tab === 'USED' && v.review.canReview && (
              <div className="row end mt"><button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/wallet/${v.id}/review`); }}>☆ Đánh giá</button></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function VoucherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: v, error, loading } = useLoad(() => customerApi.get(`/wallet/${id}`), [id]);
  if (loading && !v) return <><TopBar title="Chi tiết voucher" /><Spinner /></>;
  if (error) return <><TopBar title="Chi tiết voucher" /><div className="screen"><ErrorBox error={error} /></div></>;
  const lastRefund = v.refundRequests[0];

  return (
    <div>
      <TopBar title="Chi tiết voucher" onBack={() => navigate('/wallet')} />
      <div className="screen" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="row between gap"><h3 className="grow">{v.campaign.title}</h3><Badge tone={VOUCHER_STATUS_TONE[v.displayStatus]}>{v.statusLabel}</Badge></div>
          <div className="small muted">{valueText(v.campaign)}</div>
          <div className="small muted">Mã tra cứu: <span className="mono">{v.code}</span></div>
          <div className="small muted">Ngày mua: {dateTime(v.issuedAt)}</div>
          <div className="small muted">Hạn sử dụng: {dateTime(v.expireAt)}</div>
          <div className="small muted mt">Mã tra cứu chỉ để đối chiếu, không dùng để sử dụng voucher.</div>
        </div>
        {v.canRedeem && <button type="button" className="btn btn-block mt" onClick={() => navigate(`/wallet/${id}/use`)}>Sử dụng ngay</button>}
        {v.displayStatus === 'REFUND_PENDING' && <div className="alert alert-warn mt">Voucher đang chờ hoàn tiền nên tạm khóa, không sử dụng được tại cửa hàng.</div>}

        {v.redemption && (
          <div className="card mt">
            <div className="card-title">Đã sử dụng</div>
            Lúc {dateTime(v.redemption.redeemedAt)} tại {v.redemption.storeName}
            {v.redemption.billAmount != null && <div className="small muted">Hóa đơn: {money(v.redemption.billAmount)}</div>}
          </div>
        )}

        <div className="card mt">
          <div className="card-title">Chi nhánh áp dụng</div>
          {v.stores.map((s) => (
            <div key={s.id} className="row gap" style={{ padding: '5px 0' }}>
              <span>🏬</span>
              <div className="grow"><div className="bold">{s.name}</div><div className="small muted">{s.address} · {s.openingHours}</div></div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Hoàn tiền</div>
          <div>Hạn chót yêu cầu hoàn tiền: <b>{dateTime(v.refundableUntil)}</b></div>
          <div className="small muted">Áp dụng cho voucher chưa sử dụng, trong vòng 7 ngày kể từ khi mua và còn ít nhất 3 ngày trước hạn sử dụng (BR-05).</div>
          <button type="button" className="btn btn-ghost btn-block mt" disabled={!v.refund.canRefund} onClick={() => navigate(`/wallet/${id}/refund`)}>⟲ Yêu cầu hoàn tiền</button>
          {!v.refund.canRefund && <div className="small mt" style={{ color: 'var(--bad)' }}>{v.refund.reason}</div>}
          {lastRefund && (
            <div className="small mt">Yêu cầu gần nhất: <Badge tone={REFUND_STATUS[lastRefund.status]?.[1]}>{REFUND_STATUS[lastRefund.status]?.[0]}</Badge>
              {' '}<button type="button" className="link small" onClick={() => navigate('/refunds')}>Theo dõi</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Đánh giá</div>
          {v.review.hasReviewed ? <div className="muted">Bạn đã đánh giá chiến dịch này.</div> : v.review.canReview ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/wallet/${id}/review`)}>☆ Viết đánh giá</button>
          ) : <div className="small muted">Dùng voucher xong bạn có thể đánh giá chiến dịch.</div>}
        </div>
      </div>
    </div>
  );
}

// Ma QR + OTP 6 so hieu luc 60 giay; tu lam moi khi het han; tu chuyen sang "da su dung" khi cua hang xac nhan
export function UseVoucher() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [token, setToken] = useState(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState(null);
  const [used, setUsed] = useState(null);
  const [busy, setBusy] = useState(false);
  const voucher = useLoad(() => customerApi.get(`/wallet/${id}`), [id]);
  const busyRef = useRef(false);
  // May chu chi cho tao 10 ma / 10 phut: tu lam moi toi da AUTO_REFRESH_MAX lan lien tiep,
  // sau do cho khach bam "Lam moi ma" de man hinh de mo lau khong dot het luot va bao loi
  const autoCount = useRef(0);
  const [paused, setPaused] = useState(false);

  const issue = useCallback(async (auto = false) => {
    if (busyRef.current) return;
    if (auto) autoCount.current += 1;
    else autoCount.current = 0;
    setPaused(false);
    busyRef.current = true;
    setBusy(true);
    try {
      const t = await customerApi.post('/redeem/token', { voucherItemId: id });
      setToken(t);
      setError(null);
    } catch (e) {
      setError(e);
      setToken(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    issue();
  }, [issue]);

  // Dong ho dem nguoc; het 60 giay thi tu sinh ma moi
  useEffect(() => {
    if (!token || used) return undefined;
    const tick = () => {
      const s = Math.max(0, Math.ceil((new Date(token.expiresAt) - Date.now()) / 1000));
      setLeft(s);
      if (s > 0) return;
      if (autoCount.current >= AUTO_REFRESH_MAX) setPaused(true);
      else issue(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [token, used, issue]);

  // Hoi trang thai voucher de biet nhan vien da xac nhan
  useEffect(() => {
    if (used) return undefined;
    const t = setInterval(async () => {
      try {
        const s = await customerApi.get(`/redeem/status/${id}`);
        if (s.status === 'USED') {
          setUsed(s);
          toast('Voucher đã được cửa hàng xác nhận sử dụng.', 'ok');
        }
      } catch {
        // thu lai o luot sau
      }
    }, 2000);
    return () => clearInterval(t);
  }, [id, used, toast]);

  // Giu man hinh sang trong luc dua ma cho nhan vien
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => lock?.release?.();
  }, []);

  const title = voucher.data?.campaign?.title;
  return (
    <div>
      <TopBar title="Sử dụng voucher" />
      <div className="screen center">
        <h3>{title}</h3>
        {used ? (
          <>
            <div className="card" style={{ background: 'var(--ok-soft)' }}>
              <div className="status-icon ok">✓</div>
              <h3 style={{ color: 'var(--ok)' }}>Voucher đã được sử dụng</h3>
              <p className="small">Cảm ơn bạn! Voucher đã được cửa hàng xác nhận{used.storeName ? ` tại ${used.storeName}` : ''}.</p>
            </div>
            <button type="button" className="btn btn-block mt" onClick={() => navigate('/wallet')}>Về ví voucher</button>
          </>
        ) : error ? (
          <>
            <ErrorBox error={error} />
            <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate(`/wallet/${id}`)}>Quay lại chi tiết voucher</button>
          </>
        ) : !token ? <Spinner text="Đang tạo mã..." /> : (
          <>
            <div className="qr-box mt" style={paused ? { opacity: 0.25 } : undefined}><QRCodeSVG value={token.qrPayload} size={220} level="M" /></div>
            <div className="countdown">{left > 0 ? `Còn hiệu lực ${left}s` : paused ? 'Mã đã hết hiệu lực, bấm "Làm mới mã" khi tới quầy' : 'Đang làm mới mã...'}</div>
            <div className="small muted mt">Mã OTP thay thế (nếu nhân viên không quét được QR)</div>
            <div className="otp-big" style={paused ? { opacity: 0.25, textDecoration: 'line-through' } : undefined}>{token.otpCode}</div>
            <p className="small muted">Mã tự làm mới sau mỗi 60 giây. Đưa mã cho nhân viên tại quầy, không gửi ảnh chụp mã cho người khác.</p>
            <button type="button" className="btn btn-block mt" disabled={busy} onClick={() => issue()}>Làm mới mã</button>
            <details className="small muted mt" style={{ textAlign: 'left' }}>
              <summary>Demo trên cùng một máy: sao chép nội dung mã QR</summary>
              <div className="mono" style={{ wordBreak: 'break-all', userSelect: 'all' }}>{token.qrPayload}</div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

export function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const v = useLoad(() => customerApi.get(`/wallet/${id}`), [id]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, run] = useAction();
  const submit = async () => {
    const r = await run(() => customerApi.post('/reviews', { voucherItemId: id, rating, comment }), 'Cảm ơn bạn đã đánh giá!');
    if (r) navigate(`/wallet/${id}`, { replace: true });
  };
  return (
    <div>
      <TopBar title="Đánh giá" />
      <div className="screen">
        <div className="bold mb">{v.data?.campaign?.title}</div>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((s) => <button type="button" key={s} className={s <= rating ? 'on' : ''} onClick={() => setRating(s)}>★</button>)}
        </div>
        <div className="center small muted mb">{rating} / 5 sao</div>
        <textarea className="input" rows={5} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Chia sẻ trải nghiệm của bạn" />
        <div className="small muted" style={{ textAlign: 'right' }}>{comment.length}/1000</div>
        <button type="button" className="btn btn-block mt" disabled={busy} onClick={submit}>Gửi đánh giá</button>
      </div>
    </div>
  );
}
