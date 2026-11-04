// Quy tac nghiep vu viet thanh ham thuan (khong phu thuoc CSDL) de dung chung va de test
const { VoucherItemStatus, VoucherType, DiscountType, RefundRequestStatus } = require('../utils/enums');
const { badRequest } = require('../utils/errors');
const { DAY_MS, formatVnDateTime } = require('../utils/time');

// ---------- Mua hang ----------

// BR-01: da mua (moi voucher da phat hanh) + don PENDING + so dang dat <= gioi han moi nguoi
const remainingPurchaseQuota = (limitPerUser, issued, pendingQty) => Math.max(0, limitPerUser - issued - pendingQty);

// DC-03: ton kho kha dung = tong - da ban - dang giu cho
const availableStock = (c) => c.totalQuantity - c.soldQuantity - c.reservedQuantity;

const isOnSale = (c, now = new Date()) =>
  new Date(c.saleStartAt).getTime() <= now.getTime() && now.getTime() <= new Date(c.saleEndAt).getTime();

// BR-05: min(ngay thanh toan + windowDays, han su dung - minDaysBeforeExpire)
function refundableUntil(paidAt, voucherExpireAt, windowDays = 7, minDaysBeforeExpire = 3) {
  return new Date(Math.min(
    new Date(paidAt).getTime() + windowDays * DAY_MS,
    new Date(voucherExpireAt).getTime() - minDaysBeforeExpire * DAY_MS,
  ));
}

// ---------- Chien dich ----------

const money = (v) => `${Number(v).toLocaleString('vi-VN')} ₫`;
const positiveInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0 && v !== null && v !== '';

// Gia tri toi da khach nhan duoc tu ma giam gia: giam theo so tien -> so tien giam; theo % -> muc giam toi da.
// Day chinh la "gia tri voucher" (faceValue) cua loai DISCOUNT, he thong tu tinh, chu thuong hieu khong nhap tay.
const discountMaxValue = (c) => Number(c.discountType === DiscountType.PERCENT ? c.maxDiscount : c.discountValue);

// FR-CAMP-12: truong gia tri bat buoc theo loai voucher. Nguyen tac chung: khach tra it hon gia tri nhan duoc.
function validateValueFields(c) {
  const salePrice = Number(c.salePrice);
  const faceValue = Number(c.faceValue);
  if (!Number.isInteger(salePrice) || salePrice < 1) throw badRequest('Giá bán phải là số nguyên lớn hơn 0.');
  if (!Object.values(VoucherType).includes(c.voucherType)) throw badRequest('Loại voucher không hợp lệ.');
  if (c.voucherType === VoucherType.DISCOUNT) {
    if (!Object.values(DiscountType).includes(c.discountType) || !positiveInt(c.discountValue)) {
      throw badRequest('Mã giảm giá cần kiểu giảm (số tiền / phần trăm) và giá trị giảm là số nguyên lớn hơn 0.');
    }
    if (c.discountType === DiscountType.PERCENT) {
      if (Number(c.discountValue) > 100) throw badRequest('Phần trăm giảm phải từ 1 đến 100.');
      if (!positiveInt(c.maxDiscount)) throw badRequest('Giảm theo phần trăm cần mức giảm tối đa là số nguyên lớn hơn 0.');
    }
    if (discountMaxValue(c) <= salePrice) {
      throw badRequest(c.discountType === DiscountType.PERCENT
        ? `Mức giảm tối đa (${money(c.maxDiscount)}) phải lớn hơn giá bán (${money(salePrice)}), nếu không khách mua mã sẽ bị lỗ.`
        : `Số tiền giảm (${money(c.discountValue)}) phải lớn hơn giá bán (${money(salePrice)}), nếu không khách mua mã sẽ bị lỗ.`);
    }
  } else {
    if (!Number.isInteger(faceValue) || faceValue < 1) throw badRequest('Giá trị voucher phải là số nguyên lớn hơn 0.');
    if (faceValue <= salePrice) {
      throw badRequest(c.voucherType === VoucherType.PREPAID
        ? `Mệnh giá (${money(faceValue)}) phải lớn hơn giá bán (${money(salePrice)}).`
        : `Giá niêm yết của gói (${money(faceValue)}) phải lớn hơn giá bán (${money(salePrice)}).`);
    }
  }
  if (c.voucherType === VoucherType.COMBO && !String(c.comboItems || '').trim()) throw badRequest('Combo cần mô tả nội dung gói.');
  if (!positiveInt(c.totalQuantity)) throw badRequest('Số lượng phát hành phải là số nguyên lớn hơn 0.');
  if (c.limitPerUser !== undefined && c.limitPerUser !== null) {
    if (!positiveInt(c.limitPerUser)) throw badRequest('Giới hạn mua mỗi người phải là số nguyên lớn hơn 0.');
    if (Number(c.limitPerUser) > Number(c.totalQuantity)) throw badRequest('Giới hạn mua mỗi người không được lớn hơn số lượng phát hành.');
  }
}

