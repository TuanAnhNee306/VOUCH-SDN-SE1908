// Du lieu mau de demo. Chay `npm run seed` de xoa sach va nap lai; may chu tu nap khi CSDL con trong (AUTO_SEED).
// Mat khau cac tai khoan web: Voucher@123. Khach hang dang nhap bang OTP (MAIL_MODE=console in ma ra man hinh may chu).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const M = require('./models');
const { foldVietnamese, refundableUntil } = require('./services/rules');
const { DAY_MS, VN_OFFSET_MS, previousVnMonth } = require('./utils/time');

const PASSWORD = 'Voucher@123';

// vn(0) = 00:00 hom nay gio VN; vn(3, '23:59') = 23:59 cua 3 ngay nua
function vn(offsetDays, hhmm = '00:00', base = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const v = new Date(base.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate() + offsetDays, h, m) - VN_OFFSET_MS);
}
const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);
const oid = () => new mongoose.Types.ObjectId();

async function seed() {
  await Promise.all(Object.values(M).map((Model) => Model.deleteMany({})));
  await Promise.all(Object.values(M).map((Model) => Model.syncIndexes()));
  const hash = await bcrypt.hash(PASSWORD, 10);

  const cat = {};
  for (const [key, name, icon, displayOrder] of [
    ['cafe', 'Cà phê & trà', 'coffee', 1], ['food', 'Ăn uống', 'restaurant', 2], ['beauty', 'Làm đẹp', 'spa', 3],
    ['movie', 'Giải trí', 'movie', 4], ['shopping', 'Mua sắm', 'shopping_bag', 5],
  ]) cat[key] = await M.Category.create({ name, icon, displayOrder });

  const user = async (email, fullName, role, extra = {}) =>
    M.User.create({ email, fullName, role, passwordHash: role === 'CUSTOMER' ? null : hash, status: 'ACTIVE', ...extra });
  const admin = await user('admin@voucher.local', 'Quản trị viên', 'ADMIN');
  const customer = await user('khach@voucher.local', 'Khách hàng mẫu', 'CUSTOMER', { phone: '0900000000' });
  const customer2 = await user('khach2@voucher.local', 'Trần Gia Hân', 'CUSTOMER', { phone: '0911111111' });
  const owners = {
    highlands: await user('owner@highlands.local', 'Chủ Highlands', 'BRAND_OWNER'),
    phuclong: await user('owner@phuclong.local', 'Chủ Phúc Long', 'BRAND_OWNER'),
    pizza: await user('owner@pizza4ps.local', "Chủ Pizza 4P's", 'BRAND_OWNER'),
    guardian: await user('owner@guardian.local', 'Chủ Guardian', 'BRAND_OWNER'),
    cgv: await user('owner@cgv.local', 'Chủ CGV', 'BRAND_OWNER'),
    circlek: await user('owner@circlek.local', 'Chủ Circle K', 'BRAND_OWNER'),
  };
  const staff = {
    highlands: await user('staff@highlands.local', 'Nhân viên Lê Lợi', 'STORE_STAFF'),
    phuclong: await user('staff@phuclong.local', 'Nhân viên Phúc Long', 'STORE_STAFF'),
    pizza: await user('staff@pizza4ps.local', "Nhân viên Pizza 4P's", 'STORE_STAFF'),
    guardian: await user('staff@guardian.local', 'Nhân viên Guardian', 'STORE_STAFF'),
    cgv: await user('staff@cgv.local', 'Nhân viên CGV', 'STORE_STAFF'),
  };

  const brand = async (key, name, description, category, contactInfo, bankInfo, logo, status = 'APPROVED') =>
    M.Brand.create({ ownerUserId: owners[key]._id, name, description, categoryId: category._id, contactInfo, bankInfo, logo, status, approvedAt: status === 'APPROVED' ? vn(-45) : null });
  const B = {
    highlands: await brand('highlands', 'Highlands Coffee', 'Chuỗi cà phê Việt Nam', cat.cafe, '1900 1755', 'VCB 0123456789 - CONG TY HIGHLANDS', '/brands/highlands.png'),
    phuclong: await brand('phuclong', 'Phúc Long', 'Trà và cà phê Việt Nam', cat.cafe, '1800 6779', 'TCB 1902 8888 666 - CONG TY PHUC LONG', '/brands/phuclong.png'),
    pizza: await brand('pizza', "Pizza 4P's", 'Nhà hàng pizza phong cách Nhật - Ý', cat.food, '1900 6043', 'ACB 2468 1357 99 - CONG TY 4P', '/brands/pizza4ps.jpg'),
    guardian: await brand('guardian', 'Guardian', 'Chuỗi cửa hàng mỹ phẩm và chăm sóc sức khỏe', cat.beauty, '1900 6865', 'BIDV 3141 5926 53 - CONG TY GUARDIAN', '/brands/guardian.png'),
    cgv: await brand('cgv', 'CGV Cinemas', 'Hệ thống rạp chiếu phim toàn quốc', cat.movie, '1900 6017', 'VCB 0071 0004 2424 - CONG TY CGV', '/brands/cgv.png'),
    circlek: await brand('circlek', 'Circle K', 'Chuỗi cửa hàng tiện lợi 24/7', cat.shopping, '1900 6016', null, null, 'PENDING'),
  };

  const store = (b, name, address, latitude, longitude, phone, openingHours) =>
    M.Store.create({ brandId: B[b]._id, name, address, latitude, longitude, phone, openingHours, status: true });
  const S = {
    hlLeLoi: await store('highlands', 'Highlands Lê Lợi', '135 Lê Lợi, Bến Thành, Quận 1, TP.HCM', 10.7725, 106.698, '02838220000', '07:00 - 22:00'),
    hlNguyenHue: await store('highlands', 'Highlands Nguyễn Huệ', '20 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM', 10.774, 106.7035, '02838221111', '07:00 - 23:00'),
    plLeVanSy: await store('phuclong', 'Phúc Long Lê Văn Sỹ', '285 Lê Văn Sỹ, Phường 1, Tân Bình, TP.HCM', 10.792, 106.669, '02839912345', '06:30 - 22:30'),
    plHoGuom: await store('phuclong', 'Phúc Long Hồ Gươm', '15 Lê Thái Tổ, Hàng Trống, Hoàn Kiếm, Hà Nội', 21.0294, 105.852, '02438260123', '07:00 - 23:00'),
    plPhanXichLong: await store('phuclong', 'Phúc Long Phan Xích Long', '192 Phan Xích Long, Phường 2, Phú Nhuận, TP.HCM', 10.8005, 106.688, '02839956677', '07:00 - 22:00'),
    pzLeThanhTon: await store('pizza', "Pizza 4P's Lê Thánh Tôn", '8/15 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM', 10.7795, 106.703, '02838221234', '10:00 - 22:00'),
    pzLyQuocSu: await store('pizza', "Pizza 4P's Lý Quốc Sư", '11 Lý Quốc Sư, Hàng Trống, Hoàn Kiếm, Hà Nội', 21.0287, 105.8486, '02438287777', '10:00 - 22:00'),
    gdNguyenTrai: await store('guardian', 'Guardian Nguyễn Trãi', '180 Nguyễn Trãi, Phạm Ngũ Lão, Quận 1, TP.HCM', 10.766, 106.6895, '02839201122', '08:00 - 22:00'),
    gdBaTrieu: await store('guardian', 'Guardian Vincom Bà Triệu', '191 Bà Triệu, Lê Đại Hành, Hai Bà Trưng, Hà Nội', 21.0105, 105.8495, '02439743355', '09:30 - 22:00'),
    gdCrescent: await store('guardian', 'Guardian Crescent Mall', '101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM', 10.729, 106.719, '02854134466', '09:30 - 22:00'),
    cgvDongKhoi: await store('cgv', 'CGV Vincom Đồng Khởi', '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM', 10.7795, 106.701, '02839369999', '09:00 - 23:30'),
    cgvNguyenChiThanh: await store('cgv', 'CGV Vincom Nguyễn Chí Thanh', '54A Nguyễn Chí Thanh, Láng Thượng, Đống Đa, Hà Nội', 21.0225, 105.8085, '02432668888', '09:00 - 23:30'),
    ckNguyenHue: await store('circlek', 'Circle K Nguyễn Huệ', '42 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM', 10.7745, 106.704, '02838272727', '24/24'),
  };

  for (const [u, s] of [
    ['highlands', 'hlLeLoi'], ['highlands', 'hlNguyenHue'], ['phuclong', 'plLeVanSy'], ['phuclong', 'plPhanXichLong'],
    ['pizza', 'pzLeThanhTon'], ['guardian', 'gdNguyenTrai'], ['cgv', 'cgvDongKhoi'],
  ]) await M.StaffAssignment.create({ userId: staff[u]._id, storeId: S[s]._id, active: true });

  const C = {};
  const campaign = async (key, b, data, stores) => {
    C[key] = await M.Campaign.create({
      brandId: B[b]._id, limitPerUser: 5, soldQuantity: 0, reservedQuantity: 0, ...data,
      storeIds: stores.map((s) => S[s]._id), searchText: foldVietnamese(`${data.title} ${B[b].name}`),
    });
  };
  const sale = (start, end, expireAfter) => ({ saleStartAt: vn(start), saleEndAt: vn(end, '23:59'), voucherExpireAt: addDays(vn(end, '23:59'), expireAfter) });

  // --- Highlands: luong mau trong tai lieu demo ---
  await campaign('hlPrepaid', 'highlands', {
    categoryId: cat.cafe._id, title: 'Voucher 100.000đ chỉ 80.000đ', voucherType: 'PREPAID', description: 'Dùng cho mọi đồ uống tại Highlands',
    terms: 'Dùng một lần, không hoàn phần dư (BR-03)', salePrice: 80000, faceValue: 100000, totalQuantity: 200, status: 'PUBLISHED', ...sale(-40, 150, 90),
  }, ['hlLeLoi', 'hlNguyenHue']);
  await campaign('hlCombo', 'highlands', {
    categoryId: cat.cafe._id, title: 'Combo bánh mì + cà phê sữa', voucherType: 'COMBO', comboItems: '1 bánh mì que, 1 phin sữa đá size M',
    description: '1 bánh mì que + 1 phin sữa đá', salePrice: 45000, faceValue: 59000, totalQuantity: 100, status: 'DRAFT', ...sale(0, 150, 90),
  }, ['hlLeLoi']);
  await campaign('hlDiscount', 'highlands', {
    categoryId: cat.cafe._id, title: 'Giảm 20% Phindi', voucherType: 'DISCOUNT', discountType: 'PERCENT', discountValue: 20, maxDiscount: 15000,
    salePrice: 10000, faceValue: 15000, totalQuantity: 300, limitPerUser: 3, status: 'PENDING', submittedAt: vn(-1, '09:00'), ...sale(0, 150, 90),
  }, ['hlNguyenHue']);

  // --- Phuc Long ---
  await campaign('plCombo', 'phuclong', {
    categoryId: cat.cafe._id, title: 'Trà sữa Phúc Long mua 1 tặng 1', voucherType: 'COMBO', comboItems: '2 ly trà sữa Phúc Long size L',
    description: 'Áp dụng cả ngày, kể cả cuối tuần', terms: 'Mỗi lượt dùng một voucher, không quy đổi thành tiền mặt',
    salePrice: 55000, faceValue: 110000, totalQuantity: 500, soldQuantity: 124, status: 'PUBLISHED', ...sale(-20, 120, 60),
  }, ['plLeVanSy', 'plHoGuom', 'plPhanXichLong']);
  await campaign('plDiscount', 'phuclong', {
    categoryId: cat.cafe._id, title: 'Giảm 30% toàn bộ menu trà', voucherType: 'DISCOUNT', discountType: 'PERCENT', discountValue: 30, maxDiscount: 30000,
    description: 'Giảm 30% cho hóa đơn trà bất kỳ', terms: 'Không áp dụng cùng chương trình khuyến mãi khác',
    salePrice: 15000, faceValue: 30000, totalQuantity: 200, soldQuantity: 198, limitPerUser: 2, status: 'PUBLISHED', ...sale(-30, 90, 45),
  }, ['plLeVanSy', 'plPhanXichLong']);
  await campaign('plPrepaid', 'phuclong', {
    categoryId: cat.cafe._id, title: 'Phiếu 200.000đ dùng tại Phúc Long', voucherType: 'PREPAID', description: 'Dùng cho mọi đồ uống và bánh tại Phúc Long',
    terms: 'Dùng một lần, không hoàn phần dư', salePrice: 160000, faceValue: 200000, totalQuantity: 150, soldQuantity: 42, status: 'PUBLISHED', ...sale(-25, 3, 30),
  }, ['plLeVanSy', 'plHoGuom', 'plPhanXichLong']);

  // --- Pizza 4P's ---
  await campaign('pzPrepaid', 'pizza', {
    categoryId: cat.food._id, title: "Phiếu ăn uống 500.000đ tại Pizza 4P's", voucherType: 'PREPAID', description: 'Áp dụng cho toàn bộ thực đơn, kể cả đồ uống',
    terms: 'Không áp dụng vào ngày lễ, cần đặt bàn trước', salePrice: 420000, faceValue: 500000, totalQuantity: 300, soldQuantity: 68, limitPerUser: 3, status: 'PUBLISHED', ...sale(-10, 150, 60),
  }, ['pzLeThanhTon', 'pzLyQuocSu']);
  await campaign('pzCombo', 'pizza', {
    categoryId: cat.food._id, title: 'Combo 2 pizza cỡ M kèm 2 nước ép', voucherType: 'COMBO', comboItems: '2 pizza size M tùy chọn, 2 nước ép trái cây',
    description: 'Combo cho 2 người', terms: 'Dùng tại chỗ, không áp dụng mang về', salePrice: 350000, faceValue: 460000, totalQuantity: 100, soldQuantity: 100, limitPerUser: 2, status: 'SOLD_OUT', ...sale(-40, 60, 40),
  }, ['pzLeThanhTon', 'pzLyQuocSu']);
  await campaign('pzDiscount', 'pizza', {
    categoryId: cat.food._id, title: 'Giảm 100.000đ cho hóa đơn từ 500.000đ', voucherType: 'DISCOUNT', discountType: 'AMOUNT', discountValue: 100000,
    description: 'Giảm trực tiếp trên hóa đơn', terms: 'Áp dụng cho hóa đơn từ 500.000đ, mỗi bàn một voucher',
    salePrice: 20000, faceValue: 100000, totalQuantity: 200, soldQuantity: 88, limitPerUser: 1, status: 'PUBLISHED', ...sale(-18, 30, 10),
  }, ['pzLeThanhTon']);

  // --- Guardian ---
  await campaign('gdPrepaid', 'guardian', {
    categoryId: cat.beauty._id, title: 'Phiếu mua mỹ phẩm 300.000đ', voucherType: 'PREPAID', description: 'Áp dụng cho toàn bộ sản phẩm tại Guardian',
    terms: 'Không áp dụng cho sản phẩm đang giảm giá', salePrice: 250000, faceValue: 300000, totalQuantity: 400, soldQuantity: 33, status: 'PUBLISHED', ...sale(-5, 100, 90),
  }, ['gdNguyenTrai', 'gdBaTrieu', 'gdCrescent']);
  await campaign('gdDiscount', 'guardian', {
    categoryId: cat.beauty._id, title: 'Giảm 25% sản phẩm chăm sóc da', voucherType: 'DISCOUNT', discountType: 'PERCENT', discountValue: 25, maxDiscount: 50000,
    description: 'Giảm 25% nhóm hàng chăm sóc da', terms: 'Mỗi hóa đơn dùng tối đa một voucher', salePrice: 12000, faceValue: 50000, totalQuantity: 250, soldQuantity: 11, limitPerUser: 2, status: 'PAUSED', ...sale(-15, 80, 30),
  }, ['gdNguyenTrai', 'gdCrescent']);
  await campaign('gdCombo', 'guardian', {
    categoryId: cat.beauty._id, title: 'Combo sữa rửa mặt và kem chống nắng', voucherType: 'COMBO', comboItems: '1 sữa rửa mặt 100ml, 1 kem chống nắng SPF50',
    description: 'Bộ đôi chăm sóc da hằng ngày', terms: 'Đổi tại quầy, không đổi sang sản phẩm khác', salePrice: 199000, faceValue: 280000, totalQuantity: 120, soldQuantity: 118, limitPerUser: 2, status: 'ENDED', ...sale(-60, -5, 30),
  }, ['gdNguyenTrai', 'gdBaTrieu']);

  // --- CGV ---
  await campaign('cgvCombo', 'cgv', {
    categoryId: cat.movie._id, title: 'Cặp vé xem phim 2D cuối tuần', voucherType: 'COMBO', comboItems: '2 vé 2D ghế thường, 1 bắp rang và 2 nước ngọt',
    description: 'Áp dụng thứ Bảy và Chủ nhật', terms: 'Không áp dụng cho suất chiếu đặc biệt và phim 3D', salePrice: 150000, faceValue: 220000, totalQuantity: 600, soldQuantity: 234, limitPerUser: 4, status: 'PUBLISHED', ...sale(-25, 70, 45),
  }, ['cgvDongKhoi', 'cgvNguyenChiThanh']);
  await campaign('cgvDiscount', 'cgv', {
    categoryId: cat.movie._id, title: 'Giảm 40% vé xem phim ngày thường', voucherType: 'DISCOUNT', discountType: 'PERCENT', discountValue: 40, maxDiscount: 60000,
    description: 'Áp dụng từ thứ Hai đến thứ Sáu', terms: 'Không áp dụng ngày lễ, tết và suất chiếu sớm', salePrice: 10000, faceValue: 60000, totalQuantity: 1000, limitPerUser: 4,
    status: 'PENDING', submittedAt: vn(-1, '09:30'), ...sale(5, 95, 40),
  }, ['cgvDongKhoi', 'cgvNguyenChiThanh']);
  await campaign('cgvPrepaid', 'cgv', {
    categoryId: cat.movie._id, title: 'Phiếu bắp nước 100.000đ', voucherType: 'PREPAID', description: 'Dùng tại quầy bắp nước của CGV', terms: 'Dùng một lần, không hoàn phần dư',
    salePrice: 80000, faceValue: 100000, totalQuantity: 350, status: 'APPROVED', submittedAt: vn(-2, '15:00'), approvedBy: admin._id, approvedAt: vn(-1, '10:00'), ...sale(2, 92, 35),
  }, ['cgvDongKhoi']);

  await M.SystemConfig.create({ key: 'commission_rate', value: '0.1', updatedBy: admin._id });

  // --- Don da thanh toan: khach mau co 1 voucher con han hoan; thang truoc co don de demo chot doi soat ---
  const buy = async (u, c, quantity, paidAt, statuses = []) => {
    const order = await M.Order.create({
      userId: u._id, campaignId: c._id, quantity, unitPrice: c.salePrice, totalAmount: c.salePrice * quantity, commissionRate: 0.1,
      status: 'FULFILLED', paymentOrderCode: String(paidAt.getTime() * 1000 + crypto.randomInt(0, 1000)), reservedUntil: new Date(paidAt.getTime() + 15 * 60000), paidAt,
      createdAt: new Date(paidAt.getTime() - 60000),
    });
    await M.Payment.create({ orderId: order._id, gateway: 'SEED', gatewayTxnId: `SEED-${order._id}`, amount: order.totalAmount, status: 'SUCCESS' });
    const until = refundableUntil(paidAt, c.voucherExpireAt);
    const items = [];
    for (let i = 0; i < quantity; i++) {
      const status = statuses[i] || 'ACTIVE';
      items.push(await M.VoucherItem.create({
        orderId: order._id, campaignId: c._id, brandId: c.brandId, userId: u._id, code: `VC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        unitPrice: c.salePrice, status, issuedAt: paidAt, usedAt: status === 'USED' ? addDays(paidAt, 2) : null, expireAt: c.voucherExpireAt, refundableUntil: until,
      }));
    }
    await M.Campaign.updateOne({ _id: c._id }, { $inc: { soldQuantity: quantity } });
    return items;
  };

  const seedVoucher = await buy(customer, C.hlPrepaid, 1, vn(-1, '10:00'));
  await M.VoucherItem.updateOne({ _id: seedVoucher[0]._id }, { code: 'HL-SEED-0001' });

  const { start: prevStart, end: prevEnd } = previousVnMonth();
  const early = new Date(prevStart.getTime() + 9 * DAY_MS + 10 * 3600000);
  const used = await buy(customer2, C.hlPrepaid, 3, early, ['USED', 'ACTIVE', 'ACTIVE']);
  await M.RedemptionLog.create({ voucherItemId: used[0]._id, storeId: S.hlLeLoi._id, staffUserId: staff.highlands._id, billAmount: 120000, method: 'QR', redeemedAt: used[0].usedAt });
  // Mua cuoi thang truoc: con trong han hoan -> KHONG vao phieu doi soat (BR-14)
  await buy(customer2, C.hlPrepaid, 1, new Date(prevEnd.getTime() - DAY_MS));
  await buy(customer2, C.plCombo, 2, new Date(prevStart.getTime() + 5 * DAY_MS), ['USED', 'USED']);
  await M.Review.create({ campaignId: C.plCombo._id, userId: customer2._id, rating: 5, comment: 'Trà sữa ngon, nhân viên quét mã nhanh.' });

  return { campaigns: Object.keys(C).length, stores: Object.keys(S).length };
}

async function seedIfEmpty() {
  if (await M.User.exists({ role: 'ADMIN' })) return;
  const r = await seed();
  console.log(`[seed] Da nap du lieu mau: ${r.campaigns} chien dich, ${r.stores} chi nhanh. Mat khau web: ${PASSWORD}`);
}

module.exports = { seed, seedIfEmpty, PASSWORD };

if (require.main === module) {
  const { connectDb, disconnectDb } = require('./config/db');
  connectDb()
    .then(seed)
    .then(async (r) => {
      console.log(`[seed] Da xoa va nap lai du lieu mau: ${r.campaigns} chien dich, ${r.stores} chi nhanh. Mat khau web: ${PASSWORD}`);
      await disconnectDb();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('[seed] That bai:', e);
      await disconnectDb().catch(() => {});
      process.exit(1);
    });
}
