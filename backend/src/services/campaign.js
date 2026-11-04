const { Campaign, Brand, Store, VoucherItem } = require('../models');
const { CampaignStatus, BrandStatus, VoucherType, DiscountType } = require('../utils/enums');
const { badRequest, notFound } = require('../utils/errors');
const { validateValueFields, validateTimeline, foldVietnamese, availableStock, discountMaxValue } = require('./rules');
const notifications = require('./notification');

const AVAILABLE = { $subtract: [{ $subtract: ['$totalQuantity', '$soldQuantity'] }, '$reservedQuantity'] };

// Sua chien dich o cac trang thai nay dua no ve PENDING cho duyet lai (FR-CAMP-15)
const NEEDS_REAPPROVAL = [CampaignStatus.APPROVED, CampaignStatus.PUBLISHED, CampaignStatus.SOLD_OUT, CampaignStatus.PAUSED];
// BR-17: da ban >= 1 voucher thi khoa cac truong nay
const LOCKED_WHEN_SOLD = ['salePrice', 'faceValue', 'voucherExpireAt', 'voucherType', 'discountType', 'discountValue', 'maxDiscount'];
const EDITABLE = ['title', 'image', 'description', 'terms', 'categoryId', 'voucherType', 'salePrice', 'faceValue', 'discountType',
  'discountValue', 'maxDiscount', 'comboItems', 'totalQuantity', 'limitPerUser', 'saleStartAt', 'saleEndAt', 'voucherExpireAt', 'storeIds'];

function pick(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  for (const k of ['salePrice', 'faceValue', 'discountValue', 'maxDiscount', 'totalQuantity', 'limitPerUser']) {
    if (out[k] !== undefined && out[k] !== null && out[k] !== '') out[k] = Number(out[k]);
    if (out[k] === '') out[k] = null;
  }
  for (const k of ['saleStartAt', 'saleEndAt', 'voucherExpireAt']) if (out[k]) out[k] = new Date(out[k]);
  if (out.categoryId === '') out.categoryId = null;
  if (out.discountType === '') out.discountType = null;
  return out;
}

async function assertStores(brandId, storeIds) {
  if (!Array.isArray(storeIds) || storeIds.length === 0) throw badRequest('Chọn ít nhất một chi nhánh áp dụng (DC-07).');
  const count = await Store.countDocuments({ _id: { $in: storeIds }, brandId });
  if (count !== new Set(storeIds.map(String)).size) throw badRequest('Chi nhánh áp dụng phải thuộc thương hiệu của bạn.');
}

// Loai DISCOUNT: gia tri voucher = so tien giam / muc giam toi da (khong nhap tay); loai khac: bo cac truong giam gia
function normalizeValueFields(data, merged = data) {
  if (merged.voucherType !== VoucherType.DISCOUNT) {
    Object.assign(data, { discountType: null, discountValue: null, maxDiscount: null });
    return;
  }
  if (merged.discountType === DiscountType.AMOUNT) data.maxDiscount = null;
  data.faceValue = discountMaxValue({ ...merged, ...data });
}

// Ngay ket thuc ban da qua thi chien dich khong bao gio ban duoc
function assertSaleNotOver(c) {
  if (new Date(c.saleEndAt).getTime() <= Date.now()) {
    throw badRequest('Ngày kết thúc bán đã qua nên chiến dịch không thể bán được. Hãy chọn ngày kết thúc bán trong tương lai.');
  }
}

async function searchTextFor(title, brandId) {
  const brand = await Brand.findById(brandId).select('name');
  return foldVietnamese(`${title} ${brand?.name ?? ''}`);
}

// FR-CAMP-01..05: tao chien dich DRAFT
async function create(brandId, body) {
  const data = pick(body);
  if (!data.title?.trim()) throw badRequest('Vui lòng nhập tiêu đề chiến dịch.');
  data.limitPerUser = data.limitPerUser || 5;
  normalizeValueFields(data);
  validateValueFields(data);
  validateTimeline(data);
  assertSaleNotOver(data);
  await assertStores(brandId, data.storeIds);
  return Campaign.create({
    ...data, brandId, status: CampaignStatus.DRAFT,
    searchText: await searchTextFor(data.title, brandId),
  });
}

async function findOrFail(id) {
  const c = await Campaign.findById(id).catch(() => null);
  if (!c) throw notFound('Không tìm thấy chiến dịch.');
  return c;
}

