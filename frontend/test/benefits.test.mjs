import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { StaticRouter } from 'react-router-dom/server.js';

let server;
let VoucherBenefit;
let EmailOtpLogin, ManagementLogin;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ VoucherBenefit } = await server.ssrLoadModule('/src/customer/MarketplaceUI.jsx'));
  ({ EmailOtpLogin } = await server.ssrLoadModule('/src/components/EmailOtpLogin.jsx'));
  ({ ManagementLogin } = await server.ssrLoadModule('/src/components/ManagementLogin.jsx'));
});
after(async () => { await server?.close(); });
const render = voucher => renderToStaticMarkup(React.createElement(VoucherBenefit, { voucher, detailed: true }));

test('Customer login renders only email OTP and Management renders password login', () => {
  const page = Component => renderToStaticMarkup(React.createElement(StaticRouter, { location: '/login' }, React.createElement(Component)));
  const customer = page(EmailOtpLogin);
  assert.match(customer, /type="email"/);
  assert.match(customer, /Gửi mã OTP/);
  assert.doesNotMatch(customer, /type="password"|Voucher@123/);
  const management = page(ManagementLogin);
  assert.match(management, /type="password"/);
  assert.match(management, /admin@voucher.local/);
  assert.match(management, /owner@highlands.local/);
  assert.match(management, /staff@highlands.local/);
  assert.doesNotMatch(management, /Gửi mã OTP|one-time-code/);
});

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
