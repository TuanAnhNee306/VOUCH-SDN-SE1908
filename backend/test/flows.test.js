// Test e2e 4 luong nghiep vu trong tai lieu demo. Chay: npm test (MongoDB nhung tam, khong dung toi du lieu demo).
process.env.MAIL_MODE = 'console';
process.env.PAYMENT_SIMULATOR = 'true';
process.env.REFUND_MODE = 'auto';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-secret';
process.env.VNPAY_TMN_CODE = 'TESTVNPAY';
process.env.VNPAY_HASH_SECRET = 'test-vnpay-secret';
process.env.VNPAY_RETURN_URL = 'http://localhost:5173/payment-return';
process.env.VNPAY_IPN_URL = 'https://example.test/api/orders/vnpay-ipn';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

console.log = () => {}; // an log [mail] khi chay test

let server;
let base;
let mongo;
const M = require('../src/models');
const { seed } = require('../src/seed');
const { createApp } = require('../src/app');
const orders = require('../src/services/order');
const settlements = require('../src/services/settlement');
const { signWebhook, signVnpayParams } = require('../src/services/payment-gateway');

async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function otpLogin(email) {
  const r = await api('POST', '/auth/otp/request', { email });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const v = await api('POST', '/auth/otp/verify', { email, otp: r.body.devOtp });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v.body.accessToken;
}

async function webLogin(email) {
  const r = await api('POST', '/auth/login', { email, password: 'Voucher@123' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.accessToken;
}

const campaignByTitle = (title) => M.Campaign.findOne({ title });

let customer; let customer2; let staff; let owner; let admin;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('voucher_test'));
  await seed();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  customer = await otpLogin('khach@voucher.local');
  customer2 = await otpLogin('khach2@voucher.local');
  staff = await webLogin('staff@highlands.local');
  owner = await webLogin('owner@highlands.local');
  admin = await webLogin('admin@voucher.local');
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

// ===================== Luong 1: mua va thanh toan =====================

test('Luong 1: dang nhap OTP sai ma bi tu choi, khach khong dang nhap web bang mat khau', async () => {
  await api('POST', '/auth/otp/request', { email: 'moi@voucher.local' });
  const bad = await api('POST', '/auth/otp/verify', { email: 'moi@voucher.local', otp: '000000' });
  assert.equal(bad.status, 401);
  const web = await api('POST', '/auth/login', { email: 'khach@voucher.local', password: 'x' });
  assert.equal(web.status, 401);
});

test('Luong 1: mua 2 voucher -> PENDING giu cho 15 phut -> thanh toan thu -> FULFILLED, voucher ve vi, thong bao', async () => {
  const c = await campaignByTitle('Voucher 100.000đ chỉ 80.000đ');
  const before = c.reservedQuantity;
  const created = await api('POST', '/orders', { campaignId: String(c._id), quantity: 2 }, customer);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const order = created.body.order;
  assert.equal(order.status, 'PENDING');
  assert.equal(order.totalAmount, 160000);
  const holdMin = (new Date(order.reservedUntil) - new Date(order.createdAt)) / 60000;
  assert.ok(holdMin > 14.9 && holdMin <= 15.1);
  assert.equal((await M.Campaign.findById(c._id)).reservedQuantity, before + 2);

  const paid = await api('POST', `/orders/${order.id}/simulate-payment`, { result: 'success' }, customer);
  assert.equal(paid.body.outcome, 'FULFILLED');
  assert.equal(paid.body.order.status, 'FULFILLED');
  const after = await M.Campaign.findById(c._id);
  assert.equal(after.reservedQuantity, before);

  const items = await M.VoucherItem.find({ orderId: order.id });
  assert.equal(items.length, 2);
  assert.notEqual(items[0].code, items[1].code);
  // BR-05: han hoan = min(ngay thanh toan + 7 ngay, han dung - 3 ngay)
  const o = await M.Order.findById(order.id);
  assert.equal(items[0].refundableUntil.getTime(), Math.min(o.paidAt.getTime() + 7 * 864e5, c.voucherExpireAt.getTime() - 3 * 864e5));
  assert.equal(o.commissionRate, 0.1);

  const wallet = await api('GET', '/wallet?tab=ACTIVE', undefined, customer);
  assert.ok(wallet.body.filter((v) => v.orderId === order.id).length === 2);
  const notes = await api('GET', '/notifications', undefined, customer);
  assert.ok(notes.body.items.some((n) => n.title === 'Voucher đã về ví'));
});

test('Luong 1 DC-04: webhook gui trung chi xu ly mot lan; chu ky sai bi tu choi', async () => {
  const c = await campaignByTitle('Voucher 100.000đ chỉ 80.000đ');
  const { body } = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, customer);
  const p = { orderId: body.order.id, gatewayTxnId: 'TXN-DUP-1', amount: 80000, status: 'SUCCESS' };
  const bad = await api('POST', '/orders/payment-webhook', { ...p, signature: 'sai' });
  assert.equal(bad.status, 401);
  const first = await api('POST', '/orders/payment-webhook', { ...p, signature: signWebhook(p) });
  assert.equal(first.body.outcome, 'FULFILLED');
  const second = await api('POST', '/orders/payment-webhook', { ...p, signature: signWebhook(p) });
  assert.equal(second.body.outcome, 'DUPLICATE');
  assert.equal(await M.VoucherItem.countDocuments({ orderId: body.order.id }), 1);
});

