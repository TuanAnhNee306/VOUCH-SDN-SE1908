const { str, bool } = require('./env');
function validateProduction() {
  if (str('NODE_ENV') !== 'production') return;
  if (!str('MONGO_URI') || bool('USE_EMBEDDED_MONGO')) throw new Error('Production requires an external database.');
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_SECRET', 'REDEEM_HMAC_SECRET', 'PAYMENT_WEBHOOK_SECRET']) {
    if (str(key).length < 32 || str(key).startsWith('change_me')) throw new Error(`Configure a private production ${key} of at least 32 characters.`);
  }
  if (str('JWT_ACCESS_SECRET') === str('JWT_REFRESH_SECRET')) throw new Error('Production JWT signing secrets must be different.');
  for (const key of ['CORS_ORIGIN', 'WEB_APP_URL']) {
    if (!str(key) || str(key).split(',').some(value => { try { return new URL(value.trim()).protocol !== 'https:'; } catch { return true; } })) throw new Error(`Configure HTTPS ${key} for production.`);
  }
}
module.exports = { validateProduction };
