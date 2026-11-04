import { useSyncExternalStore } from 'react';

// Moi khu vuc (app khach hang / web) giu phien rieng trong localStorage,
// nen co the mo app khach va web cua hang cung luc tren mot trinh duyet.
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function createClient(storageKey) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || null;
    } catch {
      return null;
    }
  };
  let session = read();
  const listeners = new Set();
  let refreshing = null;

  function setSession(next) {
    session = next;
    try {
      if (next) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch {
      // trinh duyet chan localStorage: van chay trong phien hien tai
    }
    listeners.forEach((l) => l());
  }

  // Mot lan lam moi dung chung cho cac request song song (refresh token xoay vong)
  function refresh() {
    if (!session?.refreshToken) return Promise.resolve(false);
    if (!refreshing) {
      refreshing = fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      })
        .then(async (res) => {
          if (!res.ok) return false;
          const data = await res.json();
          setSession({ ...session, ...data });
          return true;
        })
        .catch(() => false)
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  async function request(method, path, body, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    let res;
    try {
      res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError('Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.', { status: 0, code: 'NETWORK' });
    }
    if (res.status === 401 && session?.refreshToken && retry) {
      if (await refresh()) return request(method, path, body, false);
      setSession(null);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.message || 'Có lỗi xảy ra, vui lòng thử lại.', { status: res.status, code: data?.code, details: data?.details });
    return data;
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b ?? {}),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    put: (p, b) => request('PUT', p, b ?? {}),
    del: (p) => request('DELETE', p),
    getSession: () => session,
    setSession,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async logout() {
      try {
        await request('POST', '/auth/logout', {}, false);
      } catch {
        // phien da het han thi chi can xoa o may
      }
      setSession(null);
    },
  };
}

export const customerApi = createClient('vp_customer_session');
export const webApi = createClient('vp_web_session');

export function useSession(client) {
  return useSyncExternalStore(client.subscribe, client.getSession);
}
