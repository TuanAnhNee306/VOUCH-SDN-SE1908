const { Brand, Store, StaffAssignment, User, Session, Campaign, VoucherItem, AuditLog } = require('../models');
const { BrandStatus, CampaignStatus, Role, UserStatus, VoucherItemStatus } = require('../utils/enums');
const { badRequest, notFound } = require('../utils/errors');
const { foldVietnamese } = require('./rules');
const auth = require('./auth');

const BRAND_FIELDS = ['name', 'logo', 'description', 'categoryId', 'contactInfo', 'bankInfo'];
const STORE_FIELDS = ['name', 'address', 'latitude', 'longitude', 'phone', 'openingHours', 'status'];
const pickFrom = (fields, body) => Object.fromEntries(fields.filter((k) => body[k] !== undefined).map((k) => [k, body[k] === '' ? null : body[k]]));

// ---------- Ho so thuong hieu (FR-BRAND-01..03) ----------
async function createBrand(ownerUserId, body) {
  const data = pickFrom(BRAND_FIELDS, body);
  if (!data.name?.trim()) throw badRequest('Vui lòng nhập tên thương hiệu.');
  return Brand.create({ ...data, ownerUserId, status: BrandStatus.PENDING });
}

const findMyBrands = (ownerUserId) => Brand.find({ ownerUserId }).sort({ createdAt: 1 });

async function updateBrand(id, body) {
  const brand = await Brand.findById(id);
  if (!brand) throw notFound('Không tìm thấy thương hiệu.');
  const data = pickFrom(BRAND_FIELDS, body);
  if (data.name !== undefined && !String(data.name).trim()) throw badRequest('Tên thương hiệu không được trống.');
  Object.assign(brand, data);
  // Ho so bi tu choi sua lai thi gui duyet lai
  if (brand.status === BrandStatus.REJECTED) { brand.status = BrandStatus.PENDING; brand.rejectReason = null; }
  await brand.save();
  if (data.name) {
    const campaigns = await Campaign.find({ brandId: id });
    for (const c of campaigns) await Campaign.updateOne({ _id: c._id }, { searchText: foldVietnamese(`${c.title} ${brand.name}`) });
  }
  return brand;
}

async function findAll(status) {
  const brands = await Brand.find(status ? { status } : {}).sort({ createdAt: -1 });
  const owners = await User.find({ _id: { $in: brands.map((b) => b.ownerUserId) } }).select('email fullName');
  const map = new Map(owners.map((o) => [String(o._id), o]));
  return brands.map((b) => ({ ...b.toJSON(), owner: map.get(String(b.ownerUserId))?.toJSON() ?? null }));
}

async function setStatus(id, from, to, extra = {}) {
  const brand = await Brand.findOneAndUpdate({ _id: id, status: { $in: from } }, { status: to, ...extra }, { new: true }).catch(() => null);
  if (!brand) throw badRequest('Thương hiệu không ở trạng thái phù hợp cho thao tác này.');
  return brand;
}

const approve = (id) => setStatus(id, [BrandStatus.PENDING], BrandStatus.APPROVED, { approvedAt: new Date(), rejectReason: null });

function reject(id, reason) {
  if (!reason?.trim()) throw badRequest('Vui lòng nhập lý do từ chối.');
  return setStatus(id, [BrandStatus.PENDING], BrandStatus.REJECTED, { rejectReason: reason.trim() });
}

// FR-BRAND-09: dinh chi -> chien dich dang ban / da duyet chuyen PAUSED
async function suspend(id, reason, actorUserId) {
  if (!reason?.trim()) throw badRequest('Vui lòng nhập lý do đình chỉ.');
  const brand = await setStatus(id, [BrandStatus.APPROVED], BrandStatus.SUSPENDED, { rejectReason: reason.trim() });
  const paused = await Campaign.updateMany(
    { brandId: id, status: { $in: [CampaignStatus.PUBLISHED, CampaignStatus.SOLD_OUT, CampaignStatus.APPROVED] } },
    { status: CampaignStatus.PAUSED },
  );
  await AuditLog.create({ actorUserId, action: 'SUSPEND_BRAND', entityType: 'Brand', entityId: String(id), detail: { reason, pausedCampaigns: paused.modifiedCount } });
  return { ...brand.toJSON(), pausedCampaigns: paused.modifiedCount };
}

async function reinstate(id, actorUserId) {
  const brand = await setStatus(id, [BrandStatus.SUSPENDED], BrandStatus.APPROVED, { rejectReason: null });
  await AuditLog.create({ actorUserId, action: 'REINSTATE_BRAND', entityType: 'Brand', entityId: String(id) });
  return brand;
}

// ---------- Chi nhanh (FR-BRAND-04, DC-05, BR-24) ----------
function assertCoordinates(store) {
  if (store.status === false) return;
  const ok = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  if (!ok(store.latitude) || !ok(store.longitude)) throw badRequest('Chi nhánh đang hoạt động phải có vĩ độ và kinh độ (DC-05).');
}