async function update(id, body) {
  const campaign = await findOrFail(id);
  if (campaign.status === CampaignStatus.PENDING) {
    throw badRequest('Chiến dịch đang chờ duyệt không sửa được. Hãy rút về nháp rồi sửa lại (FR-CAMP-14).');
  }
  if (campaign.status === CampaignStatus.ENDED) throw badRequest('Chiến dịch đã kết thúc, không thể sửa.');
  const data = pick(body);
  // Tinh lai gia tri cua ma giam gia chi khi co sua cac truong gia tri (truoc buoc khoa BR-17 de khoa bat duoc thay doi)
  if (['voucherType', 'discountType', 'discountValue', 'maxDiscount', 'faceValue'].some((k) => data[k] !== undefined)) {
    normalizeValueFields(data, { ...campaign.toObject(), ...data });
  }
  if (campaign.soldQuantity > 0) {
    for (const f of LOCKED_WHEN_SOLD) {
      if (data[f] === undefined) continue;
      const before = campaign[f] instanceof Date ? campaign[f].getTime() : campaign[f];
      const after = data[f] instanceof Date ? data[f].getTime() : data[f];
      if (String(before ?? '') !== String(after ?? '')) {
        throw badRequest('Không thể sửa giá bán, giá trị, loại voucher hoặc hạn sử dụng của chiến dịch đã bán được voucher (BR-17).');
      }
    }
  }
  // Chua ban duoc nhung dang co don giu cho cung khong duoc ha xuong duoi (DC-03)
  if (data.totalQuantity !== undefined && data.totalQuantity < campaign.soldQuantity + campaign.reservedQuantity) {
    throw badRequest('Số lượng phát hành không được nhỏ hơn số đã bán và đang giữ chỗ.');
  }
  const merged = { ...campaign.toObject(), ...data };
  validateValueFields(merged);
  validateTimeline(merged);
  assertSaleNotOver(merged);
  if (data.storeIds) await assertStores(campaign.brandId, data.storeIds);
  Object.assign(campaign, data);
  campaign.searchText = await searchTextFor(campaign.title, campaign.brandId);
  if (NEEDS_REAPPROVAL.includes(campaign.status)) {
    campaign.status = CampaignStatus.PENDING;
    campaign.submittedAt = new Date();
  }
  return campaign.save();
}

// FR-CAMP-06, BR-26: gui duyet
async function submit(id) {
  const campaign = await findOrFail(id);
  if (campaign.status !== CampaignStatus.DRAFT) throw badRequest('Chỉ có thể gửi duyệt chiến dịch ở trạng thái nháp.');
  const brand = await Brand.findById(campaign.brandId);
  if (brand?.status !== BrandStatus.APPROVED) {
    throw badRequest('Thương hiệu chưa được duyệt hoặc đang bị đình chỉ nên không thể gửi duyệt chiến dịch (BR-26).');
  }
  validateValueFields(campaign);
  validateTimeline(campaign);
  assertSaleNotOver(campaign);
  campaign.status = CampaignStatus.PENDING;
  campaign.submittedAt = new Date();
  campaign.rejectReason = null;
  return campaign.save();
}

async function withdraw(id) {
  const campaign = await findOrFail(id);
  if (campaign.status !== CampaignStatus.PENDING) throw badRequest('Chỉ có thể rút về nháp chiến dịch đang chờ duyệt.');
  campaign.status = CampaignStatus.DRAFT;
  campaign.submittedAt = null;
  return campaign.save();
}

// UC-04: quan tri vien duyet -> ra soat ngay de phat hanh neu da toi ngay ban
async function approve(id, adminUserId) {
  const campaign = await findOrFail(id);
  if (campaign.status !== CampaignStatus.PENDING) throw badRequest('Chỉ có thể duyệt chiến dịch đang chờ duyệt.');
  // Thuong hieu bi dinh chi sau khi gui duyet: khong duoc phat hanh (BR-26)
  const brand = await Brand.findById(campaign.brandId).select('status');
  if (brand?.status !== BrandStatus.APPROVED) throw badRequest('Thương hiệu chưa được duyệt hoặc đang bị đình chỉ nên không thể duyệt chiến dịch (BR-26).');
  if (campaign.saleEndAt.getTime() <= Date.now()) throw badRequest('Chiến dịch đã quá ngày kết thúc bán. Hãy từ chối để thương hiệu sửa lại thời gian.');
  validateValueFields(campaign);
  validateTimeline(campaign);
  campaign.status = CampaignStatus.APPROVED;
  campaign.approvedBy = adminUserId;
  campaign.approvedAt = new Date();
  campaign.rejectReason = null;
  await campaign.save();
  await runStatusTransitions(new Date(), campaign._id);
  return findOrFail(id);
}

// Tu choi kem ly do: chien dich ve Nhap de thuong hieu sua
async function reject(id, reason) {
  if (!reason || !String(reason).trim()) throw badRequest('Vui lòng nhập lý do từ chối.');
  const campaign = await findOrFail(id);
  if (campaign.status !== CampaignStatus.PENDING) throw badRequest('Chỉ có thể từ chối chiến dịch đang chờ duyệt.');
  campaign.status = CampaignStatus.DRAFT;
  campaign.rejectReason = String(reason).trim();
  campaign.submittedAt = null;
  return campaign.save();
}

