// Additive catalog for demos. It never deletes existing production/demo data.
const bcrypt = require('bcryptjs');
const M = require('./models');
const { connectDb, disconnectDb } = require('./config/db');
const { foldVietnamese } = require('./services/rules');

const PASSWORD = 'Voucher@123';
const logos = (domain) => `https://logo.clearbit.com/${domain}`;
const catalog = [
  ['Katinat', 'Cà phê & trà', 'katinat.vn', 'Katinat Đồng Khởi', '45 Đồng Khởi, Quận 1, TP.HCM', 'Giảm 25% đồ uống bất kỳ', 15000, 80000],
  ['Gong Cha', 'Cà phê & trà', 'gongcha.com.vn', 'Gong Cha Nguyễn Huệ', '68 Nguyễn Huệ, Quận 1, TP.HCM', 'Mua 1 tặng 1 trà sữa size M', 49000, 98000],
  ['TocoToco', 'Cà phê & trà', 'tocotocotea.com', 'TocoToco Cầu Giấy', '183 Cầu Giấy, Hà Nội', 'Giảm 30% trà sữa', 12000, 70000],
  ['Jollibee', 'Ăn uống', 'jollibee.com.vn', 'Jollibee Nguyễn Trãi', '212 Nguyễn Trãi, Quận 1, TP.HCM', 'Combo gà rán 2 người', 99000, 139000],
  ['Lotteria', 'Ăn uống', 'lotteria.vn', 'Lotteria Vincom Bà Triệu', '191 Bà Triệu, Hà Nội', 'Giảm 50.000đ hóa đơn từ 200.000đ', 10000, 50000],
  ['KFC', 'Ăn uống', 'kfcvietnam.com.vn', 'KFC Lê Văn Sỹ', '223 Lê Văn Sỹ, Quận 3, TP.HCM', 'Combo 2 miếng gà kèm nước', 79000, 119000],
  ['WinMart', 'Mua sắm', 'winmart.vn', 'WinMart Lê Thánh Tôn', '72 Lê Thánh Tôn, Quận 1, TP.HCM', 'Phiếu mua sắm 200.000đ', 180000, 200000],
  ['Bách Hóa Xanh', 'Mua sắm', 'bachhoaxanh.com', 'Bách Hóa Xanh Phan Xích Long', '184 Phan Xích Long, Phú Nhuận, TP.HCM', 'Giảm 30.000đ đơn từ 300.000đ', 5000, 30000],
  ['Watsons', 'Làm đẹp', 'watsons.vn', 'Watsons Crescent Mall', '101 Tôn Dật Tiên, Quận 7, TP.HCM', 'Giảm 20% chăm sóc cá nhân', 10000, 100000],
  ['Hasaki', 'Làm đẹp', 'hasaki.vn', 'Hasaki Nguyễn Trãi', '555 Nguyễn Trãi, Quận 5, TP.HCM', 'Phiếu mỹ phẩm 500.000đ', 430000, 500000],
  ['Galaxy Cinema', 'Giải trí', 'galaxycine.vn', 'Galaxy Cinema Nguyễn Du', '116 Nguyễn Du, Quận 1, TP.HCM', 'Cặp vé 2D kèm bắp nước', 140000, 210000],
  ['Lotte Cinema', 'Giải trí', 'lottecinemavn.com', 'Lotte Cinema Gò Vấp', '242 Nguyễn Văn Lượng, Gò Vấp, TP.HCM', 'Giảm 40% vé xem phim', 10000, 120000],
];

async function run() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const categories = new Map((await M.Category.find()).map((c) => [c.name, c]));
  let created = 0;
  for (const [name, categoryName, domain, storeName, address, deal, price, value] of catalog) {
    const slug = foldVietnamese(name).replace(/\s+/g, '-');
    let owner = await M.User.findOne({ email: `owner+${slug}@voucher.local` });
    if (!owner) owner = await M.User.create({ email: `owner+${slug}@voucher.local`, fullName: `Chủ ${name}`, role: 'BRAND_OWNER', status: 'ACTIVE', passwordHash: hash });
    let brand = await M.Brand.findOne({ name });
    if (!brand) { brand = await M.Brand.create({ ownerUserId: owner._id, name, description: `Ưu đãi chính hãng ${name} trên Voucher Platform`, categoryId: categories.get(categoryName)?._id, contactInfo: 'Hotline thương hiệu', logo: logos(domain), status: 'APPROVED', approvedAt: new Date() }); created++; }
    let store = await M.Store.findOne({ brandId: brand._id, name: storeName });
    if (!store) store = await M.Store.create({ brandId: brand._id, name: storeName, address, latitude: 10.77, longitude: 106.69, phone: '1900 0000', openingHours: '08:00 - 22:00', status: true });
    const title = `${deal} - ${name}`;
    if (!await M.Campaign.exists({ brandId: brand._id, title })) {
      const now = new Date(); const end = new Date(now.getTime() + 90 * 86400000);
      await M.Campaign.create({ brandId: brand._id, categoryId: categories.get(categoryName)?._id, title, description: `Ưu đãi demo áp dụng tại ${storeName}.`, terms: 'Không áp dụng đồng thời cùng ưu đãi khác.', voucherType: 'PREPAID', salePrice: price, faceValue: value, totalQuantity: 500, limitPerUser: 3, saleStartAt: now, saleEndAt: end, voucherExpireAt: new Date(end.getTime() + 60 * 86400000), status: 'PUBLISHED', storeIds: [store._id], searchText: foldVietnamese(`${title} ${name}`) });
    }
  }
  console.log(`[catalog] Added ${created} brands; catalog is ready.`);
}

connectDb().then(run).then(disconnectDb).catch(async (e) => { console.error(e); await disconnectDb(); process.exit(1); });
