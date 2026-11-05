const mongoose = require('mongoose');
const E = require('../utils/enums');

const { Schema } = mongoose;
const Id = Schema.Types.ObjectId;
const values = (o) => Object.values(o);

// JSON tra ve client: id thay cho _id, bo __v
function schema(def, opts = {}) {
  const s = new Schema(def, { timestamps: true, ...opts });
  s.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  });
  return s;
}

const User = schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  fullName: String,
  phone: String,
  avatar: String,
  role: { type: String, enum: values(E.Role), default: E.Role.CUSTOMER },
  status: { type: String, enum: values(E.UserStatus), default: E.UserStatus.ACTIVE },
});
User.set('toJSON', { ...User.get('toJSON'), transform: (_d, ret) => { ret.id = String(ret._id); delete ret._id; delete ret.passwordHash; return ret; } });

const OtpCode = schema({
  email: { type: String, required: true, index: true },
  purpose: { type: String, enum: values(E.OtpPurpose), required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

// Dedicated single active login challenge per normalized email. No migration of
// historical activation/reset codes or production users is required.
const LoginOtp = schema({
  _id: String,
  userId: { type: Id, ref: 'User', default: null },
  nonce: { type: String, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  nextRequestAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});
LoginOtp.index({ expiresAt: 1 }, { expireAfterSeconds: 7200 });

const AuthLimit = schema({
  _id: String,
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});
AuthLimit.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Phien dang nhap (refresh token). activeStoreId: chi nhanh nhan vien dang lam trong phien (FR-AUTH-12)
const Session = schema({
  userId: { type: Id, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true },
  deviceId: String,
  activeStoreId: { type: Id, ref: 'Store', default: null },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
});

const Category = schema({
  name: { type: String, required: true },
  icon: String,
  displayOrder: { type: Number, default: 0 },
});

const Brand = schema({
  ownerUserId: { type: Id, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  logo: String,
  description: String,
  categoryId: { type: Id, ref: 'Category', default: null },
  contactInfo: String,
  bankInfo: String,
  status: { type: String, enum: values(E.BrandStatus), default: E.BrandStatus.PENDING },
  rejectReason: { type: String, default: null },
  approvedAt: Date,
});

const Store = schema({
  brandId: { type: Id, ref: 'Brand', required: true, index: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  latitude: Number,
  longitude: Number,
  phone: String,
  openingHours: String,
  status: { type: Boolean, default: true },
});

const StaffAssignment = schema({
  userId: { type: Id, ref: 'User', required: true, index: true },
  storeId: { type: Id, ref: 'Store', required: true },
  active: { type: Boolean, default: true },
  assignedAt: { type: Date, default: Date.now },
});
StaffAssignment.index({ userId: 1, storeId: 1 }, { unique: true });

const Campaign = schema({
  brandId: { type: Id, ref: 'Brand', required: true, index: true },
  categoryId: { type: Id, ref: 'Category', default: null },
  title: { type: String, required: true },
  image: String,
  description: String,
  terms: String,
  voucherType: { type: String, enum: values(E.VoucherType), required: true },
  salePrice: { type: Number, required: true },
  faceValue: { type: Number, default: null },
  cashbackType: { type: String, enum: ['PERCENTAGE', 'FIXED_AMOUNT', null], default: null },
  cashbackValue: { type: Number, default: null },
  maxCashbackAmount: { type: Number, default: null },
  minOrderValue: { type: Number, default: null },
  refundMethod: { type: String, default: null },
  discountType: { type: String, enum: [...values(E.DiscountType), null], default: null },
  discountValue: { type: Number, default: null },
  maxDiscount: { type: Number, default: null },
  comboItems: { type: String, default: null },
  totalQuantity: { type: Number, required: true },
  soldQuantity: { type: Number, default: 0 },
  // giu cho tam thoi khi tao don (TTL 15 phut) - DC-03: sold + reserved <= total
  reservedQuantity: { type: Number, default: 0 },
  purchaseCounts: { type: Map, of: Number, default: {} },
  limitPerUser: { type: Number, default: 5 },
  saleStartAt: { type: Date, required: true },
  saleEndAt: { type: Date, required: true },
  voucherExpireAt: { type: Date, required: true },
  status: { type: String, enum: values(E.CampaignStatus), default: E.CampaignStatus.DRAFT, index: true },
  rejectReason: { type: String, default: null },
  submittedAt: { type: Date, default: null },
  approvedBy: { type: Id, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  // DC-07: chi nhanh ap dung
  storeIds: [{ type: Id, ref: 'Store' }],
  // tieu de + ten thuong hieu bo dau, de tim khong dau (FR-SEARCH-01)
  searchText: { type: String, default: '' },
});

Campaign.set('optimisticConcurrency', true);

const Order = schema({
  benefitSnapshot: Schema.Types.Mixed,
  userId: { type: Id, ref: 'User', required: true, index: true },
  campaignId: { type: Id, ref: 'Campaign', required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  // ty le hoa hong chot vao don luc thanh toan - BR-09
  commissionRate: { type: Number, default: null },
  refundedAmount: { type: Number, default: 0 },
  status: { type: String, enum: values(E.OrderStatus), default: E.OrderStatus.PENDING, index: true },
  paymentOrderCode: { type: String, unique: true, sparse: true },
  paymentUrl: { type: String, default: null },
  reservedUntil: { type: Date, required: true },
  paidAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
});

const Payment = schema({
  orderId: { type: Id, ref: 'Order', required: true, index: true },
  gateway: String,
  // DC-04: webhook gui trung chi xu ly mot lan
  gatewayTxnId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: values(E.PaymentStatus), required: true },
  rawPayload: Schema.Types.Mixed,
});

const PaymentRefund = schema({
  paymentId: { type: Id, ref: 'Payment', required: true, index: true },
  orderId: { type: Id, ref: 'Order' },
  amount: { type: Number, required: true },
  reasonType: { type: String, enum: values(E.PaymentRefundReason) },
  mode: { type: String, enum: values(E.PaymentRefundMode) },
  status: { type: String, enum: values(E.PaymentRefundStatus) },
  gatewayRefundId: String,
  processedBy: { type: Id, ref: 'User', default: null },
  completedAt: Date,
});

const VoucherItem = schema({
  cashbackHistory: { type: [Schema.Types.Mixed], default: [] },
  cashbackClaim: { type: Schema.Types.Mixed, default: null },
  benefitSnapshot: Schema.Types.Mixed,
  orderId: { type: Id, ref: 'Order', required: true, index: true },
  campaignId: { type: Id, ref: 'Campaign', required: true, index: true },
  brandId: { type: Id, ref: 'Brand', required: true, index: true },
  userId: { type: Id, ref: 'User', required: true, index: true },
  // DC-01: duy nhat; chi de tra cuu, KHONG dung de xac nhan su dung (BR-16)
  code: { type: String, required: true, unique: true },
  status: { type: String, enum: values(E.VoucherItemStatus), default: E.VoucherItemStatus.ACTIVE },
  unitPrice: { type: Number, required: true },
  issuedAt: { type: Date, default: Date.now },
  usedAt: { type: Date, default: null },
  expireAt: { type: Date, required: true },
  // BR-05: min(ngay thanh toan + 7 ngay, han su dung - 3 ngay)
  refundableUntil: { type: Date, required: true },
  // DC-06: voucher thuoc toi da mot phieu doi soat
  settlementId: { type: Id, ref: 'Settlement', default: null },
});

// Durable invoice claim and voucher status change share one atomic write.
VoucherItem.index({ 'cashbackClaim.billKey': 1 }, { unique: true, partialFilterExpression: { 'cashbackClaim.billKey': { $type: 'string' } } });

VoucherItem.index({ 'cashbackClaim.paymentReferenceKeys': 1 }, { unique: true, partialFilterExpression: { 'cashbackClaim.paymentReferenceKeys': { $type: 'string' } } });

const RedeemToken = schema({
  voucherItemId: { type: Id, ref: 'VoucherItem', required: true, index: true },
  userId: { type: Id, ref: 'User', required: true },
  nonce: { type: String, required: true, unique: true },
  otpCode: { type: String, required: true, index: true },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
});

const RedemptionLog = schema({
  voucherItemId: { type: Id, ref: 'VoucherItem', required: true, unique: true },
  storeId: { type: Id, ref: 'Store', required: true, index: true },
  staffUserId: { type: Id, ref: 'User', required: true, index: true },
  billAmount: { type: Number, default: null },
  cashbackAmount: { type: Number, default: null },
  discountAmount: { type: Number, default: null },
  cashbackBillKey: String,
  billUpdatedAt: { type: Date, default: null },
  method: { type: String, enum: values(E.RedeemMethod) },
  redeemedAt: { type: Date, default: Date.now },
});

RedemptionLog.index({ cashbackBillKey: 1 }, { unique: true, partialFilterExpression: { cashbackBillKey: { $type: 'string' } } });

const RefundRequest = schema({
  voucherItemId: { type: Id, ref: 'VoucherItem', required: true, index: true },
  userId: { type: Id, ref: 'User', required: true, index: true },
  reason: String,
  status: { type: String, enum: values(E.RefundRequestStatus), required: true },
  rejectReason: { type: String, default: null },
  decidedAt: { type: Date, default: null },
  paymentRefundId: { type: Id, ref: 'PaymentRefund', default: null },
  amount: Number,
});

const Settlement = schema({
  brandId: { type: Id, ref: 'Brand', required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  voucherCount: Number,
  grossRevenue: Number,
  commissionAmount: Number,
  payableAmount: Number,
  status: { type: String, enum: values(E.SettlementStatus), default: E.SettlementStatus.PENDING },
  paidAt: { type: Date, default: null },
  bankTxnRef: { type: String, default: null },
  items: [{
    _id: false,
    voucherItemId: { type: Id, ref: 'VoucherItem' },
    orderId: { type: Id, ref: 'Order' },
    code: String,
    amount: Number,
    commissionRate: Number,
    commissionAmount: Number,
  }],
});

const Review = schema({
  campaignId: { type: Id, ref: 'Campaign', required: true, index: true },
  voucherItemId: { type: Id, ref: 'VoucherItem' },
  userId: { type: Id, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  status: { type: String, enum: values(E.ReviewStatus), default: E.ReviewStatus.VISIBLE },
  brandReply: { type: String, default: null },
  brandRepliedAt: { type: Date, default: null },
});
// DC-09: moi khach mot danh gia / chien dich
Review.index({ userId: 1, campaignId: 1 }, { unique: true });

const Favorite = schema({
  userId: { type: Id, ref: 'User', required: true },
  targetType: { type: String, enum: values(E.FavoriteTargetType), required: true },
  targetId: { type: Id, required: true },
});
Favorite.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

const Notification = schema({
  userId: { type: Id, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: String,
  body: String,
  data: Schema.Types.Mixed,
  dedupeKey: { type: String },
  readAt: { type: Date, default: null },
});
Notification.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

const NotificationSetting = schema({
  userId: { type: Id, ref: 'User', required: true },
  type: { type: String, required: true },
  enabled: { type: Boolean, default: true },
});
NotificationSetting.index({ userId: 1, type: 1 }, { unique: true });

const SystemConfig = schema({
  key: { type: String, required: true, unique: true },
  value: String,
  updatedBy: { type: Id, ref: 'User', default: null },
});

const AuditLog = schema({
  actorUserId: { type: Id, ref: 'User', default: null, index: true },
  action: { type: String, required: true, index: true },
  entityType: String,
  entityId: String,
  detail: Schema.Types.Mixed,
});

const model = (name, s) => mongoose.models[name] || mongoose.model(name, s);

module.exports = {
  User: model('User', User),
  OtpCode: model('OtpCode', OtpCode),
  LoginOtp: model('LoginOtp', LoginOtp),
  AuthLimit: model('AuthLimit', AuthLimit),
  Session: model('Session', Session),
  Category: model('Category', Category),
  Brand: model('Brand', Brand),
  Store: model('Store', Store),
  StaffAssignment: model('StaffAssignment', StaffAssignment),
  Campaign: model('Campaign', Campaign),
  Order: model('Order', Order),
  Payment: model('Payment', Payment),
  PaymentRefund: model('PaymentRefund', PaymentRefund),
  VoucherItem: model('VoucherItem', VoucherItem),
  RedeemToken: model('RedeemToken', RedeemToken),
  RedemptionLog: model('RedemptionLog', RedemptionLog),
  RefundRequest: model('RefundRequest', RefundRequest),
  Settlement: model('Settlement', Settlement),
  Review: model('Review', Review),
  Favorite: model('Favorite', Favorite),
  Notification: model('Notification', Notification),
  NotificationSetting: model('NotificationSetting', NotificationSetting),
  SystemConfig: model('SystemConfig', SystemConfig),
  AuditLog: model('AuditLog', AuditLog),
};
