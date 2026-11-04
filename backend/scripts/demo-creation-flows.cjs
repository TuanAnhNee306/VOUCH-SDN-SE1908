const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '../../artifacts/voucher-creation-demo');
const base = 'http://127.0.0.1:3101/api';
const kind = process.argv[2];
const output = { flow: kind, startedAt: new Date().toISOString(), steps: [], negative: [] };
async function api(method, url, body, token) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function login(email) {
  const r = await api('POST', '/auth/login', { email, password: 'Voucher@123' });
  assert.equal(r.status, 200, 'Demo login failed'); return r.body;
}
function record(actor, action, expected, actual) { output.steps.push({ actor, action, expected, actual, result: 'PASS', at: new Date().toISOString() }); console.log(actor + ' | ' + action + ' | ' + actual + ' | PASS'); }
async function hidden(id, phase) {
  const c = await api('GET', '/campaigns?keyword=DEMO');
  assert.equal(c.status, 200); assert.ok(!c.body.items.some(x => x.id === id));
  assert.equal((await api('GET', '/campaigns/' + id)).status, 404);
  record('Public', 'Catalog at ' + phase, 'hidden', 'hidden');
}
(async () => {
  assert.ok(['cashback', 'stored-value', 'catalog-negative'].includes(kind));
  const owner = await login('owner@highlands.local');
  const brands = await api('GET', '/brand/me', undefined, owner.accessToken);
  assert.equal(brands.status, 200); const brand = brands.body[0]; assert.equal(brand.status, 'APPROVED');
  const stores = await api('GET', '/brand/' + brand.id + '/stores', undefined, owner.accessToken);
  const store = stores.body.find(x => x.status); assert.ok(store);
  if (kind === 'catalog-negative') {
    const previous = JSON.parse(fs.readFileSync(path.join(dir, 'stored-value.json')));
    const id = previous.campaign.id; const admin = await login('admin@voucher.local');
    const url = '/brand/' + brand.id + '/campaigns/' + id;
    const day = 86400000; const now = Date.now();
    for (const [label, dates] of [
      ['APPROVED future start', { saleStartAt: new Date(now + day).toISOString(), saleEndAt: new Date(now + 7 * day).toISOString(), voucherExpireAt: new Date(now + 21 * day).toISOString() }],
      ['APPROVED expired window', { saleStartAt: new Date(now - 30 * day).toISOString(), saleEndAt: new Date(now - 20 * day).toISOString(), voucherExpireAt: new Date(now - 5 * day).toISOString() }],
    ]) {
      const edited = await api('PATCH', url, dates, owner.accessToken); assert.equal(edited.body.status, 'PENDING');
      const approved = await api('PATCH', '/admin/campaigns/' + id + '/approve', {}, admin.accessToken);
      assert.equal(approved.body.status, 'APPROVED'); await hidden(id, label);
    }
    const restored = await api('PATCH', url, { saleStartAt: previous.payload.saleStartAt, saleEndAt: previous.payload.saleEndAt, voucherExpireAt: previous.payload.voucherExpireAt }, owner.accessToken);
    assert.equal(restored.body.status, 'PENDING');
    const final = await api('PATCH', '/admin/campaigns/' + id + '/approve', {}, admin.accessToken);
    assert.equal(final.body.status, 'PUBLISHED');
    const publicAgain = await api('GET', '/campaigns/' + id); assert.equal(publicAgain.status, 200); assert.equal(publicAgain.body.canPurchase, true);
    record('Admin/Public', 'Restore original dates and reapprove', 'PUBLISHED + visible', 'PUBLISHED + visible');
  } else {
    const cashback = kind === 'cashback';
    record('Owner', 'Login and verify brand/store', 'BRAND_OWNER, APPROVED brand, active owned store', owner.user.role + ', ' + brand.status + ', ' + store.name);
    const now = Date.now(), day = 86400000;
    const payload = { title: cashback ? 'DEMO Cashback 50% - Electronics' : 'DEMO Stored Value 200K', voucherType: cashback ? 'CASHBACK' : 'STORED_VALUE',
      description: cashback ? 'Hoàn 50% cho hóa đơn đủ điều kiện. Chương trình giả định trong môi trường demo.' : 'Voucher mệnh giá 200.000 VND, bán với giá 170.000 VND.',
      salePrice: cashback ? 300000 : 170000, totalQuantity: 100, limitPerUser: 1, storeIds: [store.id], categoryId: brand.categoryId,
      saleStartAt: new Date(now - 3600000).toISOString(), saleEndAt: new Date(now + 7 * day).toISOString(), voucherExpireAt: new Date(now + 21 * day).toISOString(),
      terms: cashback ? 'Customer thanh toán đầy đủ hóa đơn tại Merchant; Merchant trực tiếp hoàn Cashback bằng tiền mặt hoặc chuyển khoản sau khi xác minh điều kiện. Marketplace không chi trả khoản Cashback.' : 'Voucher dùng để thanh toán tại Merchant, sử dụng một lần, không hoàn phần giá trị dư; hóa đơn phải có giá trị tối thiểu bằng mệnh giá.',
      ...(cashback ? { cashbackType: 'PERCENTAGE', cashbackValue: 50, maxCashbackAmount: 5000000, minOrderValue: 1000000, refundMethod: 'Tiền mặt hoặc chuyển khoản ngân hàng' } : { faceValue: 200000 }),
    };
    output.payload = payload;
    const createUrl = '/brand/' + brand.id + '/campaigns';
    const other = await login('owner@phuclong.local');
    const badBrand = await api('POST', createUrl, payload, other.accessToken); assert.equal(badBrand.status, 403);
    output.negative.push({ case: 'Owner outside brand', expected: 403, actual: badBrand.status, result: 'PASS' });
    await api('POST', '/auth/logout', {}, other.accessToken);
    const negatives = cashback ? [ ['salePrice=0', { salePrice: 0 }], ['cashbackValue=0', { cashbackValue: 0 }], ['cashbackValue=101', { cashbackValue: 101 }], ['negative cap', { maxCashbackAmount: -1 }], ['quantity=0', { totalQuantity: 0 }] ] : [ ['faceValue=0', { faceValue: 0 }], ['salePrice=0', { salePrice: 0 }], ['salePrice>faceValue', { salePrice: 200001 }], ['quantity=0', { totalQuantity: 0 }], ['cashback fields on stored-value', { cashbackType: 'PERCENTAGE', cashbackValue: 50 }] ];
    for (const [name, patch] of negatives) {
      const r = await api('POST', createUrl, { ...payload, ...patch }, owner.accessToken); assert.equal(r.status, 400, JSON.stringify(r.body));
      output.negative.push({ case: name, expected: 400, actual: r.status, message: r.body.message, result: 'PASS' });
    }
    const created = await api('POST', createUrl, payload, owner.accessToken);
    assert.equal(created.status, 201, JSON.stringify(created.body)); const c = created.body;
    assert.equal(c.status, 'DRAFT'); assert.equal(c.brandId, brand.id); assert.equal(c.salePrice, payload.salePrice); assert.equal(c.voucherType, payload.voucherType); assert.equal(c.totalQuantity, 100);
    if (cashback) { assert.equal(c.faceValue, null); assert.equal(c.cashbackValue, 50); assert.equal(c.maxCashbackAmount, 5000000); }
    else { assert.equal(c.faceValue, 200000); for (const k of ['cashbackType', 'cashbackValue', 'maxCashbackAmount', 'minOrderValue', 'refundMethod']) assert.equal(c[k], null); }
    record('Owner', 'Create ' + payload.voucherType, 'DRAFT with correct financial fields', 'DRAFT');
    await hidden(c.id, 'DRAFT');
    const forged = await api('PATCH', createUrl + '/' + c.id, { status: 'PUBLISHED', approvedBy: owner.user.id }, owner.accessToken);
    assert.equal(forged.status, 200); assert.equal(forged.body.status, 'DRAFT'); assert.equal(forged.body.approvedBy, null);
    const denied = await api('PATCH', '/admin/campaigns/' + c.id + '/approve', {}, owner.accessToken); assert.equal(denied.status, 403);
    output.negative.push({ case: 'Owner cannot self-approve or assign PUBLISHED', expected: 'DRAFT; approvedBy=null; Admin API 403', actual: 'DRAFT; approvedBy=null; Admin API ' + denied.status, result: 'PASS' });
    const submitted = await api('PATCH', createUrl + '/' + c.id + '/submit', {}, owner.accessToken); assert.equal(submitted.body.status, 'PENDING');
    record('Owner', 'Submit for approval', 'PENDING', submitted.body.status); await hidden(c.id, 'PENDING');
    await api('POST', '/auth/logout', {}, owner.accessToken);
    const admin = await login('admin@voucher.local'); assert.equal(admin.user.role, 'ADMIN');
    const pending = await api('GET', '/admin/campaigns?status=PENDING', undefined, admin.accessToken);
    const review = pending.body.find(x => x.id === c.id); assert.ok(review); assert.equal(review.terms, payload.terms); assert.equal(review.salePrice, payload.salePrice); assert.equal(review.totalQuantity, 100); assert.equal(review.voucherType, payload.voucherType);
    record('Admin', 'Inspect pending campaign', 'Matching title/type/price/terms/quantity/dates', review.title);
    const approved = await api('PATCH', '/admin/campaigns/' + c.id + '/approve', {}, admin.accessToken); assert.equal(approved.status, 200, JSON.stringify(approved.body)); assert.equal(approved.body.status, 'PUBLISHED'); assert.equal(approved.body.approvedBy, admin.user.id);
    record('Admin', 'Approve with current sale window', 'APPROVED then automatic PUBLISHED', approved.body.status);
    const catalog = await api('GET', '/campaigns?keyword=' + encodeURIComponent(payload.title)); assert.equal(catalog.status, 200);
    const visible = catalog.body.items.find(x => x.id === c.id); assert.ok(visible); assert.equal(visible.canPurchase, true); assert.equal(visible.availableQuantity, 100);
    const detail = await api('GET', '/campaigns/' + c.id); assert.equal(detail.status, 200); assert.equal(detail.body.terms, payload.terms); assert.equal(detail.body.canPurchase, true);
    record('Public', 'Catalog and public detail', 'Visible, 100 available, canPurchase=true', 'visible; canPurchase=true; no purchase performed');
    output.campaign = { id: c.id, brandId: c.brandId, type: c.voucherType, salePrice: c.salePrice, faceValue: c.faceValue, savingAmount: cashback ? null : c.faceValue-c.salePrice, cashbackPercentage: c.cashbackValue, maxCashbackAmount: c.maxCashbackAmount, totalQuantity: c.totalQuantity, beforeApproval: 'PENDING', afterApproval: approved.body.status, detailUrl: 'http://localhost:5183/campaigns/' + c.id, visibility: true, canPurchase: true };
    output.catalog = visible; output.publicDetail = detail.body;
    await api('POST', '/auth/logout', {}, admin.accessToken);
  }
  output.result = 'PASS'; output.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(dir, kind + '.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ flow: kind, result: output.result, campaign: output.campaign, negativeChecks: output.negative.length }, null, 2));
})().catch(e => { output.result='FAIL'; output.error=e.message; fs.writeFileSync(path.join(dir, kind + '.json'), JSON.stringify(output,null,2)); console.error(e); process.exitCode=1; });
