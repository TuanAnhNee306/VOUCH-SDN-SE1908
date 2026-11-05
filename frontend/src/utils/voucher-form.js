// Validation before converting form strings into the numeric API contract.
export function validateVoucherForm(form) {
  const number = (key) => form[key] === '' || form[key] == null ? NaN : Number(form[key]);
  const integer = (key, min = 1) => Number.isSafeInteger(number(key)) && number(key) >= min && number(key) <= Math.floor(Number.MAX_SAFE_INTEGER / 100);
  if (!form.title?.trim()) return 'Vui lòng nhập tên voucher.';
  if (!form.storeIds?.length) return 'Chọn ít nhất một chi nhánh.';
  if (!integer('salePrice')) return 'Giá bán phải là số nguyên VND lớn hơn 0 trong giới hạn an toàn.';
  if (!integer('totalQuantity') || !integer('limitPerUser')) return 'Số lượng và giới hạn mua phải là số nguyên dương.';
  if (number('limitPerUser') > number('totalQuantity')) return 'Giới hạn mua không được vượt số lượng phát hành.';
  const start = new Date(form.saleStartAt).getTime();
  const end = new Date(form.saleEndAt).getTime();
  const expire = new Date(form.voucherExpireAt).getTime();
  if (![start, end, expire].every(Number.isFinite) || start >= end || expire < end + 10 * 86400000) return 'Thời gian không hợp lệ: kết thúc phải sau bắt đầu, hạn dùng sau kết thúc bán ít nhất 10 ngày.';
  if (['CASHBACK', 'DISCOUNT', 'STORED_VALUE'].includes(form.voucherType) && !form.terms?.trim()) return 'Vui lòng nhập điều kiện sử dụng.';
  if (form.voucherType === 'DISCOUNT') {
    if (!['PERCENT', 'AMOUNT'].includes(form.discountType) || !integer('discountValue')) return 'Chọn kiểu giảm và giá trị giảm hợp lệ.';
    if (form.discountType === 'PERCENT' && (number('discountValue') > 100 || !integer('maxDiscount'))) return 'Phần trăm giảm tối đa 100% và cần mức giảm tối đa.';
    if (!integer('minOrderValue', 0)) return 'Nhập hóa đơn tối thiểu hợp lệ.';
    if (form.discountType === 'AMOUNT' && number('discountValue') > number('minOrderValue')) return 'Số tiền giảm không được vượt hóa đơn tối thiểu.';
  }
  if (form.voucherType === 'STORED_VALUE') {
    if (!integer('faceValue') || number('salePrice') >= number('faceValue')) return 'Mệnh giá phải lớn hơn 0; giá bán phải nhỏ hơn mệnh giá.';
  }
  if (form.voucherType === 'CASHBACK') {
    if (!['PERCENTAGE', 'FIXED_AMOUNT'].includes(form.cashbackType)) return 'Chọn hình thức Cashback hợp lệ.';
    if (!Number.isFinite(number('cashbackValue')) || number('cashbackValue') <= 0) return 'Giá trị Cashback phải lớn hơn 0.';
    if (form.cashbackType === 'PERCENTAGE' && number('cashbackValue') > 100) return 'Tỷ lệ Cashback không được vượt 100%.';
    if (form.cashbackType === 'FIXED_AMOUNT' && !integer('cashbackValue')) return 'Số tiền Cashback phải là số nguyên VND dương.';
    const hasCap = form.maxCashbackAmount !== '' && form.maxCashbackAmount != null;
    if ((form.cashbackType === 'PERCENTAGE' || hasCap) && !integer('maxCashbackAmount')) return 'Mức hoàn tối đa phải là số nguyên VND dương.';
    if (form.cashbackType === 'FIXED_AMOUNT' && hasCap && number('maxCashbackAmount') < number('cashbackValue')) return 'Mức trần không được nhỏ hơn số tiền hoàn cố định.';
    if (!integer('minOrderValue', 0)) return 'Hóa đơn tối thiểu phải là số nguyên VND không âm.';
    if (!form.refundMethod?.trim()) return 'Nhập phương thức Merchant trực tiếp hoàn tiền.';
  }
  return null;
}
