const { Notification, NotificationSetting, Favorite, VoucherItem, Campaign } = require('../models');
const { NotificationType, VoucherItemStatus } = require('../utils/enums');
const { DAY_MS } = require('../utils/time');

const NOTIFICATION_TYPE_LABELS = {
  CASHBACK_UPDATE: 'Xác nhận và tranh chấp Cashback',
  VOUCHER_ISSUED: 'Voucher đã phát hành',
  VOUCHER_USED: 'Voucher đã sử dụng',
  REFUND_RESULT: 'Kết quả hoàn tiền',
  VOUCHER_EXPIRING: 'Nhắc voucher sắp hết hạn',
  CAMPAIGN_NEW: 'Chiến dịch mới của thương hiệu theo dõi',
};

// Luu thong bao. Khong bao gio nem loi ra ngoai: thong bao hong khong duoc lam hong giao dich mua / redeem / hoan tien.
async function notify(userId, type, { title, body, data = {}, dedupeKey }) {
  try {
    const setting = await NotificationSetting.findOne({ userId, type });
    if (setting && !setting.enabled) return null;
    const doc = { userId, type, title, body, data };
    if (dedupeKey) doc.dedupeKey = dedupeKey;
    return await Notification.create(doc);
  } catch (e) {
    if (e.code !== 11000) console.warn(`[notify] Khong luu duoc thong bao ${type}: ${e.message}`);
    return null;
  }
}

const orderCreated = (userId, orderId, title) =>
  notify(userId, NotificationType.ORDER_CREATED, {
    title: 'Đã tạo đơn hàng',
    body: `Hoàn tất thanh toán trong 15 phút để giữ voucher "${title}".`,
    data: { orderId: String(orderId) },
    dedupeKey: `ORDER_CREATED:${orderId}`,
  });

const vouchersIssued = (userId, orderId, title, quantity) =>
  notify(userId, NotificationType.VOUCHER_ISSUED, {
    title: 'Voucher đã về ví',
    body: `${quantity} voucher "${title}" đã sẵn sàng sử dụng.`,
    data: { orderId: String(orderId) },
    dedupeKey: `VOUCHER_ISSUED:${orderId}`,
  });

const voucherUsed = (userId, voucherItemId, title, storeName) =>
  notify(userId, NotificationType.VOUCHER_USED, {
    title: 'Đã sử dụng voucher',
    body: storeName ? `"${title}" đã được sử dụng tại ${storeName}.` : `"${title}" đã được sử dụng.`,
    data: { voucherItemId: String(voucherItemId) },
    dedupeKey: `VOUCHER_USED:${voucherItemId}`,
  });

const refundResult = (userId, refId, status, message) =>
  notify(userId, NotificationType.REFUND_RESULT, {
    title: 'Kết quả hoàn tiền',
    body: message,
    data: { refundId: String(refId), status },
    dedupeKey: `REFUND_RESULT:${refId}:${status}`,
  });

// Chien dich vua phat hanh -> bao cho khach theo doi thuong hieu
async function campaignPublished(campaign, brandName) {
  const followers = await Favorite.find({ targetType: 'BRAND', targetId: campaign.brandId });
  for (const f of followers) {
    await notify(f.userId, NotificationType.CAMPAIGN_NEW, {
      title: `${brandName} có ưu đãi mới`,
      body: campaign.title,
      data: { campaignId: String(campaign._id) },
      dedupeKey: `CAMPAIGN_NEW:${campaign._id}:${f.userId}`,
    });
  }
}

// Nhac voucher ACTIVE sap het han truoc 7 ngay va 1 ngay
async function remindExpiringVouchers(now = new Date()) {
  let sent = 0;
  for (const days of [7, 1]) {
    const vouchers = await VoucherItem.find({
      status: VoucherItemStatus.ACTIVE,
      expireAt: { $gt: new Date(now.getTime() + (days - 1) * DAY_MS), $lte: new Date(now.getTime() + days * DAY_MS) },
    });
    for (const v of vouchers) {
      const c = await Campaign.findById(v.campaignId).select('title');
      const n = await notify(v.userId, NotificationType.VOUCHER_EXPIRING, {
        title: days === 1 ? 'Voucher hết hạn ngày mai' : 'Voucher sắp hết hạn',
        body: `"${c?.title ?? v.code}" còn ${days} ngày sử dụng.`,
        data: { voucherItemId: String(v._id) },
        dedupeKey: `VOUCHER_EXPIRING:${days}:${v._id}`,
      });
      if (n) sent++;
    }
  }
  return sent;
}

module.exports = {
  NOTIFICATION_TYPE_LABELS, notify, orderCreated, vouchersIssued, voucherUsed, refundResult,
  campaignPublished, remindExpiringVouchers,
};
