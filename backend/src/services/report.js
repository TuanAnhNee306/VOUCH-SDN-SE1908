const { Order, VoucherItem, Campaign, Brand, RedemptionLog, Store } = require('../models');
const { OrderStatus, BrandStatus, VoucherItemStatus, CampaignStatus } = require('../utils/enums');
const { badRequest } = require('../utils/errors');
const { vietnamDate } = require('../utils/time');

// Ngay dang YYYY-MM-DD = ca ngay theo gio VN
function range(q) {
  const parse = (v, end) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + (end ? 'T23:59:59.999+07:00' : 'T00:00:00.000+07:00')) : new Date(v));
  const from = q.from ? parse(q.from, false) : undefined;
  const to = q.to ? parse(q.to, true) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw badRequest('Khoảng thời gian không hợp lệ.');
  return { from, to };
}

const paidAtFilter = ({ from, to }) => (from || to ? { paidAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {});

// Bao cao thuong hieu: so ban, doanh thu, ty le su dung; loc theo chien dich / chi nhanh / thoi gian
async function brandReport(brandId, q = {}) {
  const r = range(q);
  const campaignFilter = { brandId, ...(q.campaignId ? { _id: q.campaignId } : {}) };
  const campaigns = await Campaign.find(campaignFilter);
  const orders = await Order.find({ campaignId: { $in: campaigns.map((c) => c._id) }, status: OrderStatus.FULFILLED, ...paidAtFilter(r) }).select('_id');
  let items = await VoucherItem.find({ orderId: { $in: orders.map((o) => o._id) } });
  if (q.storeId) {
    if (!(await Store.exists({ _id: q.storeId, brandId }))) throw badRequest('Chi nhánh không thuộc thương hiệu này.');
    const logs = await RedemptionLog.find({ storeId: q.storeId, voucherItemId: { $in: items.map((i) => i._id) } }).select('voucherItemId');
    const ids = new Set(logs.map((l) => String(l.voucherItemId)));
    items = items.filter((i) => ids.has(String(i._id)));
  }
  const now = new Date();
  const count = (fn) => items.filter(fn).length;
  const refunded = items.filter((v) => v.status === VoucherItemStatus.REFUNDED);
  const used = count((v) => v.status === VoucherItemStatus.USED);
  const gross = items.reduce((s, v) => s + v.unitPrice, 0);
  const refundedAmount = refunded.reduce((s, v) => s + v.unitPrice, 0);
  const byCampaign = campaigns.map((c) => {
    const own = items.filter((i) => String(i.campaignId) === String(c._id));
    return {
      id: String(c._id), title: c.title, status: c.status, sold: own.length,
      used: own.filter((i) => i.status === VoucherItemStatus.USED).length,
      revenue: own.filter((i) => i.status !== VoucherItemStatus.REFUNDED).reduce((s, i) => s + i.unitPrice, 0),
    };
  });
  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === CampaignStatus.PUBLISHED).length,
    totalVoucherSold: items.length, grossRevenue: gross, refundedAmount, totalRevenue: gross - refundedAmount,
    totalVoucherUsed: used,
    totalVoucherExpired: count((v) => v.status === VoucherItemStatus.EXPIRED || (v.status === VoucherItemStatus.ACTIVE && v.expireAt <= now)),
    totalVoucherRefunded: refunded.length,
    usageRate: items.length - refunded.length > 0 ? (used / (items.length - refunded.length)) * 100 : 0,
    byCampaign,
  };
}

async function adminDashboard(q = {}) {
  const r = range(q);
  const orders = await Order.find({ status: OrderStatus.FULFILLED, ...paidAtFilter(r) });
  const byDate = new Map();
  let gross = 0;
  let refunded = 0;
  let commission = 0;
  for (const o of orders) {
    gross += o.totalAmount;
    refunded += o.refundedAmount;
    commission += Math.round((o.totalAmount - o.refundedAmount) * (o.commissionRate || 0));
    const d = vietnamDate(o.paidAt);
    const row = byDate.get(d) || { date: d, count: 0, revenue: 0 };
    row.count++;
    row.revenue += o.totalAmount - o.refundedAmount;
    byDate.set(d, row);
  }
  const [activeBrands, pendingBrands, pendingCampaigns, mismatches, publishedCampaigns] = await Promise.all([
    Brand.countDocuments({ status: BrandStatus.APPROVED }),
    Brand.countDocuments({ status: BrandStatus.PENDING }),
    Campaign.countDocuments({ status: CampaignStatus.PENDING }),
    Order.countDocuments({ status: OrderStatus.PAYMENT_MISMATCH }),
    Campaign.countDocuments({ status: CampaignStatus.PUBLISHED }),
  ]);
  return {
    grossRevenue: gross, refundedAmount: refunded, totalRevenue: gross - refunded, totalCommission: commission,
    totalActiveBrands: activeBrands, pendingBrands, pendingCampaigns, paymentMismatches: mismatches, publishedCampaigns,
    totalTransactions: orders.length,
    transactionsByDay: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

module.exports = { brandReport, adminDashboard };
