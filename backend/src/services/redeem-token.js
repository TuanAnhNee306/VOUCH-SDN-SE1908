const crypto = require('crypto');
const { str } = require('../config/env');

// Ma QR dong: "v1.<nonce>.<expiresAtMs>.<chu ky>" - khong chua id hay ma tra cuu cua voucher (BR-16).
// Chu ky = HMAC-SHA256(REDEEM_HMAC_SECRET, "v1.<nonce>.<expiresAtMs>"), base64url.
const QR_VERSION = 'v1';
const secret = () => str('REDEEM_HMAC_SECRET', 'dev-only-redeem-hmac-secret');

const newNonce = () => crypto.randomBytes(16).toString('hex');
const newOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const signQr = (nonce, exp) => crypto.createHmac('sha256', secret()).update(`${QR_VERSION}.${nonce}.${exp}`).digest('base64url');

function buildQrPayload(nonce, expiresAt) {
  const exp = new Date(expiresAt).getTime();
  return `${QR_VERSION}.${nonce}.${exp}.${signQr(nonce, exp)}`;
}

// nonce + han neu dung dinh dang va dung chu ky; null neu ma gia / bi sua
function verifyQrPayload(raw) {
  const parts = String(raw || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== QR_VERSION) return null;
  const [, nonce, expRaw, signature] = parts;
  if (!/^[0-9a-f]{32}$/.test(nonce) || !/^\d{1,15}$/.test(expRaw)) return null;
  const exp = Number(expRaw);
  const expected = Buffer.from(signQr(nonce, exp));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return { nonce, expiresAt: new Date(exp) };
}

module.exports = { newNonce, newOtp, buildQrPayload, verifyQrPayload };
