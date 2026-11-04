export const money = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('vi-VN')} ₫`);

const pad = (n) => String(n).padStart(2, '0');

export function dateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function date(v) {
  if (!v) return '—';
  const d = new Date(v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Gia tri cho o input datetime-local theo gio may
export function toLocalInput(v) {
  if (!v) return '';
  const d = new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const km = (v) => (v === null || v === undefined ? '' : v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`);

export const VOUCHER_TYPES = { CASHBACK: 'Voucher hoàn tiền', STORED_VALUE: 'Voucher mệnh giá', DISCOUNT: 'Mã giảm giá', PREPAID: 'Voucher mệnh giá', COMBO: 'Combo / gói dịch vụ' };

export const CAMPAIGN_STATUS = {
  DRAFT: ['Nháp', 'gray'],
  PENDING: ['Chờ duyệt', 'warn'],
  APPROVED: ['Đã duyệt', 'info'],
  PUBLISHED: ['Đang bán', 'ok'],
  SOLD_OUT: ['Hết hàng', 'warn'],
  PAUSED: ['Tạm dừng', 'gray'],
  ENDED: ['Kết thúc', 'gray'],
};

export const ORDER_STATUS = {
  PENDING: ['Chờ thanh toán', 'warn'],
  PAID: ['Đã thanh toán', 'info'],
  FULFILLED: ['Đã phát hành voucher', 'ok'],
  CANCELLED: ['Đã hủy', 'bad'],
  REFUNDED_OVERSOLD: ['Hết hàng, đã hoàn 100%', 'bad'],
  PAYMENT_MISMATCH: ['Sai số tiền, chờ hoàn lại', 'bad'],
};

export const BRAND_STATUS = {
  PENDING: ['Chờ duyệt', 'warn'],
  APPROVED: ['Đang hoạt động', 'ok'],
  REJECTED: ['Bị từ chối', 'bad'],
  SUSPENDED: ['Đình chỉ', 'bad'],
};

export const REFUND_STATUS = {
  REQUESTED: ['Đã gửi yêu cầu', 'info'],
  PROCESSING: ['Đang xử lý', 'info'],
  MANUAL_PENDING: ['Chờ quản trị viên hoàn tiền', 'warn'],
  COMPLETED: ['Hoàn tiền thành công', 'ok'],
  REJECTED: ['Không đủ điều kiện', 'bad'],
  FAILED: ['Hoàn tiền không thành công', 'bad'],
};

export const VOUCHER_STATUS_TONE = { PENDING_CASHBACK: 'warn', MERCHANT_REPORTED_PAID: 'warn', DISPUTED: 'bad', COMPLETED: 'ok', ACTIVE: 'ok', REFUND_PENDING: 'warn', USED: 'info', EXPIRED: 'gray', REFUNDED: 'gray' };