test('Luong 1 VNPAY IPN: dung chu ky va so tien moi phat voucher; IPN trung khong xu ly lai', async () => {
  const c = await campaignByTitle('Voucher 100.000đ chỉ 80.000đ');
  const { body } = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, customer2);
  const p = {
    vnp_Amount: String(body.order.totalAmount * 100), vnp_BankCode: 'NCB', vnp_Command: 'pay',
    vnp_CreateDate: '20261104110000', vnp_CurrCode: 'VND', vnp_Locale: 'vn',
    vnp_OrderInfo: `Thanh toan don ${body.order.paymentOrderCode}`, vnp_OrderType: 'other',
    vnp_ResponseCode: '00', vnp_TmnCode: 'TESTVNPAY', vnp_TransactionNo: '10000001',
    vnp_TransactionStatus: '00', vnp_TxnRef: body.order.paymentOrderCode, vnp_Version: '2.1.0',
  };
  p.vnp_SecureHash = signVnpayParams(p);
  const query = new URLSearchParams(p).toString();
  const bad = await api('GET', `/orders/vnpay-ipn?${query.replace(/.$/, 'x')}`);
  assert.equal(bad.body.RspCode, '97');
  const first = await api('GET', `/orders/vnpay-ipn?${query}`);
  assert.equal(first.body.RspCode, '00', JSON.stringify(first.body));
  const second = await api('GET', `/orders/vnpay-ipn?${query}`);
  assert.equal(second.body.RspCode, '02');
  assert.equal(await M.VoucherItem.countDocuments({ orderId: body.order.id }), 1);
});

test('Luong 1 N1: vuot gioi han 5 voucher / tai khoan (tinh ca don dang cho) bi tu choi', async () => {
  const c = await campaignByTitle('Trà sữa Phúc Long mua 1 tặng 1');
  const six = await api('POST', '/orders', { campaignId: String(c._id), quantity: 6 }, customer);
  assert.equal(six.status, 400);
  const five = await api('POST', '/orders', { campaignId: String(c._id), quantity: 5 }, customer);
  assert.equal(five.status, 201);
  const one = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, customer);
  assert.equal(one.status, 400);
  assert.equal(one.body.code, 'PURCHASE_LIMIT');
  assert.match(one.body.message, /đạt giới hạn 5 voucher/);

  // N2: thanh toan lai tra dung don cu; N3: that bai -> CANCELLED, nha ton kho ngay
  const retry = await api('POST', `/orders/${five.body.order.id}/pay`, undefined, customer);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.order.id, five.body.order.id);
  const reservedBefore = (await M.Campaign.findById(c._id)).reservedQuantity;
  const failed = await api('POST', `/orders/${five.body.order.id}/simulate-payment`, { result: 'failed' }, customer);
  assert.equal(failed.body.outcome, 'CANCELLED');
  assert.equal(failed.body.order.status, 'CANCELLED');
  assert.equal((await M.Campaign.findById(c._id)).reservedQuantity, reservedBefore - 5);
  const retryCancelled = await api('POST', `/orders/${five.body.order.id}/pay`, undefined, customer);
  assert.equal(retryCancelled.status, 400);
});

