const { VoucherItem, Campaign, Brand, Store, RedemptionLog, RefundRequest, Review, PaymentRefund } = require('../models');
const { VoucherItemStatus } = require('../utils/enums');
const { customerView } = require('./cashback');
const { notFound } = require('../utils/errors');
const { walletPlacement, refundEligibility, OPEN_REFUND_STATUSES } = require('./rules');

// Vi voucher (FR-REDEEM-01): 4 tab, kem dieu kien hoan tien va danh gia de app khoa / hien nut dung luc
function toView(item, campaign, brand, now, hasOpenRefund, hasReviewed) {
  if (campaign && item.benefitSnapshot) campaign = { ...campaign.toObject(), ...item.benefitSnapshot };
  const placement = walletPlacement(item, now);
  const json = item.toJSON();
  delete json.cashbackHistory;
  delete json.cashbackClaim;
  return {
    ...json,
    cashback: customerView(item, now),
    cashbackClaim: item.cashbackClaim ? { cashbackAmount: item.cashbackClaim.cashbackAmount } : null,
    ...placement,
    canRedeem: placement.tab === 'ACTIVE' && placement.displayStatus === VoucherItemStatus.ACTIVE,
    refund: refundEligibility(item, hasOpenRefund, now),
    review: { hasReviewed, canReview: ['USED', 'COMPLETED'].includes(item.status) && !hasReviewed },
    campaign: campaign ? {
      id: String(campaign._id), title: campaign.title, image: campaign.image, voucherType: campaign.voucherType,
      faceValue: campaign.faceValue, salePrice: campaign.salePrice, terms: campaign.terms, description: campaign.description,
      cashbackType: campaign.cashbackType, cashbackValue: campaign.cashbackValue, maxCashbackAmount: campaign.maxCashbackAmount,
      minOrderValue: campaign.minOrderValue, refundMethod: campaign.refundMethod,
      comboItems: campaign.comboItems, discountType: campaign.discountType, discountValue: campaign.discountValue, maxDiscount: campaign.maxDiscount,
      brand: brand ? { id: String(brand._id), name: brand.name, logo: brand.logo ?? null } : null,
    } : null,
  };
}

async function list(userId, tab) {
  const items = await VoucherItem.find({ userId }).sort({ issuedAt: -1 });
  const campaigns = await Campaign.find({ _id: { $in: items.map((i) => i.campaignId) } });
  const brands = await Brand.find({ _id: { $in: campaigns.map((c) => c.brandId) } }).select('name logo');
  const [openRefunds, reviews] = await Promise.all([
    RefundRequest.find({ userId, status: { $in: OPEN_REFUND_STATUSES } }).select('voucherItemId'),
    Review.find({ userId }).select('campaignId'),
  ]);
  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));
  const bMap = new Map(brands.map((b) => [String(b._id), b]));
  const open = new Set(openRefunds.map((r) => String(r.voucherItemId)));
  const reviewed = new Set(reviews.map((r) => String(r.campaignId)));
  const now = new Date();
  const views = items.map((i) => {
    const c = cMap.get(String(i.campaignId));
    return toView(i, c, c && bMap.get(String(c.brandId)), now, open.has(String(i._id)), reviewed.has(String(i.campaignId)));
  });
  return tab ? views.filter((v) => v.tab === tab) : views;
}

async function detail(userId, id) {
  const item = await VoucherItem.findById(id).catch(() => null);
  // Voucher cua nguoi khac tra 404 nhu khong ton tai
  if (!item || String(item.userId) !== String(userId)) throw notFound('Không tìm thấy voucher.');
  const campaign = await Campaign.findById(item.campaignId);
  const [brand, stores, redemption, refunds, review] = await Promise.all([
    Brand.findById(campaign.brandId).select('name logo'),
    Store.find({ _id: { $in: campaign.storeIds }, status: true }),
    RedemptionLog.findOne({ voucherItemId: item._id }),
    RefundRequest.find({ voucherItemId: item._id }).sort({ createdAt: -1 }),
    Review.findOne({ userId, campaignId: item.campaignId }),
  ]);
  const redeemStore = redemption ? await Store.findById(redemption.storeId).select('name address') : null;
  const prs = await PaymentRefund.find({ _id: { $in: refunds.map((r) => r.paymentRefundId).filter(Boolean) } });
  const prMap = new Map(prs.map((p) => [String(p._id), p]));
  const hasOpen = refunds.some((r) => OPEN_REFUND_STATUSES.includes(r.status));
  return {
    ...toView(item, campaign, brand, new Date(), hasOpen, !!review),
    stores: stores.map((s) => s.toJSON()),
    redemption: redemption ? {
      cashbackAmount: redemption.cashbackAmount,
      redeemedAt: redemption.redeemedAt, storeId: String(redemption.storeId), storeName: redeemStore?.name ?? null,
      storeAddress: redeemStore?.address ?? null, method: redemption.method, billAmount: redemption.billAmount,
    } : null,
    refundRequests: refunds.map((r) => ({
      id: String(r._id), status: r.status, reason: r.reason ?? null, rejectReason: r.rejectReason ?? null,
      createdAt: r.createdAt, decidedAt: r.decidedAt, gatewayRefundId: prMap.get(String(r.paymentRefundId))?.gatewayRefundId ?? null,
    })),
    reviewId: review ? String(review._id) : null,
  };
}

module.exports = { list, detail };