// FR-CAMP-08: tam dung thi khong tao don moi
async function pause(id) {
  const campaign = await findOrFail(id);
  if (![CampaignStatus.PUBLISHED, CampaignStatus.SOLD_OUT].includes(campaign.status)) throw badRequest('Chỉ có thể tạm dừng chiến dịch đang bán.');
  campaign.status = CampaignStatus.PAUSED;
  return campaign.save();
}

async function resume(id) {
  const campaign = await findOrFail(id);
  if (campaign.status !== CampaignStatus.PAUSED) throw badRequest('Chỉ có thể mở lại chiến dịch đang tạm dừng.');
  const brand = await Brand.findById(campaign.brandId);
  if (brand?.status === BrandStatus.SUSPENDED) throw badRequest('Thương hiệu đang bị đình chỉ, không thể mở bán lại chiến dịch.');
  if (campaign.saleEndAt <= new Date()) {
    campaign.status = CampaignStatus.ENDED;
  } else {
    campaign.status = availableStock(campaign) > 0 ? CampaignStatus.PUBLISHED : CampaignStatus.SOLD_OUT;
  }
  return campaign.save();
}

// FR-CAMP-10 / BR-08: tac vu 5 phut mot luot, chi doi cot status
async function runStatusTransitions(now = new Date(), campaignId) {
  const scope = campaignId ? { _id: campaignId } : {};
  const toPublish = await Campaign.find({ ...scope, status: CampaignStatus.APPROVED, saleStartAt: { $lte: now }, saleEndAt: { $gt: now } }).select('_id');

  // 1. APPROVED -> PUBLISHED khi toi ngay ban
  const published = await Campaign.updateMany(
    { ...scope, status: CampaignStatus.APPROVED, saleStartAt: { $lte: now }, saleEndAt: { $gt: now } },
    { status: CampaignStatus.PUBLISHED },
  );
  // 2. Het ton kho kha dung -> SOLD_OUT
  const soldOut = await Campaign.updateMany(
    { ...scope, status: CampaignStatus.PUBLISHED, saleEndAt: { $gt: now }, $expr: { $lte: [AVAILABLE, 0] } },
    { status: CampaignStatus.SOLD_OUT },
  );
  // 3. Co hang lai (nha giu cho / hoan tien) -> PUBLISHED
  const restocked = await Campaign.updateMany(
    { ...scope, status: CampaignStatus.SOLD_OUT, saleEndAt: { $gt: now }, $expr: { $gt: [AVAILABLE, 0] } },
    { status: CampaignStatus.PUBLISHED },
  );
  // 4. Het thoi gian ban -> ENDED
  const ended = await Campaign.updateMany(
    { ...scope, status: { $in: [CampaignStatus.APPROVED, CampaignStatus.PUBLISHED, CampaignStatus.PAUSED, CampaignStatus.SOLD_OUT] }, saleEndAt: { $lte: now } },
    { status: CampaignStatus.ENDED },
  );

  if (toPublish.length) {
    const campaigns = await Campaign.find({ _id: { $in: toPublish.map((c) => c._id) }, status: CampaignStatus.PUBLISHED });
    for (const c of campaigns) {
      const brand = await Brand.findById(c.brandId).select('name');
      await notifications.campaignPublished(c, brand?.name ?? 'Thương hiệu bạn theo dõi').catch(() => {});
    }
  }
  return { published: published.modifiedCount, soldOut: soldOut.modifiedCount, restocked: restocked.modifiedCount, ended: ended.modifiedCount };
}

async function withBrandAndStores(list) {
  const brandIds = [...new Set(list.map((c) => String(c.brandId)))];
  const storeIds = [...new Set(list.flatMap((c) => c.storeIds.map(String)))];
  const [brands, stores] = await Promise.all([Brand.find({ _id: { $in: brandIds } }).select('name logo'), Store.find({ _id: { $in: storeIds } }).select('name address')]);
  const b = new Map(brands.map((x) => [String(x._id), x.toJSON()]));
  const s = new Map(stores.map((x) => [String(x._id), x.toJSON()]));
  return list.map((c) => ({
    ...c.toJSON(),
    availableQuantity: Math.max(0, availableStock(c)),
    brand: b.get(String(c.brandId)) ?? null,
    stores: c.storeIds.map((id) => s.get(String(id))).filter(Boolean),
  }));
}

async function findByBrand(brandId) {
  return withBrandAndStores(await Campaign.find({ brandId }).sort({ createdAt: -1 }));
}

async function findPending() {
  return withBrandAndStores(await Campaign.find({ status: CampaignStatus.PENDING }).sort({ submittedAt: 1 }));
}

async function findAllAdmin(status) {
  return withBrandAndStores(await Campaign.find(status ? { status } : {}).sort({ createdAt: -1 }));
}

module.exports = { create, update, submit, withdraw, approve, reject, pause, resume, runStatusTransitions, findOrFail, findByBrand, findPending, findAllAdmin, withBrandAndStores };