test('Luong 1 N2: job huy don qua 15 phut va nha ton kho', async () => {
  const c = await campaignByTitle('Trà sữa Phúc Long mua 1 tặng 1');
  const { body } = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, customer);
  const reserved = (await M.Campaign.findById(c._id)).reservedQuantity;
  const n = await orders.cancelExpiredOrders(new Date(Date.now() + 16 * 60000));
  assert.ok(n >= 1);
  assert.equal((await M.Order.findById(body.order.id)).status, 'CANCELLED');
  assert.equal((await M.Campaign.findById(c._id)).reservedQuantity, reserved - 1);

  // N5 (BR-11): webhook thanh cong den muon, con hang -> van phat hanh voucher
  const p = { orderId: body.order.id, gatewayTxnId: 'TXN-LATE-1', amount: 55000, status: 'SUCCESS' };
  const late = await api('POST', '/orders/payment-webhook', { ...p, signature: signWebhook(p) });
  assert.equal(late.body.outcome, 'FULFILLED_LATE');
  assert.equal(await M.VoucherItem.countDocuments({ orderId: body.order.id }), 1);
});

test('Luong 1 N5: webhook den muon khi het hang -> REFUNDED_OVERSOLD, hoan 100%, thong bao xin loi', async () => {
  const c = await campaignByTitle('Giảm 100.000đ cho hóa đơn từ 500.000đ');
  const { body } = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, customer2);
  await orders.cancelExpiredOrders(new Date(Date.now() + 16 * 60000));
  await M.Campaign.updateOne({ _id: c._id }, { soldQuantity: c.totalQuantity });
  const p = { orderId: body.order.id, gatewayTxnId: 'TXN-LATE-2', amount: 20000, status: 'SUCCESS' };
  const late = await api('POST', '/orders/payment-webhook', { ...p, signature: signWebhook(p) });
  assert.equal(late.body.outcome, 'REFUNDED_OVERSOLD');
  assert.equal((await M.Order.findById(body.order.id)).status, 'REFUNDED_OVERSOLD');
  assert.equal(await M.PaymentRefund.countDocuments({ orderId: body.order.id, reasonType: 'OVERSOLD' }), 1);
  const notes = await api('GET', '/notifications', undefined, customer2);
  assert.ok(notes.body.items.some((n) => /hoàn 100%/.test(n.body)));
  await M.Campaign.updateOne({ _id: c._id }, { soldQuantity: c.soldQuantity });
});

test('Luong 1 N4 (BR-20): lech so tien -> PAYMENT_MISMATCH, khong phat hanh, quan tri vien xac nhan da hoan', async () => {
  const c = await campaignByTitle('Trà sữa Phúc Long mua 1 tặng 1');
  const { body } = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, customer2);
  const reserved = (await M.Campaign.findById(c._id)).reservedQuantity;
  const r = await api('POST', `/orders/${body.order.id}/simulate-payment`, { result: 'mismatch' }, customer2);
  assert.equal(r.body.outcome, 'PAYMENT_MISMATCH');
  assert.equal(r.body.order.status, 'PAYMENT_MISMATCH');
  assert.equal(await M.VoucherItem.countDocuments({ orderId: body.order.id }), 0);
  assert.equal((await M.Campaign.findById(c._id)).reservedQuantity, reserved - 1);

  const queue = await api('GET', '/admin/payment-mismatches', undefined, admin);
  const row = queue.body.find((o) => o.id === body.order.id);
  assert.ok(row);
  assert.equal(row.receivedAmount, 27500);
  const noTxn = await api('PATCH', `/admin/payment-mismatches/${body.order.id}/confirm`, {}, admin);
  assert.equal(noTxn.status, 400);
  const ok = await api('PATCH', `/admin/payment-mismatches/${body.order.id}/confirm`, { gatewayRefundId: 'MB-REF-1' }, admin);
  assert.equal(ok.status, 200);
  assert.equal((await M.Order.findById(body.order.id)).status, 'CANCELLED');
});

test('Luong 1: hai nguoi mua so voucher cuoi cung cung luc - chi mot nguoi thanh cong (khong ban vuot)', async () => {
  const c = await campaignByTitle('Giảm 30% toàn bộ menu trà');
  const fresh = await M.Campaign.findById(c._id);
  assert.equal(fresh.totalQuantity - fresh.soldQuantity - fresh.reservedQuantity, 2);
  const [a, b] = await Promise.all([
    api('POST', '/orders', { campaignId: String(c._id), quantity: 2 }, customer),
    api('POST', '/orders', { campaignId: String(c._id), quantity: 2 }, customer2),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 400]);
  const after = await M.Campaign.findById(c._id);
  assert.equal(after.reservedQuantity + after.soldQuantity, after.totalQuantity);
  assert.equal(after.status, 'SOLD_OUT');
});