// BR-21 / DC-10: han su dung >= ngay ket thuc ban + 10 ngay
const MIN_EXPIRE_DAYS_AFTER_SALE_END = 10;
function validateTimeline(c) {
  const t = (v) => (v === undefined || v === null || v === '' ? NaN : new Date(v).getTime());
  const start = t(c.saleStartAt);
  const end = t(c.saleEndAt);
  const expire = t(c.voucherExpireAt);
  if ([start, end, expire].some(Number.isNaN)) {
    throw badRequest('Thiếu ngày bắt đầu bán, ngày kết thúc bán hoặc hạn sử dụng voucher.');
  }
  if (start >= end) throw badRequest('Ngày kết thúc bán phải sau ngày bắt đầu bán.');
  if (expire < end + MIN_EXPIRE_DAYS_AFTER_SALE_END * DAY_MS) {
    throw badRequest(`Hạn sử dụng voucher phải sau ngày kết thúc bán ít nhất ${MIN_EXPIRE_DAYS_AFTER_SALE_END} ngày (BR-21).`);
  }
}

// Phan tram tiet kiem quy doi de hien nhan, loc va sap xep:
//  - giam theo %: chinh muc giam; giam theo so tien: (muc giam - gia mua ma) / muc giam
//  - menh gia / combo: (gia tri - gia ban) / gia tri
function discountPercent(c) {
  const ratio = (value, price) => (value > 0 ? Math.max(0, (100 * (value - price)) / value) : 0);
  if (c.voucherType === VoucherType.DISCOUNT && c.discountType === DiscountType.PERCENT) return Number(c.discountValue || 0);
  if (c.voucherType === VoucherType.DISCOUNT) return ratio(Number(c.discountValue || 0), c.salePrice);
  return ratio(c.faceValue, c.salePrice);
}

// ---------- Su dung voucher ----------

// Voucher co dung duoc luc nay khong (sinh ma va xac nhan su dung)
function usageBlock(item, now = new Date()) {
  switch (item.status) {
    case VoucherItemStatus.USED:
      return { reason: 'VOUCHER_USED', message: 'Voucher đã được sử dụng.', details: null };
    case VoucherItemStatus.REFUND_PENDING:
      return { reason: 'VOUCHER_REFUND_PENDING', message: 'Voucher đang chờ hoàn tiền nên không thể sử dụng.', details: null };
    case VoucherItemStatus.REFUNDED:
      return { reason: 'VOUCHER_REFUNDED', message: 'Voucher đã được hoàn tiền, không còn hiệu lực.', details: null };
    default:
      break;
  }
  const expireAt = new Date(item.expireAt);
  if (item.status === VoucherItemStatus.EXPIRED || expireAt.getTime() <= now.getTime()) {
    return {
      reason: 'VOUCHER_EXPIRED',
      message: `Voucher đã hết hạn sử dụng lúc ${formatVnDateTime(expireAt)}.`,
      details: { expireAt: expireAt.toISOString() },
    };
  }
  return null;
}

// BR-03: voucher menh gia bat buoc nhap gia tri hoa don
const billRequired = (voucherType, billAmount) =>
  voucherType === VoucherType.PREPAID && (billAmount === null || billAmount === undefined || billAmount === '');

// ---------- Hoan tien ----------

