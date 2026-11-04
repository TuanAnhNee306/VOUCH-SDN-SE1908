const { Settlement, Brand, VoucherItem, Order, RefundRequest, SystemConfig, AuditLog } = require('../models');
const { OrderStatus, SettlementStatus, VoucherItemStatus } = require('../utils/enums');
const { badRequest, notFound } = require('../utils/errors');
const { OPEN_REFUND_STATUSES, validateCommissionRate } = require('./rules');
const { COMMISSION_RATE_KEY, getCommissionRate, validRate } = require('./config');
const { previousVnMonth } = require('../utils/time');

// FR-SETTLE-01, BR-09: doi ty le hoa hong chung. Don cu da chot ty le luc thanh toan nen khong bi anh huong.
async function setCommissionRate(rate, updatedBy) {
  const value = validateCommissionRate(rate);
  const previous = await SystemConfig.findOne({ key: COMMISSION_RATE_KEY });
  await SystemConfig.updateOne({ key: COMMISSION_RATE_KEY }, { value: String(value), updatedBy }, { upsert: true });
  await AuditLog.create({ actorUserId: updatedBy, action: 'SET_COMMISSION_RATE', entityType: 'SystemConfig', entityId: COMMISSION_RATE_KEY, detail: { previousRate: validRate(previous?.value), newRate: value } });
  return { message: 'Đã cập nhật tỷ lệ hoa hồng.', rate: value };
}

async function getCommissionRateInfo() {
  const config = await SystemConfig.findOne({ key: COMMISSION_RATE_KEY });
  const stored = validRate(config?.value);
  return { rate: await getCommissionRate(), isDefault: stored === null, updatedBy: config?.updatedBy ?? null, updatedAt: config?.updatedAt ?? null };
}

// UC-05, FR-SETTLE-02..08. Moi thuong hieu mot phieu cho ky [periodStart, periodEnd).
// BR-14: chi gom voucher DA HET QUYEN HOAN tai thoi diem chot (da dung / het han / qua refundableUntil)
//        va khong co yeu cau hoan dang xu ly. Voucher ACTIVE con trong han hoan KHONG vao phieu (sua loi F13).
// BR-13: voucher da hoan / dang hoan khong vao phieu. DC-06: moi voucher thuoc toi da mot phieu.
async function runSettlement(periodStart, periodEnd, now = new Date()) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw badRequest('Kỳ đối soát không hợp lệ.');
  const cutoff = new Date(Math.min(now.getTime(), end.getTime()));
  const currentRate = await getCommissionRate();
  const created = [];

  const paidOrders = await Order.find({ status: OrderStatus.FULFILLED, paidAt: { $gte: start, $lt: end } }).select('_id commissionRate');
  const orderRate = new Map(paidOrders.map((o) => [String(o._id), o.commissionRate]));
  if (paidOrders.length === 0) return created;

  const openRefundItems = await RefundRequest.distinct('voucherItemId', { status: { $in: OPEN_REFUND_STATUSES } });

  const brands = await Brand.find();
  for (const brand of brands) {
    const items = await VoucherItem.find({
      brandId: brand._id,
      orderId: { $in: paidOrders.map((o) => o._id) },
      settlementId: null,
      _id: { $nin: openRefundItems },
      $or: [
        { status: { $in: [VoucherItemStatus.USED, VoucherItemStatus.COMPLETED, VoucherItemStatus.EXPIRED] } },
        { status: VoucherItemStatus.ACTIVE, $or: [{ refundableUntil: { $lte: cutoff } }, { expireAt: { $lte: cutoff } }] },
      ],
    });
    if (items.length === 0) continue; // ky khong co voucher hop le thi khong sinh phieu

    const lines = items.map((v) => {
      const stored = orderRate.get(String(v.orderId));
      const rate = stored != null ? Number(stored) : currentRate;
      return { voucherItemId: v._id, orderId: v.orderId, code: v.code, amount: v.unitPrice, commissionRate: rate, commissionAmount: Math.round(v.unitPrice * rate) };
    });
    const settlement = new Settlement({ brandId: brand._id, periodStart: start, periodEnd: end, status: SettlementStatus.PENDING });
    // DC-06: chiem voucher co dieu kien settlementId = null; chay job 2 lan khong sinh phieu trung
    const claim = await VoucherItem.updateMany({ _id: { $in: items.map((v) => v._id) }, settlementId: null }, { settlementId: settlement._id });
    let claimedLines = lines;
    if (claim.modifiedCount !== lines.length) {
      const mine = new Set((await VoucherItem.find({ settlementId: settlement._id }).select('_id')).map((v) => String(v._id)));
      claimedLines = lines.filter((l) => mine.has(String(l.voucherItemId)));
    }
    if (claimedLines.length === 0) continue;
    const gross = claimedLines.reduce((s, l) => s + l.amount, 0);
    const commission = claimedLines.reduce((s, l) => s + l.commissionAmount, 0);
    Object.assign(settlement, { voucherCount: claimedLines.length, grossRevenue: gross, commissionAmount: commission, payableAmount: gross - commission, items: claimedLines });
    await settlement.save();
    created.push(settlement);
  }
  return created;
}

// Job 01:00 ngay 01 hang thang (gio VN) va nut "Chot doi soat thang truoc"
async function runPreviousMonth(now = new Date()) {
  const { start, end } = previousVnMonth(now);
  const created = await runSettlement(start, end, now);
  return { periodStart: start, periodEnd: end, created: created.length, settlements: created };
}

async function present(list) {
  const brands = await Brand.find({ _id: { $in: list.map((s) => s.brandId) } }).select('name');
  const names = new Map(brands.map((b) => [String(b._id), b.name]));
  return list.map((s) => {
    const json = s.toJSON();
    delete json.items;
    return { ...json, brandName: names.get(String(s.brandId)) ?? null };
  });
}

const findAll = async () => present(await Settlement.find().sort({ periodStart: -1, createdAt: -1 }));
const findByBrand = async (brandId) => present(await Settlement.find({ brandId }).sort({ periodStart: -1 }));

async function detail(id) {
  const s = await Settlement.findById(id).catch(() => null);
  if (!s) throw notFound('Không tìm thấy phiếu đối soát.');
  const brand = await Brand.findById(s.brandId).select('name');
  return { ...s.toJSON(), brandName: brand?.name ?? null };
}

// FR-SETTLE-07: chuyen khoan ngoai he thong roi danh dau da chi tra kem ma giao dich ngan hang
async function markPaid(id, bankTxnRef, actorUserId) {
  if (!bankTxnRef || !String(bankTxnRef).trim()) throw badRequest('Vui lòng nhập mã giao dịch ngân hàng.');
  const s = await Settlement.findOneAndUpdate(
    { _id: id, status: SettlementStatus.PENDING },
    { status: SettlementStatus.PAID, paidAt: new Date(), bankTxnRef: String(bankTxnRef).trim() },
    { new: true },
  ).catch(() => null);
  if (!s) throw badRequest('Phiếu đối soát không tồn tại hoặc đã được chi trả.');
  await AuditLog.create({ actorUserId, action: 'MARK_SETTLEMENT_PAID', entityType: 'Settlement', entityId: String(id), detail: { bankTxnRef } });
  return s;
}

module.exports = { setCommissionRate, getCommissionRateInfo, runSettlement, runPreviousMonth, findAll, findByBrand, detail, markPaid };