// ===================== Luong 2: su dung voucher tai cua hang =====================

async function activeVoucher(token, title) {
  const list = (await api('GET', '/wallet?tab=ACTIVE', undefined, token)).body;
  return list.find((v) => v.campaign.title === title && v.displayStatus === 'ACTIVE');
}

test('Luong 2: nhan vien phai chon chi nhanh; quet thieu hoa don -> BILL_REQUIRED nhung ma chua bi tieu; gui lai -> HOP LE', async () => {
  const v = await activeVoucher(customer, 'Voucher 100.000đ chỉ 80.000đ');
  const stores = await api('GET', '/staff/my-stores', undefined, staff);
  assert.equal(stores.body.length, 2);
  const tok = await api('POST', '/redeem/token', { voucherItemId: v.id }, customer);
  assert.equal(tok.status, 200);
  assert.match(tok.body.otpCode, /^\d{6}$/);
  assert.equal(tok.body.ttlSeconds, 60);
  // BR-16: payload QR khong chua ma tra cuu cua voucher
  assert.ok(!tok.body.qrPayload.includes(v.code));

  const noStore = await api('POST', '/staff/redeem', { otpCode: tok.body.otpCode, billAmount: 150000 }, staff);
  assert.equal(noStore.body.code, 'STORE_NOT_SELECTED');
  const leLoi = stores.body.find((s) => s.name === 'Highlands Lê Lợi');
  await api('POST', '/auth/select-store', { storeId: leLoi.id }, staff);

  const noBill = await api('POST', '/staff/redeem', { otpCode: tok.body.otpCode }, staff);
  assert.equal(noBill.body.code, 'BILL_REQUIRED');
  const ok = await api('POST', '/staff/redeem', { otpCode: tok.body.otpCode, billAmount: 150000 }, staff);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.voucherCode, v.code);
  assert.equal(ok.body.method, 'OTP');

  const status = await api('GET', `/redeem/status/${v.id}`, undefined, customer);
  assert.equal(status.body.status, 'USED');
  assert.equal(status.body.storeName, 'Highlands Lê Lợi');
  const notes = await api('GET', '/notifications', undefined, customer);
  assert.ok(notes.body.items.some((n) => n.title === 'Đã sử dụng voucher' && /Highlands Lê Lợi/.test(n.body)));
  const detail = await api('GET', `/wallet/${v.id}`, undefined, customer);
  assert.equal(detail.body.tab, 'USED');
  assert.equal(detail.body.redemption.storeName, 'Highlands Lê Lợi');
  assert.equal(detail.body.refund.canRefund, false);

  // N1: nhap lai cung ma -> DA SU DUNG kem thoi gian va chi nhanh
  const again = await api('POST', '/staff/redeem', { otpCode: tok.body.otpCode, billAmount: 150000 }, staff);
  assert.equal(again.body.code, 'VOUCHER_USED');
  assert.match(again.body.message, /tại Highlands Lê Lợi/);

  const history = await api('GET', '/staff/history/today', undefined, staff);
  assert.ok(history.body.some((h) => h.voucherCode === v.code && h.billAmount === 150000));
  const edit = await api('PATCH', `/staff/logs/${ok.body.redemptionLogId}/bill`, { billAmount: 160000 }, staff);
  assert.equal(edit.body.billAmount, 160000);
});

test('Luong 2 BR-06: sinh ma moi vo hieu ma cu; ma QR het 60 giay bi tu choi; QR gia mao bi tu choi', async () => {
  const v = await activeVoucher(customer, 'Voucher 100.000đ chỉ 80.000đ');
  const first = await api('POST', '/redeem/token', { voucherItemId: v.id }, customer);
  const second = await api('POST', '/redeem/token', { voucherItemId: v.id }, customer);
  const old = await api('POST', '/staff/redeem', { qrPayload: first.body.qrPayload, billAmount: 100000 }, staff);
  assert.equal(old.body.code, 'TOKEN_REVOKED');
  await M.RedeemToken.updateOne({ otpCode: second.body.otpCode, revokedAt: null }, { expiresAt: new Date(Date.now() - 1000) });
  const expired = await api('POST', '/staff/redeem', { otpCode: second.body.otpCode, billAmount: 100000 }, staff);
  assert.equal(expired.body.code, 'TOKEN_EXPIRED');
  const forged = await api('POST', '/staff/redeem', { qrPayload: first.body.qrPayload.replace(/.$/, 'x'), billAmount: 1 }, staff);
  assert.equal(forged.body.code, 'TOKEN_INVALID');
  assert.equal((await M.VoucherItem.findById(v.id)).status, 'ACTIVE');
});

