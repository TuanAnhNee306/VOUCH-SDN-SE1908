const { Campaign, Brand, Store, Category, Review, User, Favorite } = require('../models');
const { CampaignStatus, BrandStatus, ReviewStatus } = require('../utils/enums');
const { badRequest, notFound } = require('../utils/errors');
const { int } = require('../config/env');
const { availableStock, discountPercent, foldVietnamese, distanceKm } = require('./rules');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Tran Gia Han" -> "Han T."
function reviewerName(user) {
  const words = user?.fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length >= 2) return `${words[words.length - 1]} ${words[0][0]}.`;
  if (words.length === 1) return words[0];
  const local = user?.email?.split('@')[0] ?? '';
  return local ? `${local.slice(0, 2)}***` : 'Khách hàng';
}

// Chien dich cong khai: dang ban hoac het hang, trong thoi gian ban (BR-08)
function publicFilter(now = new Date()) {
  return { status: { $in: [CampaignStatus.PUBLISHED, CampaignStatus.SOLD_OUT] }, saleStartAt: { $lte: now }, saleEndAt: { $gt: now } };
}

function present(c, brand) {
  const json = c.toJSON();
  delete json.rejectReason;
  delete json.approvedBy;
  delete json.searchText;
  delete json.purchaseCounts;
  const availableQuantity = Math.max(0, availableStock(c));
  return {
    ...json,
    brand: brand ? { id: String(brand._id), name: brand.name, logo: brand.logo ?? null } : null,
    availableQuantity,
    discountPercent: Math.round(discountPercent(c)),
    soldOut: c.status === CampaignStatus.SOLD_OUT || availableQuantity === 0,
    canPurchase: c.status === CampaignStatus.PUBLISHED && availableQuantity > 0,
  };
}

async function favoriteIdsOf(userId, campaigns) {
  if (!userId) return new Set();
  const favs = await Favorite.find({ userId, targetType: 'CAMPAIGN', targetId: { $in: campaigns.map((c) => c._id) } }).select('targetId');
  return new Set(favs.map((f) => String(f.targetId)));
}

async function brandsOf(campaigns) {
  const brands = await Brand.find({ _id: { $in: campaigns.map((c) => c.brandId) } }).select('name logo');
  return new Map(brands.map((b) => [String(b._id), b]));
}

const listCategories = () => Category.find().sort({ displayOrder: 1, name: 1 });

// FR-SEARCH-01..06: tu khoa khong dau, danh muc, gia, % giam, sap xep, gan toi (ban kinh)
async function search(q = {}, userId = null) {
  const num = (v) => (v === undefined || v === '' || v === null ? undefined : Number(v));
  const minPrice = num(q.minPrice); const maxPrice = num(q.maxPrice);
  const minDiscount = num(q.minDiscount); const maxDiscount = num(q.maxDiscount);
  const lat = num(q.lat); const lng = num(q.lng); const radiusKm = num(q.radiusKm);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice || minDiscount !== undefined && maxDiscount !== undefined && minDiscount > maxDiscount) {
    throw badRequest('Giá trị tối thiểu phải nhỏ hơn hoặc bằng giá trị tối đa.');
  }
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  if ((radiusKm !== undefined || q.sort === 'distance_asc') && !hasLocation) throw badRequest('Vui lòng cung cấp vị trí để tìm voucher gần bạn.');

  const filter = publicFilter();
  if (q.categoryId) filter.categoryId = q.categoryId;
  if (q.brandId) filter.brandId = q.brandId;
  if (q.keyword?.trim()) filter.searchText = { $regex: escapeRegex(foldVietnamese(q.keyword.trim())) };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.salePrice = {};
    if (minPrice !== undefined) filter.salePrice.$gte = minPrice;
    if (maxPrice !== undefined) filter.salePrice.$lte = maxPrice;
  }
  let campaigns = await Campaign.find(filter).sort({ createdAt: -1, _id: 1 });
  if (minDiscount !== undefined) campaigns = campaigns.filter((c) => discountPercent(c) >= minDiscount);
  if (maxDiscount !== undefined) campaigns = campaigns.filter((c) => discountPercent(c) <= maxDiscount);

  const [brands, favIds] = await Promise.all([brandsOf(campaigns), favoriteIdsOf(userId, campaigns)]);
  let items = campaigns.map((c) => ({ ...present(c, brands.get(String(c.brandId))), favorited: favIds.has(String(c._id)) }));

  if (hasLocation) {
    const stores = await Store.find({ _id: { $in: campaigns.flatMap((c) => c.storeIds) }, status: true });
    const storeById = new Map(stores.map((s) => [String(s._id), s]));
    items = items.map((item, i) => {
      const ds = campaigns[i].storeIds.map((id) => storeById.get(String(id))).filter((s) => s && s.latitude != null)
        .map((s) => distanceKm(lat, lng, s.latitude, s.longitude));
      return { ...item, distanceKm: ds.length ? Math.min(...ds) : null };
    });
    if (radiusKm !== undefined) items = items.filter((c) => c.distanceKm !== null && c.distanceKm <= radiusKm);
  }
  switch (q.sort) {
    case 'price_asc': items.sort((a, b) => a.salePrice - b.salePrice); break;
    case 'price_desc': items.sort((a, b) => b.salePrice - a.salePrice); break;
    case 'discount_desc': items.sort((a, b) => b.discountPercent - a.discountPercent); break;
    case 'best_seller': items.sort((a, b) => b.soldQuantity - a.soldQuantity); break;
    case 'distance_asc': items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)); break;
    default: break;
  }
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 50));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

