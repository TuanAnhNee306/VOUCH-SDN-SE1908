const cron = require('node-cron');
const orders = require('../services/order');
const campaigns = require('../services/campaign');
const settlements = require('../services/settlement');
const cashback = require('../services/cashback');
const notifications = require('../services/notification');

const safe = (name, fn) => async () => {
  try {
    const result = await fn();
    if (result && Object.values(result).some((v) => typeof v === 'number' && v > 0)) console.log(`[job] ${name}:`, JSON.stringify(result));
  } catch (e) {
    console.error(`[job] ${name} that bai:`, e.message);
  }
};

// Tat ca lich chay theo gio Viet Nam
function startJobs() {
  const tz = { timezone: 'Asia/Ho_Chi_Minh' };
  // 5 phut / lan: huy don qua 15 phut giu cho (FR-ORDER-03) + ra soat trang thai chien dich (FR-CAMP-10)
  const every5 = safe('ra soat 5 phut', async () => ({
    cashbackReminders: await cashback.remind().catch(e => { console.error('[cashback reminder]', e.message); return 0; }),
    cancelledOrders: await orders.cancelExpiredOrders(),
    ...(await campaigns.runStatusTransitions()),
  }));
  cron.schedule('*/5 * * * *', every5, tz);
  // 01:00 ngay 01 hang thang: chot doi soat thang truoc (UC-05)
  cron.schedule('0 1 1 * *', safe('chot doi soat', async () => {
    const r = await settlements.runPreviousMonth();
    return { created: r.created };
  }), tz);
  // 09:00 hang ngay: nhac voucher sap het han
  cron.schedule('0 9 * * *', safe('nhac het han', async () => ({ reminded: await notifications.remindExpiringVouchers() })), tz);
  every5();
}

module.exports = { startJobs };