test('Luong 2: hai thiet bi quet cung mot ma - mot thanh cong, mot bao da dung', async () => {
  const v = await activeVoucher(customer, 'Voucher 100.000đ chỉ 80.000đ');
  const tok = await api('POST', '/redeem/token', { voucherItemId: v.id }, customer);
  const [a, b] = await Promise.all([
    api('POST', '/staff/redeem', { qrPayload: tok.body.qrPayload, billAmount: 90000 }, staff),
    api('POST', '/staff/redeem', { qrPayload: tok.body.qrPayload, billAmount: 90000 }, staff),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  const fail = a.status === 400 ? a : b;
  assert.ok(['VOUCHER_USED', 'TOKEN_USED'].includes(fail.body.code));
  assert.equal(await M.RedemptionLog.countDocuments({ voucherItemId: v.id }), 1);
});

test('Luong 2 N2: sai chi nhanh (kem danh sach chi nhanh ap dung) va khoa OTP sau 5 lan sai', async () => {
  const c = await campaignByTitle("Phiếu ăn uống 500.000đ tại Pizza 4P's");
  const { body } = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, customer2);
  await api('POST', `/orders/${body.order.id}/simulate-payment`, {}, customer2);
  const v = await activeVoucher(customer2, "Phiếu ăn uống 500.000đ tại Pizza 4P's");
  const tok = await api('POST', '/redeem/token', { voucherItemId: v.id }, customer2);
  const wrong = await api('POST', '/staff/redeem', { otpCode: tok.body.otpCode, billAmount: 500000 }, staff);
  assert.equal(wrong.body.code, 'WRONG_STORE');
  assert.equal(wrong.body.details.stores.length, 2);

  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await api('POST', '/staff/redeem', { otpCode: '00000' + i }, staff);
    codes.push(r.body.code);
  }
  assert.deepEqual(codes, ['OTP_INVALID', 'OTP_INVALID', 'OTP_INVALID', 'OTP_INVALID', 'OTP_LOCKED']);
  const locked = await api('POST', '/staff/redeem', { otpCode: '123456' }, staff);
  assert.equal(locked.body.code, 'OTP_LOCKED');
  await M.AuditLog.deleteMany({ action: { $in: ['REDEEM_OTP_FAILED', 'REDEEM_OTP_LOCKED'] } });
});

// ===================== Luong 3: chien dich, phe duyet, doi soat =====================

