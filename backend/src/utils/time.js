// Gio Viet Nam (UTC+7). Moc thoi gian luu UTC, hien thi / tinh "ngay" theo gio VN.
const VN_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const MINUTE = 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

// "14:05 21/10/2026"
function formatVnDateTime(d) {
  const v = new Date(new Date(d).getTime() + VN_OFFSET_MS);
  return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())} ${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
}

function startOfVnDay(now = new Date()) {
  return new Date(Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS);
}

function vietnamDate(d) {
  return new Date(new Date(d).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// Ky doi soat thang truoc theo gio VN: [01/thang truoc 00:00, 01/thang nay 00:00)
function previousVnMonth(now = new Date()) {
  const v = new Date(now.getTime() + VN_OFFSET_MS);
  const end = new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), 1) - VN_OFFSET_MS);
  const start = new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() - 1, 1) - VN_OFFSET_MS);
  return { start, end };
}

module.exports = { VN_OFFSET_MS, DAY_MS, MINUTE, formatVnDateTime, startOfVnDay, vietnamDate, previousVnMonth };
