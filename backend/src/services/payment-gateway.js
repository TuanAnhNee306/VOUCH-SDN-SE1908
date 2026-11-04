const crypto = require('crypto');
const { str } = require('../config/env');

// VNPAY Payment Gateway v2.1.0. Secrets only live in backend environment variables.
const hmacSha256 = (key, data) => crypto.createHmac('sha256', key).update(data).digest('hex');
const hmacSha512 = (key, data) => crypto.createHmac('sha512', key).update(data).digest('hex');
const vnpaySecret = () => str('VNPAY_HASH_SECRET');
const vnpayTmnCode = () => str('VNPAY_TMN_CODE');
const vnpayConfigured = () => !!(vnpayTmnCode() && vnpaySecret() && str('VNPAY_RETURN_URL') && str('VNPAY_IPN_URL'));

// VNPAY signs URL-encoded, key-sorted fields, excluding signature fields.
const encodeVnp = (value) => encodeURIComponent(String(value)).replace(/%20/g, '+');
function vnpaySignData(params) {
  return Object.keys(params)
    .filter((key) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType' && params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => `${encodeVnp(key)}=${encodeVnp(params[key])}`)
    .join('&');
}
const signVnpayParams = (params) => hmacSha512(vnpaySecret(), vnpaySignData(params));

function safeEqualHex(expected, received) {
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(received || ''), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function formatVnpDate(date) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim();
  const ip = value || req.ip || req.socket?.remoteAddress || '127.0.0.1';
  return ip === '::1' ? '127.0.0.1' : ip.replace(/^::ffff:/, '');
}

async function createVnpayUrl({ orderCode, amount, expiresAt, ipAddress }) {
  if (!vnpayConfigured()) return null;
  const params = {
    vnp_Version: str('VNPAY_VERSION', '2.1.0'),
    vnp_Command: 'pay',
    vnp_TmnCode: vnpayTmnCode(),
    vnp_Amount: String(Math.round(Number(amount) * 100)),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: String(orderCode),
    vnp_OrderInfo: `Thanh toan don ${orderCode}`,
    vnp_OrderType: str('VNPAY_ORDER_TYPE', 'other'),
    vnp_Locale: str('VNPAY_LOCALE', 'vn'),
    vnp_ReturnUrl: str('VNPAY_RETURN_URL'),
    vnp_IpAddr: ipAddress || '127.0.0.1',
    vnp_CreateDate: formatVnpDate(new Date()),
    vnp_ExpireDate: formatVnpDate(new Date(expiresAt)),
  };
  return `${str('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html')}?${vnpaySignData(params)}&vnp_SecureHash=${signVnpayParams(params)}`;
}

// Returns null for malformed/tampered IPN. The route additionally validates order and amount.
function parseVnpayIpn(query) {
  const q = Object.fromEntries(Object.entries(query || {}).map(([key, value]) => [key, Array.isArray(value) ? null : value]));
  if (!q.vnp_SecureHash || !safeEqualHex(signVnpayParams(q), q.vnp_SecureHash)) return null;
  if (q.vnp_TmnCode !== vnpayTmnCode() || !q.vnp_TxnRef || !q.vnp_TransactionNo || !/^\d+$/.test(String(q.vnp_Amount))) return null;
  const amount = Number(q.vnp_Amount) / 100;
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return {
    orderCode: String(q.vnp_TxnRef),
    gatewayTxnId: `VNPAY-${q.vnp_TransactionNo}`,
    amount,
    success: q.vnp_ResponseCode === '00' && q.vnp_TransactionStatus === '00',
    raw: q,
  };
}

// Retained for automated test scenarios; never expose this secret to clients.
const webhookSecret = () => str('PAYMENT_WEBHOOK_SECRET', 'change_me_webhook_secret');
const signWebhook = (p) => hmacSha256(webhookSecret(), `${p.orderId}|${p.gatewayTxnId}|${p.amount}|${p.status}`);
function verifyWebhook(p) {
  const expected = Buffer.from(signWebhook(p));
  const given = Buffer.from(String(p.signature || ''));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Refund integration remains sandbox/manual until the VNPAY Refund API is configured separately.
async function sandboxRefund(mode) {
  switch ((mode || str('REFUND_SANDBOX_RESULT', 'success')).toLowerCase()) {
    case 'declined': return { status: 'DECLINED', message: 'Cổng thanh toán từ chối giao dịch hoàn tiền.' };
    case 'unavailable': return { status: 'UNAVAILABLE', message: 'Cổng thanh toán tạm thời không phản hồi.' };
    default: return { status: 'SUCCESS', gatewayRefundId: `SBX-RF-${crypto.randomUUID()}` };
  }
}

module.exports = {
  hmacSha256, hmacSha512, vnpaySignData, signVnpayParams, formatVnpDate, clientIp,
  vnpayConfigured, createVnpayUrl, parseVnpayIpn, signWebhook, verifyWebhook, sandboxRefund,
};
