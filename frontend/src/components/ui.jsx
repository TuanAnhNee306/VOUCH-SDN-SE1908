import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------- Thong bao nho (toast) ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Tai du lieu ----------
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  // Doi bo loc nhanh / tai lai lien tuc: phan hoi ve sau cua request cu khong duoc ghi de ket qua moi
  const latest = useRef(0);
  const reload = useCallback(async (silent = false) => {
    const call = ++latest.current;
    if (!silent) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fnRef.current();
      if (call === latest.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (call === latest.current) setState((s) => ({ ...s, error, loading: false }));
      return null;
    }
  }, []);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}

// Bao nut bam async: khoa nut trong luc chay va hien loi
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, success) => {
    setBusy(true);
    try {
      const r = await fn();
      if (success) toast(success, 'ok');
      return r;
    } catch (e) {
      toast(e.message, 'bad');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return [busy, run];
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ map, value }) {
  const [label, tone] = map[value] || [value, 'gray'];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Spinner({ text = 'Đang tải...' }) {
  return <div className="muted center pad">{text}</div>;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-bad">
      {error.message}
      {onRetry && <button type="button" className="link" onClick={() => onRetry()}> Thử lại</button>}
    </div>
  );
}

export function Empty({ icon = '🗂️', children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div>{children}</div>
    </div>
  );
}

// Hop thoai nhap lieu (ly do tu choi, ma giao dich...) thay cho window.prompt
export function PromptDialog({ open, title, message, label, placeholder, confirmText = 'Xác nhận', required = true, onConfirm, onClose }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setValue('');
  }, [open]);
  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault();
    if (required && !value.trim()) return;
    setBusy(true);
    try {
      await onConfirm(value.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{title}</h3>
        {message && <p className="muted">{message}</p>}
        {label !== undefined && (
          <label className="field">
            <span>{label}</span>
            <input autoFocus value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
          </label>
        )}
        <div className="row end gap">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn" disabled={busy || (required && label !== undefined && !value.trim())}>{confirmText}</button>
        </div>
      </form>
    </div>
  );
}

export function Logo({ size = 'md' }) {
  return <span className={`logo logo-${size}`}>vouch<span>.</span></span>;
}

export function CampaignImage({ src, className = '', fallbackLabel = '' }) {
  const [failed, setFailed] = useState(false);
  const initials = fallbackLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`cimg ${className}`}>
      {src && !failed ? (
        <img src={src} alt={fallbackLabel} onError={() => setFailed(true)} />
      ) : fallbackLabel ? (
        <span className="brand-fallback" aria-label={fallbackLabel}>{initials || fallbackLabel.slice(0, 2).toUpperCase()}</span>
      ) : (
        <span className="cimg-icon">🏷️</span>
      )}
    </div>
  );
}
