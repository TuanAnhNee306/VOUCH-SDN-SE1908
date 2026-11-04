require('dotenv').config();

const str = (key, fallback = '') => (process.env[key] ?? '').trim() || fallback;
const int = (key, fallback) => {
  const v = parseInt(process.env[key] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const bool = (key, fallback = false) => {
  const v = (process.env[key] || '').trim().toLowerCase();
  if (!v) return fallback;
  return v === 'true' || v === '1';
};

module.exports = { str, int, bool };
