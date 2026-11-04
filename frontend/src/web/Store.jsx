import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { webApi, useSession } from '../api/client';
import { Empty, ErrorBox, PromptDialog, Spinner, useAction, useLoad } from '../components/ui';
import { dateTime, money } from '../utils/format';

// FR-AUTH-12: chon chi nhanh lam viec dau ca (luu vao phien)
export function StoreSelect() {
  const navigate = useNavigate();
  const session = useSession(webApi);
  const stores = useLoad(() => webApi.get('/staff/my-stores'), []);
  const [busy, run] = useAction();
  const pick = async (s) => {
    const r = await run(() => webApi.post('/auth/select-store', { storeId: s.id }), `Đang làm việc tại ${s.name}`);
    if (r) {
      webApi.setSession({ ...session, activeStoreId: s.id, activeStore: { id: s.id, name: s.name } });
      navigate('/web/store/redeem');
    }
  };
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Chọn chi nhánh làm việc</h1>
      <ErrorBox error={stores.error} />
      {stores.loading && !stores.data ? <Spinner /> : stores.data?.length === 0 ? <Empty>Bạn chưa được gán vào chi nhánh nào đang hoạt động.</Empty> : stores.data?.map((s) => (
        <div key={s.id} className="card row gap" role="button" onClick={() => !busy && pick(s)} style={{ cursor: 'pointer', border: session?.activeStoreId === s.id ? '2px solid var(--primary)' : '' }}>
          <span>🏬</span>
          <div className="grow"><div className="bold">{s.name}</div><div className="small muted">{s.address}</div></div>
          <span>›</span>
        </div>
      ))}
    </div>
  );
}

// Quet QR bang camera (html5-qrcode). May demo khong co camera thi dan noi dung ma QR
function QrScanner({ onResult }) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!on) return undefined;
    let scanner;
    let stopped = false;
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return;
      scanner = new Html5Qrcode('qr-reader');
      ref.current = scanner;
      scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
        setOn(false);
        onResult(text);
      }).catch(() => {
        setErr('Không mở được camera. Hãy cấp quyền camera hoặc dán nội dung mã QR bên dưới.');
        setOn(false);
      });
    });
    return () => {
      stopped = true;
      scanner?.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [on, onResult]);
  return (
    <div>
      <div id="qr-reader" className="scanner" style={{ display: on ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!on && <span style={{ fontSize: 48, opacity: 0.4 }}>▦</span>}
      </div>
      {err && <div className="alert alert-warn small">{err}</div>}
      <button type="button" className="btn btn-ghost btn-block mt" onClick={() => { setErr(null); setOn(!on); }}>{on ? '■ Tắt camera' : '📷 Bật camera'}</button>
    </div>
  );
}

function ResultBanner({ result, onNext }) {
  if (!result) return null;
  if (result.ok) {
    const r = result.data;
    return (
      <div className="result-ok mb">
        <div style={{ fontSize: 34 }}>✓</div>
        <h2>HỢP LỆ</h2>
        <div className="bold">{r.campaign.title}</div>
        <div className="small">Mã voucher: {r.voucherCode}</div>
        <div className="small">Xác nhận lúc {dateTime(r.redeemedAt)} · {r.method === 'QR' ? 'Mã QR' : 'Mã OTP'}</div>
        {r.billAmount != null && <div className="small">Hóa đơn: {money(r.billAmount)}</div>}
        <button type="button" className="btn btn-ghost btn-block mt" style={{ background: '#fff' }} onClick={onNext}>→ Khách tiếp theo</button>
      </div>
    );
  }
  const e = result.error;
  const title = { VOUCHER_USED: 'ĐÃ SỬ DỤNG', TOKEN_EXPIRED: 'MÃ HẾT HIỆU LỰC', WRONG_STORE: 'SAI CHI NHÁNH', VOUCHER_EXPIRED: 'VOUCHER HẾT HẠN', VOUCHER_REFUND_PENDING: 'ĐANG CHỜ HOÀN TIỀN', OTP_LOCKED: 'TẠM KHÓA NHẬP OTP' }[e.code] || 'KHÔNG HỢP LỆ';
  return (
    <div className="result-bad mb">
      <div style={{ fontSize: 34 }}>✕</div>
      <h2>{title}</h2>
      <div className="small">{e.message}</div>
      <button type="button" className="btn btn-ghost btn-block mt" style={{ background: '#fff' }} onClick={onNext}>→ Khách tiếp theo</button>
    </div>
  );
}

