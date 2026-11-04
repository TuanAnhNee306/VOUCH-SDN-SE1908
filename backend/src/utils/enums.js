// Vong doi trang thai - SRS muc 6
const freeze = (...values) => Object.freeze(Object.fromEntries(values.map((v) => [v, v])));

module.exports = {
  Role: freeze('CUSTOMER', 'BRAND_OWNER', 'STORE_STAFF', 'ADMIN'),
  UserStatus: freeze('PENDING_ACTIVATION', 'ACTIVE', 'INACTIVE'),
  BrandStatus: freeze('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'),
  CampaignStatus: freeze('DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'SOLD_OUT', 'PAUSED', 'ENDED'),
  VoucherType: freeze('DISCOUNT', 'PREPAID', 'COMBO', 'CASHBACK', 'STORED_VALUE'),
  DiscountType: freeze('AMOUNT', 'PERCENT'),
  VoucherItemStatus: freeze('ACTIVE', 'REFUND_PENDING', 'USED', 'REFUNDED', 'EXPIRED', 'PENDING_CASHBACK', 'MERCHANT_REPORTED_PAID', 'DISPUTED', 'COMPLETED'),
  OrderStatus: freeze('PENDING', 'PAID', 'CANCELLED', 'FULFILLED', 'REFUNDED_OVERSOLD', 'PAYMENT_MISMATCH'),
  RefundRequestStatus: freeze('REQUESTED', 'PROCESSING', 'REJECTED', 'MANUAL_PENDING', 'COMPLETED', 'FAILED'),
  SettlementStatus: freeze('PENDING', 'PAID'),
  PaymentStatus: freeze('SUCCESS', 'FAILED', 'CANCELLED'),
  PaymentRefundReason: freeze('CUSTOMER_REQUEST', 'OVERSOLD', 'MISMATCH'),
  PaymentRefundMode: freeze('AUTO', 'MANUAL'),
  PaymentRefundStatus: freeze('PROCESSING', 'COMPLETED', 'FAILED'),
  OtpPurpose: freeze('LOGIN', 'ACTIVATE', 'RESET_PASSWORD'),
  ReviewStatus: freeze('VISIBLE', 'HIDDEN'),
  FavoriteTargetType: freeze('BRAND', 'CAMPAIGN'),
  RedeemMethod: freeze('QR', 'OTP'),
  NotificationType: freeze('ORDER_CREATED', 'VOUCHER_ISSUED', 'VOUCHER_USED', 'REFUND_RESULT', 'VOUCHER_EXPIRING', 'CAMPAIGN_NEW', 'CASHBACK_UPDATE'),
};
