import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let VoucherBenefit;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ VoucherBenefit } = await server.ssrLoadModule('/src/customer/MarketplaceUI.jsx'));
});
after(async () => { await server?.close(); });
const render = voucher => renderToStaticMarkup(React.createElement(VoucherBenefit, { voucher, detailed: true }));

test('Cashback displays a conditional merchant benefit, cap and minimum invoice without claiming a direct discount', () => {
  const html = render({ voucherType: 'CASHBACK', salePrice: 300000, cashbackType: 'PERCENTAGE', cashbackValue: 50, maxCashbackAmount: 5000000, minOrderValue: 1000000, refundMethod: 'tiền mặt' });
  assert.match(html, /50%/);
  assert.match(html, /Hoàn tối đa 5\.000\.000/);
  assert.match(html, /Hóa đơn từ 1\.000\.000/);
  assert.match(html, /Merchant chịu trách nhiệm hoàn tiền/);
  assert.doesNotMatch(html, /Giảm 50|Tiết kiệm/);
});

test('Stored-Value displays face value, savings and single-use rules without Cashback fields', () => {
  const html = render({ voucherType: 'STORED_VALUE', faceValue: 200000, salePrice: 170000 });
  assert.match(html, /200\.000/);
  assert.match(html, /Tiết kiệm 30\.000/);
  assert.match(html, /Dùng một lần/);
  assert.match(html, /không có số dư/);
  assert.doesNotMatch(html, /Merchant hoàn|Hóa đơn từ/);
});

test('legacy percentage discounts retain discount meaning and cap', () => {
  const html = render({ voucherType: 'DISCOUNT', discountType: 'PERCENT', discountValue: 20, maxDiscount: 15000 });
  assert.match(html, /Giảm 20%/);
  assert.match(html, /Tối đa 15\.000/);
  assert.doesNotMatch(html, /MERCHANT HOÀN TIỀN/);
});