test('Luong 3: tao nhap -> gui duyet (khoa sua) -> tu choi ve nhap -> duyet -> tu phat hanh -> khach mua duoc', async () => {
  const brand = (await api('GET', '/brand/me', undefined, owner)).body[0];
  const stores = (await api('GET', `/brand/${brand.id}/stores`, undefined, owner)).body;
  const now = Date.now();
  const payload = {
    title: 'Bánh ngọt tặng kèm', voucherType: 'COMBO', comboItems: '1 bánh + 1 trà', salePrice: 30000, faceValue: 45000,
    totalQuantity: 10, limitPerUser: 2, saleStartAt: new Date(now - 3600e3).toISOString(), saleEndAt: new Date(now + 20 * 864e5).toISOString(),
    voucherExpireAt: new Date(now + 25 * 864e5).toISOString(), storeIds: [stores[0].id],
  };
  const tooShort = await api('POST', `/brand/${brand.id}/campaigns`, payload, owner);
  assert.equal(tooShort.status, 400);
  assert.match(tooShort.body.message, /ít nhất 10 ngày/);
  payload.voucherExpireAt = new Date(now + 31 * 864e5).toISOString();
  const created = await api('POST', `/brand/${brand.id}/campaigns`, payload, owner);
  assert.equal(created.body.status, 'DRAFT');
  const id = created.body.id;

  const submitted = await api('PATCH', `/brand/${brand.id}/campaigns/${id}/submit`, undefined, owner);
  assert.equal(submitted.body.status, 'PENDING');
  const locked = await api('PATCH', `/brand/${brand.id}/campaigns/${id}`, { title: 'Sửa' }, owner);
  assert.equal(locked.status, 400);

  // Chu thuong hieu khac khong thao tac duoc
  const other = await webLogin('owner@phuclong.local');
  assert.equal((await api('GET', `/brand/${brand.id}/campaigns`, undefined, other)).status, 403);

  const rejected = await api('PATCH', `/admin/campaigns/${id}/reject`, { reason: 'Thiếu ảnh và điều kiện áp dụng' }, admin);
  assert.equal(rejected.body.status, 'DRAFT');
  assert.equal(rejected.body.rejectReason, 'Thiếu ảnh và điều kiện áp dụng');
  await api('PATCH', `/brand/${brand.id}/campaigns/${id}`, { terms: 'Áp dụng tại quầy' }, owner);
  await api('PATCH', `/brand/${brand.id}/campaigns/${id}/submit`, undefined, owner);
  const approved = await api('PATCH', `/admin/campaigns/${id}/approve`, undefined, admin);
  assert.equal(approved.body.status, 'PUBLISHED');

  const found = await api('GET', '/campaigns?keyword=banh ngot');
  assert.ok(found.body.items.some((c) => c.id === id));

  // Tam dung thi khong tao don moi
  await api('PATCH', `/brand/${brand.id}/campaigns/${id}/pause`, undefined, owner);
  const blocked = await api('POST', '/orders', { campaignId: id, quantity: 1 }, customer);
  assert.equal(blocked.status, 400);
  await api('PATCH', `/brand/${brand.id}/campaigns/${id}/resume`, undefined, owner);

  // BR-09: ty le hoa hong chot vao don luc thanh toan
  await api('POST', '/admin/commission-rate', { rate: 0.15 }, admin);
  const { body } = await api('POST', '/orders', { campaignId: id, quantity: 1 }, customer);
  await api('POST', `/orders/${body.order.id}/simulate-payment`, {}, customer);
  assert.equal((await M.Order.findById(body.order.id)).commissionRate, 0.15);
  await api('POST', '/admin/commission-rate', { rate: 0.1 }, admin);

  // BR-17: da ban thi khong sua gia
  const price = await api('PATCH', `/brand/${brand.id}/campaigns/${id}`, { salePrice: 25000 }, owner);
  assert.equal(price.status, 400);
  // FR-CAMP-15: sua chien dich dang ban -> cho duyet lai
  const edited = await api('PATCH', `/brand/${brand.id}/campaigns/${id}`, { description: 'Mô tả mới' }, owner);
  assert.equal(edited.body.status, 'PENDING');
});

test('Luong 3: job tu phat hanh khi toi ngay ban, het hang -> SOLD_OUT, het thoi gian -> ENDED', async () => {
  const c = await campaignByTitle('Phiếu bắp nước 100.000đ');
  assert.equal(c.status, 'APPROVED');
  await M.Campaign.updateOne({ _id: c._id }, { saleStartAt: new Date(Date.now() - 1000) });
  const campaigns = require('../src/services/campaign');
  const r = await campaigns.runStatusTransitions();
  assert.ok(r.published >= 1);
  assert.equal((await M.Campaign.findById(c._id)).status, 'PUBLISHED');
  const r2 = await campaigns.runStatusTransitions(new Date(c.saleEndAt.getTime() + 1000), c._id);
  assert.ok(r2.ended >= 1);
  assert.equal((await M.Campaign.findById(c._id)).status, 'ENDED');
});

test('Luong 3: chot doi soat - chi voucher het quyen hoan (BR-14), chay 2 lan khong trung (DC-06), chi tra', async () => {
  const highlands = await M.Brand.findOne({ name: 'Highlands Coffee' });
  const r = await api('POST', '/admin/settlements/run-previous-month', undefined, admin);
  assert.equal(r.status, 200);
  const hl = r.body.settlements.find((s) => String(s.brandId) === String(highlands._id));
  assert.ok(hl, 'phai co phieu Highlands');
  // 3 voucher mua dau thang (1 da dung + 2 qua han hoan); voucher mua cuoi thang con han hoan bi loai
  assert.equal(hl.voucherCount, 3);
  assert.equal(hl.grossRevenue, 240000);
  assert.equal(hl.commissionAmount, 24000);
  assert.equal(hl.payableAmount, 216000);
  for (const it of hl.items) {
    const v = await M.VoucherItem.findById(it.voucherItemId);
    assert.ok(v.status !== 'ACTIVE' || v.refundableUntil <= new Date(), 'BR-14: khong gom voucher ACTIVE con han hoan');
  }
  const again = await api('POST', '/admin/settlements/run-previous-month', undefined, admin);
  assert.equal(again.body.created, 0);

  const noRef = await api('PATCH', `/admin/settlements/${hl._id || hl.id}/mark-paid`, {}, admin);
  assert.equal(noRef.status, 400);
  const paid = await api('PATCH', `/admin/settlements/${hl._id || hl.id}/mark-paid`, { bankTxnRef: 'VCB-2026-001' }, admin);
  assert.equal(paid.body.status, 'PAID');
  const mine = await api('GET', `/brand/${highlands._id}/settlements`, undefined, owner);
  assert.equal(mine.body[0].status, 'PAID');
  assert.equal(mine.body[0].bankTxnRef, 'VCB-2026-001');

  // Ky khong co voucher hop le thi khong sinh phieu
  const empty = await settlements.runSettlement(new Date('2020-01-01'), new Date('2020-02-01'));
  assert.equal(empty.length, 0);
});