const OPEN_REFUND_STATUSES = [RefundRequestStatus.REQUESTED, RefundRequestStatus.PROCESSING, RefundRequestStatus.MANUAL_PENDING];

function refundEligibility(item, hasOpenRequest, now = new Date()) {
  const until = new Date(item.refundableUntil);
  const deny = (reasonCode, reason) => ({ canRefund: false, reasonCode, reason, refundableUntil: until });
  if (item.status === VoucherItemStatus.USED) return deny('VOUCHER_USED', 'Voucher đã được sử dụng nên không thể hoàn tiền.');
  if (item.status === VoucherItemStatus.REFUNDED) return deny('VOUCHER_REFUNDED', 'Voucher đã được hoàn tiền.');
  if (item.status === VoucherItemStatus.REFUND_PENDING || hasOpenRequest) {
    return deny('REFUND_IN_PROGRESS', 'Voucher đang có yêu cầu hoàn tiền được xử lý.');
  }
  if (item.status === VoucherItemStatus.EXPIRED || new Date(item.expireAt).getTime() <= now.getTime()) {
    return deny('VOUCHER_EXPIRED', 'Voucher đã hết hạn sử dụng nên không thể hoàn tiền.');
  }
  if (now.getTime() > until.getTime()) {
    return deny('REFUND_WINDOW_PASSED', `Đã quá hạn hoàn tiền (hạn chót ${formatVnDateTime(until)}).`);
  }
  return { canRefund: true, reasonCode: null, reason: null, refundableUntil: until };
}

const statusAfterFailedRefund = (expireAt, now = new Date()) =>
  new Date(expireAt).getTime() > now.getTime() ? VoucherItemStatus.ACTIVE : VoucherItemStatus.EXPIRED;

// ---------- Vi voucher ----------

const WALLET_STATUS_LABELS = {
  ACTIVE: 'Đang hiệu lực',
  REFUND_PENDING: 'Đang hoàn tiền',
  USED: 'Đã sử dụng',
  EXPIRED: 'Hết hạn',
  REFUNDED: 'Đã hoàn tiền',
};

// 4 tab: ACTIVE / USED / EXPIRED / REFUNDED. REFUND_PENDING nam o tab dang hieu luc voi nhan "Dang hoan tien"
function walletPlacement(item, now = new Date()) {
  let tab;
  let displayStatus = item.status;
  switch (item.status) {
    case VoucherItemStatus.REFUND_PENDING: tab = 'ACTIVE'; break;
    case VoucherItemStatus.ACTIVE:
      if (new Date(item.expireAt).getTime() > now.getTime()) tab = 'ACTIVE';
      else { tab = 'EXPIRED'; displayStatus = VoucherItemStatus.EXPIRED; }
      break;
    case VoucherItemStatus.USED: tab = 'USED'; break;
    case VoucherItemStatus.REFUNDED: tab = 'REFUNDED'; break;
    default: tab = 'EXPIRED';
  }
  return { tab, displayStatus, statusLabel: WALLET_STATUS_LABELS[displayStatus] };
}

// ---------- Tim kiem ----------

// "Phúc Long" -> "phuc long"
const foldVietnamese = (text = '') =>
  String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

function distanceKm(lat, lng, toLat, toLng) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(toLat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(toLat)) * Math.sin(rad(toLng - lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

// ---------- Hoa hong ----------

function validateCommissionRate(rate) {
  const value = typeof rate === 'string' ? Number(rate) : rate;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest('Tỷ lệ hoa hồng phải là một số. Ví dụ nhập 0.1 để thu 10%.');
  }
  if (value <= 0 || value >= 1) throw badRequest('Tỷ lệ hoa hồng phải lớn hơn 0% và nhỏ hơn 100%.');
  return value;
}

module.exports = {
  remainingPurchaseQuota, availableStock, isOnSale, refundableUntil,
  discountMaxValue, validateValueFields, validateTimeline, discountPercent, MIN_EXPIRE_DAYS_AFTER_SALE_END,
  usageBlock, billRequired,
  OPEN_REFUND_STATUSES, refundEligibility, statusAfterFailedRefund,
  WALLET_STATUS_LABELS, walletPlacement,
  foldVietnamese, distanceKm, validateCommissionRate,
};
