const { Review, VoucherItem, Campaign, Brand, User, AuditLog } = require('../models');
const { ReviewStatus, VoucherItemStatus } = require('../utils/enums');
const { badRequest, business, notFound } = require('../utils/errors');
const { reviewerName } = require('./catalog');

const NOT_ELIGIBLE = 'Bạn cần sử dụng ít nhất một voucher của chiến dịch này trước khi đánh giá (BR-10).';

// BR-10: da dung it nhat 1 voucher; DC-09: moi khach 1 danh gia / chien dich
async function create(userId, { campaignId, voucherItemId, rating, comment }) {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw badRequest('Vui lòng chọn từ 1 đến 5 sao.');
  if (comment && String(comment).length > 1000) throw badRequest('Nhận xét tối đa 1000 ký tự.');
  let item;
  if (voucherItemId) {
    item = await VoucherItem.findById(voucherItemId).catch(() => null);
    if (!item || String(item.userId) !== String(userId)) throw notFound('Không tìm thấy voucher.');
    if (!['USED', 'COMPLETED'].includes(item.status)) throw business('REVIEW_NOT_ELIGIBLE', NOT_ELIGIBLE);
  } else {
    item = await VoucherItem.findOne({ userId, campaignId, status: { $in: ['USED', 'COMPLETED'] } }).sort({ usedAt: -1 }).catch(() => null);
    if (!item) throw business('REVIEW_NOT_ELIGIBLE', NOT_ELIGIBLE);
  }
  try {
    return await Review.create({ campaignId: item.campaignId, voucherItemId: item._id, userId, rating: r, comment: comment?.trim() || undefined });
  } catch (e) {
    if (e.code === 11000) throw business('REVIEW_EXISTS', 'Bạn đã đánh giá chiến dịch này.');
    throw e;
  }
}

async function toBrandView(reviews) {
  const [users, campaigns] = await Promise.all([
    User.find({ _id: { $in: reviews.map((r) => r.userId) } }).select('fullName email'),
    Campaign.find({ _id: { $in: reviews.map((r) => r.campaignId) } }).select('title brandId'),
  ]);
  const brands = await Brand.find({ _id: { $in: campaigns.map((c) => c.brandId) } }).select('name');
  const u = new Map(users.map((x) => [String(x._id), x]));
  const c = new Map(campaigns.map((x) => [String(x._id), x]));
  const b = new Map(brands.map((x) => [String(x._id), x]));
  return reviews.map((r) => {
    const camp = c.get(String(r.campaignId));
    return { ...r.toJSON(), reviewerName: reviewerName(u.get(String(r.userId))), campaignTitle: camp?.title ?? null, brandName: camp ? b.get(String(camp.brandId))?.name ?? null : null };
  });
}

async function listByBrand(brandId) {
  const campaigns = await Campaign.find({ brandId }).select('_id');
  return toBrandView(await Review.find({ campaignId: { $in: campaigns.map((x) => x._id) } }).sort({ createdAt: -1 }));
}

// FR-ENGAGE-04: thuong hieu phan hoi cong khai mot lan
async function reply(reviewId, brandId, text) {
  if (!text?.trim()) throw badRequest('Vui lòng nhập nội dung phản hồi.');
  const review = await Review.findById(reviewId).catch(() => null);
  const campaign = review && (await Campaign.findOne({ _id: review.campaignId, brandId }));
  if (!campaign) throw notFound('Không tìm thấy đánh giá.');
  const updated = await Review.findOneAndUpdate({ _id: reviewId, brandReply: null }, { brandReply: text.trim(), brandRepliedAt: new Date() }, { new: true });
  if (!updated) throw business('REVIEW_ALREADY_REPLIED', 'Đánh giá này đã được phản hồi.');
  return updated;
}

async function listAdmin(status) {
  return toBrandView(await Review.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200));
}

// FR-ENGAGE-05: quan tri vien an / hien danh gia vi pham
async function setStatus(reviewId, actorUserId, status, reason) {
  const review = await Review.findByIdAndUpdate(reviewId, { status }, { new: true }).catch(() => null);
  if (!review) throw notFound('Không tìm thấy đánh giá.');
  await AuditLog.create({ actorUserId, action: status === ReviewStatus.HIDDEN ? 'HIDE_REVIEW' : 'UNHIDE_REVIEW', entityType: 'Review', entityId: String(reviewId), detail: reason ? { reason } : null });
  return review;
}

module.exports = { create, listByBrand, reply, listAdmin, setStatus };