// FR-REDEEM-05..13: xac nhan su dung bang QR hoac OTP; voucher menh gia bat buoc nhap hoa don
export function StoreRedeem() {
  const navigate = useNavigate();
  const session = useSession(webApi);
  const [tab, setTab] = useState('otp');
  const [otp, setOtp] = useState('');
  const [qrText, setQrText] = useState('');
  const [bill, setBill] = useState('');
  const [pending, setPending] = useState(null); // ma da quet nhung thieu hoa don (BR-03), chua bi tieu
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session?.activeStoreId) navigate('/web/store/select', { replace: true });
  }, [session, navigate]);

  const send = async (code) => {
    setBusy(true);
    try {
      const body = { ...code, ...(bill !== '' ? { billAmount: Number(bill) } : {}) };
      const data = await webApi.post('/staff/redeem', body);
      setResult({ ok: true, data });
      setPending(null);
      setOtp('');
      setQrText('');
    } catch (error) {
      if (error.code === 'BILL_REQUIRED') setPending(code);
      else {
        setPending(null);
        setResult({ ok: false, error });
      }
      if (error.code === 'STORE_NOT_SELECTED') navigate('/web/store/select');
    } finally {
      setBusy(false);
    }
  };
  const next = () => {
    setResult(null);
    setPending(null);
    setBill('');
    setOtp('');
    setQrText('');
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>Xác nhận sử dụng voucher</h1>
      <ResultBanner result={result} onNext={next} />
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')}>▦ Quét QR</button>
        <button type="button" className={`tab ${tab === 'otp' ? 'active' : ''}`} onClick={() => setTab('otp')}>⌨ Nhập OTP</button>
      </div>
      <label className={`field ${pending ? 'field-error' : ''}`}><span>Giá trị hóa đơn (VND)</span>
        <input type="number" min="0" value={bill} onChange={(e) => setBill(e.target.value)} placeholder="Bắt buộc với voucher mệnh giá" />
        <span className="small muted" style={{ fontWeight: 400 }}>Bắt buộc với voucher mệnh giá, không bắt buộc với loại khác (FR-REDEEM-08).</span>
      </label>
      {pending && (
        <div className="alert alert-warn">
          <b>Mã của khách vẫn còn hiệu lực.</b> Nhập giá trị hóa đơn rồi gửi lại, không cần khách quét lại mã.
          <div className="row gap mt">
            <button type="button" className="btn btn-sm" disabled={busy || bill === ''} onClick={() => send(pending)}>➤ Gửi lại kèm hóa đơn</button>
            <button type="button" className="link small" onClick={() => setPending(null)}>Hủy</button>
          </div>
        </div>
      )}
      {tab === 'qr' ? (
        <div>
          <QrScanner onResult={(text) => send({ qrPayload: text })} />
          <form className="row gap mt" onSubmit={(e) => { e.preventDefault(); if (qrText.trim()) send({ qrPayload: qrText.trim() }); }}>
            <input className="input grow mono" value={qrText} onChange={(e) => setQrText(e.target.value)} placeholder="Hoặc dán nội dung mã QR (v1....)" />
            <button className="btn" disabled={busy || !qrText.trim()}>Xác nhận</button>
          </form>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (otp.length === 6) send({ otpCode: otp }); }}>
          <input className="input otp-input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
          <button className="btn btn-block mt" disabled={busy || otp.length !== 6}>Xác nhận sử dụng</button>
          <p className="small muted center mt">Mã OTP 6 số hiển thị dưới mã QR trên ứng dụng của khách, hiệu lực 60 giây.</p>
        </form>
      )}
    </div>
  );
}

// FR-REDEEM-10: luot xac nhan trong ngay; sua hoa don trong 10 phut
export function StoreHistory() {
  const list = useLoad(() => webApi.get('/staff/history/today'), []);
  const [edit, setEdit] = useState(null);
  const [, run] = useAction();
  return (
    <div>
      <div className="page-head"><div><h1>Lịch sử trong ngày</h1><div className="small muted">{list.data?.length ?? 0} lượt xác nhận</div></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => list.reload()}>⟳ Làm mới</button></div>
      <ErrorBox error={list.error} />
      {list.loading && !list.data ? <Spinner /> : list.data?.length === 0 ? <Empty>Chưa có lượt xác nhận nào hôm nay.</Empty> : list.data?.map((h) => (
        <div key={h.id} className="card row gap">
          <span>▦</span>
          <div className="grow">
            <div className="bold">{h.campaignTitle}</div>
            <div className="small muted">Mã: {h.voucherCode} · {h.storeName}</div>
            <div className="small muted">{dateTime(h.redeemedAt)} · Phương thức: {h.method} · Hóa đơn: {money(h.billAmount)}</div>
          </div>
          {h.billEditable && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(h)}>✎ Sửa hóa đơn</button>}
        </div>
      ))}
      <PromptDialog open={!!edit} title="Sửa giá trị hóa đơn" message="Chỉ sửa được trong 10 phút sau khi xác nhận." label="Giá trị hóa đơn (VND)"
        onClose={() => setEdit(null)}
        onConfirm={async (v) => {
          const r = await run(() => webApi.patch(`/staff/logs/${edit.id}/bill`, { billAmount: Number(v) }), 'Đã cập nhật hóa đơn.');
          if (r) { setEdit(null); list.reload(true); }
        }} />
    </div>
  );
}
