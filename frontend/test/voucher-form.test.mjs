import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVoucherForm } from '../src/utils/voucher-form.js';
const base = { title: 'Discount demo', voucherType: 'DISCOUNT', terms: 'Single use', storeIds: ['store'], salePrice: '10000', totalQuantity: 200, limitPerUser: 3, discountType: 'PERCENT', discountValue: '20', maxDiscount: '30000', minOrderValue: '80000', saleStartAt: '2026-11-05T00:00:00Z', saleEndAt: '2026-12-05T00:00:00Z', voucherExpireAt: '2026-12-25T00:00:00Z' };
test('Discount form validates percentage, amount, minimum and cap before API conversion', () => {
  assert.equal(validateVoucherForm(base), null);
  for (const patch of [{ discountValue: -1 }, { discountValue: 101 }, { maxDiscount: '' }, { minOrderValue: -1 }, { terms: '' }, { discountType: 'invalid' }, { discountType: 'AMOUNT', discountValue: 90000 }]) assert.ok(validateVoucherForm({ ...base, ...patch }), JSON.stringify(patch));
  assert.equal(validateVoucherForm({ ...base, discountType: 'AMOUNT', discountValue: 30000, maxDiscount: '' }), null);
});