// ===================== Luong 4: hoan tien tu dong =====================

async function buyOne(token, title) {
  const c = await campaignByTitle(title);
  const { status, body } = await api('POST', '/orders', { campaignId: String(c._id), quantity: 1 }, token);
  assert.equal(status, 201, JSON.stringify(body));
  await api('POST', `/orders/${body.order.id}/simulate-payment`, {}, token);
  return (await M.VoucherItem.findOne({ orderId: body.order.id })).toJSON();
}

test('Luong 4: cong hoan thanh cong -> REFUNDED, cong tra ton kho, khong vao doi soat', async () => {
  await api('PUT', '/admin/refund-sandbox', { mode: 'success' }, admin);
  const v = await buyOne(customer2, 'Cặp vé xem phim 2D cuối tuần');
  const sold = (await M.Campaign.findById(v.campaignId)).soldQuantity;
  const r = await api('POST', '/refunds', { voucherItemId: v.id, reason: 'Đổi ý' }, customer2);
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'COMPLETED');
  assert.equal(r.body.amount, 150000);
  assert.ok(r.body.paymentRefund.gatewayRefundId.startsWith('SBX-RF-'));
  assert.equal((await M.VoucherItem.findById(v.id)).status, 'REFUNDED');
  assert.equal((await M.Campaign.findById(v.campaignId)).soldQuantity, sold - 1);
  const wallet = await api('GET', '/wallet?tab=REFUNDED', undefined, customer2);
  assert.ok(wallet.body.some((x) => x.id === v.id));
  // Gui lai -> REJECTED kem ly do
  const again = await api('POST', '/refunds', { voucherItemId: v.id }, customer2);
  assert.equal(again.body.status, 'REJECTED');
});

test('Luong 4 N1: cong tu choi -> FAILED, voucher khoi phuc ACTIVE', async () => {
  await api('PUT', '/admin/refund-sandbox', { mode: 'declined' }, admin);
  const v = await buyOne(customer2, 'Cặp vé xem phim 2D cuối tuần');
  const r = await api('POST', '/refunds', { voucherItemId: v.id }, customer2);
  assert.equal(r.body.status, 'FAILED');
  assert.match(r.body.rejectReason, /từ chối/);
  assert.equal((await M.VoucherItem.findById(v.id)).status, 'ACTIVE');
});