async function reviewSummary(campaignIds) {
  const rows = await Review.aggregate([
    { $match: { campaignId: { $in: campaignIds }, status: ReviewStatus.VISIBLE } },
    { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$rating' } } },
  ]);
  return { reviewCount: rows[0]?.count ?? 0, averageRating: rows[0] ? Math.round(rows[0].avg * 10) / 10 : null };
}

async function detail(id, { lat, lng } = {}, userId = null) {
  const campaign = await Campaign.findOne({ _id: id, ...publicFilter() }).catch(() => null);
  if (!campaign) throw notFound('Không tìm thấy voucher đang công khai.');
  const brand = await Brand.findById(campaign.brandId);
  const la = Number(lat); const ln = Number(lng);
  const stores = (await Store.find({ _id: { $in: campaign.storeIds }, status: true })).map((s) => ({
    id: String(s._id), name: s.name, address: s.address, latitude: s.latitude, longitude: s.longitude, openingHours: s.openingHours, phone: s.phone,
    distanceKm: Number.isFinite(la) && Number.isFinite(ln) && s.latitude != null ? distanceKm(la, ln, s.latitude, s.longitude) : null,
  })).sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  const reviews = await Review.find({ campaignId: campaign._id, status: ReviewStatus.VISIBLE }).sort({ createdAt: -1 }).limit(20);
  const users = await User.find({ _id: { $in: reviews.map((r) => r.userId) } }).select('fullName email');
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const favorited = userId ? !!(await Favorite.exists({ userId, targetType: 'CAMPAIGN', targetId: campaign._id })) : false;
  return {
    ...present(campaign, brand),
    stores,
    favorited,
    refundPolicy: {
      windowDays: int('REFUND_WINDOW_DAYS', 7), minDaysBeforeExpiry: int('REFUND_MIN_DAYS_BEFORE_EXPIRE', 3),
      description: 'Voucher chưa sử dụng được yêu cầu hoàn trước mốc sớm hơn giữa 7 ngày kể từ thanh toán và 3 ngày trước hạn sử dụng.',
    },
    ...(await reviewSummary([campaign._id])),
    reviews: reviews.map((r) => ({
      id: String(r._id), rating: r.rating, comment: r.comment, brandReply: r.brandReply, brandRepliedAt: r.brandRepliedAt,
      createdAt: r.createdAt, reviewerName: reviewerName(userById.get(String(r.userId))),
    })),
  };
}

// Trang thuong hieu cong khai
async function brandProfile(id, userId = null) {
  const brand = await Brand.findOne({ _id: id, status: BrandStatus.APPROVED }).catch(() => null);
  if (!brand) throw notFound('Không tìm thấy thương hiệu.');
  const [stores, campaigns, followerCount] = await Promise.all([
    Store.find({ brandId: id, status: true }).sort({ name: 1 }),
    Campaign.find({ brandId: id, ...publicFilter() }).sort({ createdAt: -1 }),
    Favorite.countDocuments({ targetType: 'BRAND', targetId: id }),
  ]);
  const following = userId ? !!(await Favorite.exists({ userId, targetType: 'BRAND', targetId: id })) : false;
  const favIds = await favoriteIdsOf(userId, campaigns);
  return {
    id: String(brand._id), name: brand.name, logo: brand.logo, description: brand.description, contactInfo: brand.contactInfo,
    stores: stores.map((s) => s.toJSON()),
    campaigns: campaigns.map((c) => ({ ...present(c, brand), favorited: favIds.has(String(c._id)) })),
    followerCount, following,
    ...(await reviewSummary(campaigns.map((c) => c._id))),
  };
}

// Chi nhanh cua cac chien dich dang ban (ban do chi nhanh)
async function mapStores() {
  const campaigns = await Campaign.find(publicFilter()).select('storeIds brandId title');
  const stores = await Store.find({ _id: { $in: campaigns.flatMap((c) => c.storeIds) }, status: true, latitude: { $ne: null } });
  const brands = await Brand.find({ _id: { $in: stores.map((s) => s.brandId) } }).select('name');
  const brandName = new Map(brands.map((b) => [String(b._id), b.name]));
  return stores.map((s) => ({
    ...s.toJSON(),
    brandName: brandName.get(String(s.brandId)) ?? null,
    campaigns: campaigns.filter((c) => c.storeIds.some((x) => String(x) === String(s._id))).map((c) => ({ id: String(c._id), title: c.title })),
  }));
}

module.exports = { listCategories, search, detail, brandProfile, mapStores, reviewerName, present };