async function createStore(brandId, body) {
  const data = pickFrom(STORE_FIELDS, body);
  if (!data.name?.trim() || !data.address?.trim()) throw badRequest('Vui lòng nhập tên và địa chỉ chi nhánh.');
  data.status = data.status !== false;
  assertCoordinates(data);
  return Store.create({ ...data, latitude: Number(data.latitude), longitude: Number(data.longitude), brandId });
}

const findStores = (brandId) => Store.find({ brandId }).sort({ name: 1 });

// BR-24: khong vo hieu chi nhanh ap dung cuoi cung con hoat dong cua chien dich ma khach con voucher dung duoc
async function assertCanDeactivate(store) {
  const campaigns = await Campaign.find({ storeIds: store._id });
  const blocked = [];
  for (const c of campaigns) {
    const usable = await VoucherItem.exists({ campaignId: c._id, status: VoucherItemStatus.ACTIVE, expireAt: { $gt: new Date() } });
    if (!usable) continue;
    const others = await Store.countDocuments({ _id: { $in: c.storeIds, $ne: store._id }, status: true });
    if (others === 0) blocked.push(`"${c.title}"`);
  }
  if (blocked.length) {
    throw badRequest(`Đây là chi nhánh áp dụng cuối cùng còn hoạt động của chiến dịch ${blocked.join(', ')} và khách vẫn còn voucher chưa dùng. Hãy thêm chi nhánh áp dụng khác cho chiến dịch đó rồi vô hiệu hóa lại (BR-24).`);
  }
}

async function updateStore(storeId, body) {
  const store = await Store.findById(storeId);
  if (!store) throw notFound('Không tìm thấy chi nhánh.');
  const data = pickFrom(STORE_FIELDS, body);
  const merged = { ...store.toObject(), ...data };
  assertCoordinates(merged);
  if (store.status && merged.status === false) await assertCanDeactivate(store);
  Object.assign(store, data);
  return store.save();
}

// ---------- Nhan vien (FR-BRAND-05/06, BR-19) ----------
async function assignStaff(brandId, { email, storeId, fullName }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw badRequest('Email không hợp lệ.');
  const store = await Store.findOne({ _id: storeId, brandId });
  if (!store) throw badRequest('Chi nhánh không thuộc thương hiệu của bạn.');
  let user = await User.findOne({ email: normalized });
  if (!user) user = await User.create({ email: normalized, fullName: fullName || undefined, role: Role.STORE_STAFF, status: UserStatus.PENDING_ACTIVATION });
  if (user.role !== Role.STORE_STAFF) throw badRequest('Email đã thuộc tài khoản có vai trò khác.');
  const existing = await StaffAssignment.find({ userId: user._id });
  const otherStores = await Store.find({ _id: { $in: existing.map((a) => a.storeId) } }).select('brandId');
  if (otherStores.some((s) => String(s.brandId) !== String(brandId))) throw badRequest('Nhân viên đã thuộc thương hiệu khác.');
  const duplicated = existing.find((a) => String(a.storeId) === String(storeId));
  if (duplicated?.active) throw badRequest('Nhân viên này đã được gán vào chi nhánh đó.');
  const assignment = duplicated ?? new StaffAssignment({ userId: user._id, storeId });
  assignment.active = true;
  assignment.assignedAt = new Date();
  await assignment.save();
  if (user.status === UserStatus.INACTIVE) {
    user.status = UserStatus.PENDING_ACTIVATION;
    await user.save();
  }
  let activation = null;
  if (user.status === UserStatus.PENDING_ACTIVATION) activation = await auth.sendActivation(user.email);
  return { assignment, activationLink: activation?.devLink ?? null };
}

async function findStaff(brandId) {
  const stores = await Store.find({ brandId });
  const assignments = await StaffAssignment.find({ storeId: { $in: stores.map((s) => s._id) } }).sort({ assignedAt: -1 });
  const users = await User.find({ _id: { $in: assignments.map((a) => a.userId) } });
  const uMap = new Map(users.map((u) => [String(u._id), u]));
  const sMap = new Map(stores.map((s) => [String(s._id), s]));
  return assignments.map((a) => {
    const u = uMap.get(String(a.userId));
    return {
      id: String(a._id), active: a.active, assignedAt: a.assignedAt, storeId: String(a.storeId), storeName: sMap.get(String(a.storeId))?.name,
      userId: String(a.userId), email: u?.email, fullName: u?.fullName, userStatus: u?.status,
    };
  });
}

// FR-BRAND-06: vo hieu tai khoan, thu hoi moi phien
async function deactivateStaff(assignmentId) {
  const assignment = await StaffAssignment.findById(assignmentId);
  if (!assignment) throw notFound('Không tìm thấy nhân viên.');
  await StaffAssignment.updateMany({ userId: assignment.userId }, { active: false });
  await User.updateOne({ _id: assignment.userId }, { status: UserStatus.INACTIVE });
  await Session.updateMany({ userId: assignment.userId, revokedAt: null }, { revokedAt: new Date() });
  return { message: 'Đã vô hiệu hóa nhân viên.' };
}

module.exports = {
  createBrand, findMyBrands, updateBrand, findAll, approve, reject, suspend, reinstate,
  createStore, findStores, updateStore, assignStaff, findStaff, deactivateStaff,
};