test('Luong 4 N2: cong khong phan hoi -> cho quan tri vien; voucher khoa (BR-22); quan tri vien xac nhan da hoan', async () => {
  await api('PUT', '/admin/refund-sandbox', { mode: 'unavailable' }, admin);
  const v = await buyOne(customer2, 'Cặp vé xem phim 2D cuối tuần');
  const r = await api('POST', '/refunds', { voucherItemId: v.id }, customer2);
  assert.equal(r.body.status, 'MANUAL_PENDING');
  assert.equal((await M.VoucherItem.findById(v.id)).status, 'REFUND_PENDING');
  const tok = await api('POST', '/redeem/token', { voucherItemId: v.id }, customer2);
  assert.equal(tok.body.code, 'VOUCHER_REFUND_PENDING');
  const wallet = await api('GET', `/wallet/${v.id}`, undefined, customer2);
  assert.equal(wallet.body.statusLabel, 'Đang hoàn tiền');

  const queue = await api('GET', '/admin/refunds/manual-pending', undefined, admin);
  const row = queue.body.find((x) => x.id === r.body.id);
  assert.ok(row.payment && row.customer.email === 'khach2@voucher.local');
  const done = await api('PATCH', `/admin/refunds/${r.body.id}/confirm-manual`, { gatewayRefundId: 'MB-REF-20261022-0001' }, admin);
  assert.equal(done.status, 200);
  const twice = await api('PATCH', `/admin/refunds/${r.body.id}/confirm-manual`, { gatewayRefundId: 'X' }, admin);
  assert.equal(twice.status, 400);
  assert.equal((await M.VoucherItem.findById(v.id)).status, 'REFUNDED');
  const notes = await api('GET', '/notifications', undefined, customer2);
  assert.ok(notes.body.items.filter((n) => n.title === 'Kết quả hoàn tiền').length >= 3);

  // Khong hoan duoc -> FAILED, voucher khoi phuc
  const v2 = await buyOne(customer2, 'Cặp vé xem phim 2D cuối tuần');
  const r2 = await api('POST', '/refunds', { voucherItemId: v2.id }, customer2);
  await api('PATCH', `/admin/refunds/${r2.body.id}/fail-manual`, { reason: 'Tài khoản khách bị đóng' }, admin);
  assert.equal((await M.VoucherItem.findById(v2.id)).status, 'ACTIVE');
  await api('PUT', '/admin/refund-sandbox', { mode: 'success' }, admin);
});

test('Luong 4 N3: voucher da dung / qua han hoan -> REJECTED kem ly do', async () => {
  const used = await M.VoucherItem.findOne({ status: 'USED', userId: (await M.User.findOne({ email: 'khach@voucher.local' }))._id });
  const r = await api('POST', '/refunds', { voucherItemId: String(used._id) }, customer);
  assert.equal(r.body.status, 'REJECTED');
  assert.match(r.body.rejectReason, /đã được sử dụng/);
  const v = await buyOne(customer2, 'Phiếu mua mỹ phẩm 300.000đ');
  await M.VoucherItem.updateOne({ _id: v.id }, { refundableUntil: new Date(Date.now() - 1000) });
  const late = await api('POST', '/refunds', { voucherItemId: v.id }, customer2);
  assert.equal(late.body.status, 'REJECTED');
  assert.match(late.body.rejectReason, /quá hạn hoàn tiền/);
  const mine = await api('GET', '/refunds/me', undefined, customer2);
  assert.ok(mine.body.length >= 5);
});

test('Danh gia: chi khach da dung voucher moi danh gia, moi chien dich mot lan', async () => {
  const c = await campaignByTitle('Voucher 100.000đ chỉ 80.000đ');
  const notUsed = await api("POST", "/reviews", { campaignId: String(c._id), rating: 5 }, await otpLogin("khach3@voucher.local"));
  assert.equal(notUsed.body.code, 'REVIEW_NOT_ELIGIBLE');
  const ok = await api('POST', '/reviews', { campaignId: String(c._id), rating: 5, comment: 'Ngon' }, customer);
  assert.equal(ok.status, 201);
  const dup = await api('POST', '/reviews', { campaignId: String(c._id), rating: 4 }, customer);
  assert.equal(dup.body.code, 'REVIEW_EXISTS');
  const detail = await api('GET', `/campaigns/${c._id}`);
  assert.equal(detail.body.reviewCount, 1);
});

test('Dang nhap web: bao so lan thu con lai, khoa sau 5 lan sai, dang nhap dung thi dem lai', async () => {
  const email = 'owner@cgv.local';
  const wrong1 = await api('POST', '/auth/login', { email, password: 'sai' });
  assert.equal(wrong1.status, 401);
  assert.match(wrong1.body.message, /Còn 4 lần thử/);
  const ok = await api('POST', '/auth/login', { email, password: 'Voucher@123' });
  assert.equal(ok.status, 200);
  for (let i = 0; i < 4; i++) await api('POST', '/auth/login', { email, password: 'sai' });
  const fifth = await api('POST', '/auth/login', { email, password: 'sai' });
  assert.equal(fifth.body.code, 'LOGIN_LOCKED');
  const lockedRight = await api('POST', '/auth/login', { email, password: 'Voucher@123' });
  assert.equal(lockedRight.body.code, 'LOGIN_LOCKED');
  assert.match(lockedRight.body.message, /Thử lại sau|thử lại sau/);
  const customer = await api('POST', '/auth/login', { email: 'khach@voucher.local', password: 'x' });
  assert.match(customer.body.message, /OTP/);
});
