# CODEX TASK — Deploy Vouch lên Render với catalog mới: Giảm giá và Hoàn tiền

> Đây là yêu cầu bàn giao để assistant trong cuộc trò chuyện mới thực hiện. Người dùng hiện chỉ yêu cầu viết file Markdown này, chưa yêu cầu deploy trong phiên tạo file. Chưa có URL deployment được xác minh. Không coi các tên service minh họa dưới đây là service đã tồn tại.

## 1. Mục tiêu cần thực hiện

Hãy giúp tôi triển khai dự án **Vouch — Voucher Marketplace** thành website public truy cập được từ Internet, ưu tiên **Render**, gồm Customer Marketplace và Management Portal.

Thực hiện công việc đến khi có URL hoạt động và kiểm tra được các luồng chính. Không chỉ viết hướng dẫn hoặc dừng ở frontend build. Nếu thiếu tài khoản/kết nối hosting, MongoDB hoặc mail provider, hoàn tất phần chuẩn bị trong repo và hỏi đúng thông tin còn thiếu; không yêu cầu tôi gửi secrets qua chat.

**Yêu cầu dữ liệu:**

- Sử dụng bộ voucher mới đã được tạo trong quá trình phát triển; không sử dụng catalog từ seed mặc định cũ làm dữ liệu chạy web.
- Dựa trên thương hiệu, chi nhánh và phong cách dữ liệu mới để bổ sung voucher hợp lý.
- Catalog public chỉ có **hai loại: Giảm giá (`DISCOUNT`) và Hoàn tiền (`CASHBACK`)**.
- Không có voucher combo, mua một tặng một, gói ghép sản phẩm; không đưa `COMBO`, `PREPAID` hoặc `STORED_VALUE` vào catalog deployment mới.
- “Giảm giá” ở yêu cầu này là giảm phần trăm hoặc số tiền trực tiếp khi dùng voucher, **không phải voucher mệnh giá/STORED_VALUE**.
- Không xóa dữ liệu local, lịch sử mua hàng hoặc production hiện có để đạt yêu cầu này.

## 2. Workspace và công nghệ

```text
C:\Users\PC\Downloads\VOUCH-SDN-SE1925-main\VOUCH-SDN-SE1925-main
```

Repository remote đã quan sát:

```text
https://github.com/TuanAnhNee306/VOUCH-SDN-SE1925.git
```

Đối chiếu remote/branch/commit thực tế trước khi deploy. Repo local đang có nhiều file sửa và file mới chưa commit; không mặc định GitHub đã chứa các thay đổi này. Không tự commit/push khi chưa được người dùng cho phép; chuẩn bị diff và nội dung cụ thể trước khi hỏi bước đó nếu cần.

- Frontend: React 18, Vite, React Router; thư mục `frontend`.
- Backend: Node.js >=20, Express, Mongoose; thư mục `backend`.
- MongoDB: dùng **MongoDB Atlas/database bền vững** khi deploy, không dùng MongoDB nhúng trên filesystem Render.
- Local gần nhất: frontend cổng 5173, backend cổng 3000. Kiểm tra lại trạng thái hiện tại.

## 3. Audit trước khi sửa

Đọc hướng dẫn `AGENTS.md` nếu có và kiểm tra các file:

```text
backend/src/server.js
backend/src/config/db.js
backend/src/models/index.js
backend/src/utils/enums.js
backend/src/services/rules.js
backend/src/services/campaign.js
backend/src/services/catalog.js
backend/src/seed.js
backend/src/seed-catalog.js
frontend/src/api/client.js
frontend/src/customer/MarketplaceUI.jsx
frontend/src/web/Brand.jsx
frontend/src/utils/catalog.js
```

Các điểm đã phát hiện, cần xác minh lại:

1. `backend/src/seed.js` gọi `deleteMany` trên các model khi chạy seed. **Không chạy `npm run seed` cho deployment này.**
2. `backend/src/seed-catalog.js` hiện có 24 thương hiệu nhưng tạo campaign `PREPAID`, chứa tiêu đề combo/mua tặng. **Không bật `SEED_CATALOG_ON_START=true` hoặc dùng script này nguyên trạng.**
3. `backend/src/services/rules.js` có `NEW_VOUCHER_TYPES = ['CASHBACK', 'STORED_VALUE']`; `campaign.create()` hiện từ chối tạo `DISCOUNT`. Phải điều chỉnh luồng tạo mới theo yêu cầu hai loại, không chỉ sửa nhãn hoặc JSON nhập liệu.
4. Enum vẫn có loại legacy. Có thể giữ để đọc lịch sử; không cần đổi toàn bộ lịch sử đơn/voucher sang loại mới.
5. `frontend/src/api/client.js` hỗ trợ `VITE_API_URL` là origin backend, ví dụ `https://vouch-api-xxx.onrender.com`, **không thêm `/api`** vì client tự thêm.
6. `/api/health` trả `status` và `db`; health check thành công cần xác minh `db=up` và kết nối đúng Atlas. HTTP 200 một mình chưa đủ chứng minh đúng database.
7. `connectDb()` hiện tự fallback MongoDB nhúng khi kết nối lỗi và có nhánh log URI chưa che ở đường lỗi. Trước deploy, thêm chế độ production fail-fast khi thiếu/sai MONGO_URI, không fallback và không log credentials/URI đầy đủ.
8. Backend chưa thấy cấu hình Express `trust proxy`. Kiểm tra proxy thực tế của Render để `req.ip` phục vụ rate limit đúng; không tin tùy ý `X-Forwarded-For` từ client và không bật `trust proxy=true` thiếu đánh giá.

## 4. Xác định và sử dụng dữ liệu mới

Không suy đoán rằng `seed-catalog.js` hoặc một JSON artifact là toàn bộ dữ liệu người dùng đã tạo.

Trước tiên kiểm tra read-only database mà backend local đang dùng, tài khoản/brand/campaign liên quan và các artifact:

```text
artifacts/voucher-creation-demo/database-evidence.json
artifacts/voucher-creation-demo/cashback.json
artifacts/voucher-creation-demo/stored-value.json
artifacts/voucher-creation-demo/runtime.json
```

Artifact hiện có chứa ví dụ `DEMO Cashback 50% - Electronics`, `DEMO Stored Value 200K` và bản ghi thử khác. Đây là bằng chứng thao tác trước, **không phải bản export production đã được làm sạch**. Có trường hợp tiêu đề electronics gắn thương hiệu cà phê; không mang nguyên lỗi ngữ nghĩa này lên catalog public.

Quy trình:

1. Xuất snapshot dữ liệu mới cần dùng vào file riêng, loại thông tin nhạy cảm khỏi file review. Không đưa session/token/passwordHash/OTP/mail credentials lên Git.
2. Ghi manifest nguồn: campaign, brand, store, category và quan hệ owner cần giữ; phân biệt voucher mới có ý nghĩa với bản ghi gõ thử, seed cũ, combo, mệnh giá.
3. Giữ nguyên voucher giảm giá/hoàn tiền mới hợp lệ. Loại các loại khác khỏi **tập nhập deployment**, không xóa bản gốc local. Không đổi STORED_VALUE thành DISCOUNT chỉ bằng sửa voucherType vì quyền lợi khác nhau.
4. Ưu tiên một **database deployment mới**, ví dụ `vouch_web_catalog_v1`, tách database local và database cũ. Chỉ nhập manifest đã duyệt và các bản ghi hỗ trợ cần thiết. Cách này tránh hiển thị lại campaign seed mà không xóa lịch sử.
5. Viết importer riêng, ví dụ `backend/src/import-deploy-catalog.js`, cùng manifest JSON. Đây là file cần tạo ở lượt triển khai, hiện chưa tồn tại chỉ vì được nhắc trong tài liệu.
6. Importer phải có dry-run/validate, khóa định danh ổn định và idempotent. Chạy hai lần không nhân đôi; không reset soldQuantity/reservedQuantity/purchaseCounts, hạn dùng hoặc password của bản ghi đã có giao dịch.
7. Import đúng dependency: category → account cần thiết → brand → store/assignment → campaign. Giữ/ref-map ObjectId nhất quán. Không copy tất cả User/order/session từ local nếu không cần.
8. Validate bằng rules hiện có và thêm kiểm tra nghiệp vụ; không bypass validation bằng insert trực tiếp những payload mà form/API không tạo được.
9. Backup trước khi import vào database đã có dữ liệu. Nếu phát hiện sai database/manifest, dừng trước mutation.

Tài khoản quản lý cần dùng phải được giữ hoặc provision một lần bằng cơ chế riêng, không chạy seed catalog cũ để lấy tài khoản. Không đổi mật khẩu tài khoản đang tồn tại. Nếu triển khai demo dùng tài khoản demo công khai, giới hạn dữ liệu demo và báo rõ; production thực dùng mật khẩu riêng được nhập qua env an toàn.

## 5. Dữ liệu bổ sung đề xuất — 32 voucher, hai loại

Danh sách dưới đây là **dữ liệu demo giả định**, không phải chương trình thật hoặc xác nhận hợp tác với thương hiệu. Dựa trên các thương hiệu/chi nhánh xuất hiện trong catalog phát triển. Khi nhập, ưu tiên ID brand/store thực tế; không tạo thương hiệu trùng tên. Ghi nhãn dữ liệu demo phù hợp, tránh khẳng định ưu đãi đang được thương hiệu cung cấp thật.

Đơn vị tiền: VND. “Giá voucher” là số tiền mua voucher, khác với giá trị quyền lợi và hóa đơn tối thiểu.

### Giảm giá — DISCOUNT (16 voucher)

`discountType=PERCENT` cho phần trăm, `AMOUNT` cho số tiền. Với loại AMOUNT, quyền lợi không vượt hóa đơn tối thiểu. Các số dưới đây cần được validate với rules hiện tại.

| Mã import ổn định | Thương hiệu | Tiêu đề demo | Giá voucher | Quyền lợi | Hóa đơn từ | Trần giảm |
|---|---|---|---:|---|---:|---:|
| DC-HIGHLANDS-20 | Highlands Coffee | Giảm 20% đồ uống | 10000 | PERCENT 20 | 80000 | 30000 |
| DC-PHUCLONG-25 | Phúc Long | Giảm 25% trà và cà phê | 12000 | PERCENT 25 | 100000 | 40000 |
| DC-KATINAT-25 | Katinat | Giảm 25% đồ uống | 12000 | PERCENT 25 | 100000 | 40000 |
| DC-GONGCHA-20 | Gong Cha | Giảm 20% trà sữa | 10000 | PERCENT 20 | 100000 | 35000 |
| DC-TOCOTOCO-30 | TocoToco | Giảm 30% đồ uống | 10000 | PERCENT 30 | 80000 | 40000 |
| DC-TCH-30K | The Coffee House | Giảm 30.000đ hóa đơn | 10000 | AMOUNT 30000 | 120000 | — |
| DC-JOLLIBEE-25K | Jollibee | Giảm 25.000đ hóa đơn | 8000 | AMOUNT 25000 | 100000 | — |
| DC-LOTTERIA-50K | Lotteria | Giảm 50.000đ hóa đơn | 15000 | AMOUNT 50000 | 200000 | — |
| DC-KFC-20 | KFC | Giảm 20% hóa đơn ăn uống | 15000 | PERCENT 20 | 150000 | 50000 |
| DC-POPEYES-40K | Popeyes | Giảm 40.000đ hóa đơn | 12000 | AMOUNT 40000 | 180000 | — |
| DC-MARUKAME-15 | Marukame Udon | Giảm 15% hóa đơn | 10000 | PERCENT 15 | 150000 | 40000 |
| DC-GOGI-100K | Gogi House | Giảm 100.000đ hóa đơn | 30000 | AMOUNT 100000 | 500000 | — |
| DC-WINMART-30K | WinMart | Giảm 30.000đ mua sắm | 8000 | AMOUNT 30000 | 300000 | — |
| DC-WATSONS-15 | Watsons | Giảm 15% chăm sóc cá nhân | 15000 | PERCENT 15 | 250000 | 70000 |
| DC-HASAKI-50K | Hasaki | Giảm 50.000đ mỹ phẩm | 15000 | AMOUNT 50000 | 300000 | — |
| DC-GALAXY-25 | Galaxy Cinema | Giảm 25% vé phim 2D | 12000 | PERCENT 25 | 120000 | 50000 |

### Hoàn tiền — CASHBACK (16 voucher)

`cashbackType=PERCENTAGE` hoặc `FIXED` phải đối chiếu enum/validator thực tế trước khi dùng; không đoán tên mã. Quyền lợi phần trăm phải có maxCashbackAmount. Cashback do Merchant trực tiếp hoàn sau khi xác minh, không tự trừ vào tiền mua voucher hoặc hóa đơn.

| Mã import ổn định | Thương hiệu | Tiêu đề demo | Giá voucher | Quyền lợi | Hóa đơn từ | Trần hoàn |
|---|---|---|---:|---|---:|---:|
| CB-HIGHLANDS-15 | Highlands Coffee | Hoàn 15% đồ uống | 10000 | PERCENTAGE 15 | 150000 | 40000 |
| CB-PHUCLONG-20 | Phúc Long | Hoàn 20% trà và cà phê | 15000 | PERCENTAGE 20 | 150000 | 50000 |
| CB-KATINAT-20 | Katinat | Hoàn 20% đồ uống | 15000 | PERCENTAGE 20 | 150000 | 50000 |
| CB-GONGCHA-25K | Gong Cha | Hoàn 25.000đ hóa đơn | 8000 | FIXED 25000 | 120000 | 25000 |
| CB-TCH-20 | The Coffee House | Hoàn 20% hóa đơn | 15000 | PERCENTAGE 20 | 180000 | 60000 |
| CB-JOLLIBEE-15 | Jollibee | Hoàn 15% hóa đơn | 10000 | PERCENTAGE 15 | 150000 | 40000 |
| CB-KFC-20 | KFC | Hoàn 20% hóa đơn | 20000 | PERCENTAGE 20 | 250000 | 80000 |
| CB-GOGI-15 | Gogi House | Hoàn 15% hóa đơn | 30000 | PERCENTAGE 15 | 600000 | 150000 |
| CB-BHX-30K | Bách Hóa Xanh | Hoàn 30.000đ mua sắm | 10000 | FIXED 30000 | 350000 | 30000 |
| CB-COOP-40K | Co.opmart | Hoàn 40.000đ mua sắm | 12000 | FIXED 40000 | 400000 | 40000 |
| CB-AEON-10 | AEON | Hoàn 10% mua sắm | 20000 | PERCENTAGE 10 | 500000 | 100000 |
| CB-GUARDIAN-15 | Guardian | Hoàn 15% chăm sóc cá nhân | 20000 | PERCENTAGE 15 | 300000 | 80000 |
| CB-COMEM-20 | Cỏ Mềm | Hoàn 20% mỹ phẩm | 20000 | PERCENTAGE 20 | 300000 | 100000 |
| CB-CGV-20 | CGV Cinemas | Hoàn 20% vé phim 2D | 15000 | PERCENTAGE 20 | 200000 | 60000 |
| CB-LOTTECINEMA-30K | Lotte Cinema | Hoàn 30.000đ vé phim | 10000 | FIXED 30000 | 150000 | 30000 |
| CB-BHD-20 | BHD Star | Hoàn 20% vé phim | 12000 | PERCENTAGE 20 | 180000 | 50000 |

Quy tắc chung cho dữ liệu bổ sung:

- 200 voucher/chiến dịch, limitPerUser 3, số đã bán/giữ chỗ ban đầu bằng 0. Không bịa review, doanh số hoặc lịch sử thanh toán.
- Timeline dựa trên **ngày import thực tế**: bắt đầu trước thời điểm import ít nhất một phút, kết thúc bán sau 60 ngày, hết hạn dùng sau 90 ngày. Lưu UTC; hiển thị giờ Việt Nam theo cơ chế hiện tại. Không dùng ngày cố định trong artifact đã hết hạn.
- Chỉ campaign đã được phê duyệt và PUBLISHED mới xuất hiện public. Import có audit/nguồn rõ ràng; không giả tạo việc một admin thật đã phê duyệt.
- Store phải thuộc đúng brand, đang hoạt động. Dùng địa chỉ/ảnh/logo local có sẵn và kiểm tra chúng load đúng sau build.
- Terms giảm giá: áp dụng hóa đơn tối thiểu, giới hạn trần giảm, một lần dùng, không cộng dồn; tính số giảm tối đa bằng giá trị hóa đơn thực tế hợp lệ.
- Terms hoàn tiền: thanh toán đủ hóa đơn, Merchant xác minh và hoàn bằng tiền mặt/chuyển khoản; nêu hóa đơn tối thiểu, trần hoàn và quy trình xác nhận/tra soát hiện có. Không ghi Marketplace là đơn vị trả Cashback.
- Nếu DISCOUNT hiện chưa thực thi minOrderValue khi redeem, bổ sung kiểm tra backend và test trước khi nhập. Không chỉ ghi điều kiện trên thẻ mà backend bỏ qua.
- Trường không thuộc loại voucher phải để null/loại bỏ nhất quán; DISCOUNT không có cashback fields, CASHBACK không có discount/combo fields.

## 6. Điều chỉnh chức năng tối thiểu cho hai loại

- Form tạo/sửa mới: chỉ cho chọn `DISCOUNT` và `CASHBACK`; giảm giá có phần trăm/số tiền, giá mua voucher, hóa đơn tối thiểu và trần giảm khi cần.
- API create/update validate đúng hai loại cho nghiệp vụ mới, không chỉ frontend chặn. Kiểm tra đường edit có thể lách nhập loại khác.
- Bộ lọc, nhãn thẻ, detail, cart/order snapshot, wallet và redeem hiển thị đúng quyền lợi. Không gọi discount là voucher mệnh giá hoặc cashback là giảm trực tiếp.
- Không cần xóa enum/renderer legacy nếu còn lịch sử sử dụng; giữ tương thích lịch sử. Deployment catalog mới chỉ chứa hai loại như yêu cầu.
- Không thay đổi layout lớn, dashboard, cơ chế JWT/RBAC, VNPAY hoặc quy trình Cashback settlement ngoài phần cần cho DISCOUNT hoạt động đúng.
- Chạy test hồi quy hiện có; nếu test trước yêu cầu tạo STORED_VALUE thì cập nhật có chủ đích theo phạm vi tạo mới và vẫn giữ test đọc/xử lý lịch sử.

## 7. Render: kiến trúc triển khai

Mô hình:

```text
Người dùng → Render Static Site (React)
                     ↓ HTTPS API
              Render Web Service (Express)
                     ↓
                  MongoDB Atlas
                     + dịch vụ email thực
```

### Điểm cần quyết định: email OTP thật

Theo [Render Free limitations](https://render.com/docs/free), Free Web Service **chặn outbound cổng 25, 465, 587**. Vì vậy cấu hình Gmail SMTP 465/587 đang dùng local sẽ không tự hoạt động trên Render Free.

Chọn rõ một phương án trước deployment:

1. Backend Render gói trả phí hỗ trợ outbound SMTP phù hợp; giữ mail service Nodemailer/Gmail hiện có, xác minh khả năng kết nối thực tế và chi phí với người dùng trước khi mua.
2. Backend Free và thêm email provider gửi qua **HTTPS API**. Chỉ thực hiện khi người dùng chọn phương án này, có sender/domain phù hợp và secret được nhập an toàn. Đây là thay đổi mail adapter cần test, không chỉ đổi SMTP_PORT.

Frontend Static Site có thể chạy riêng. Không tuyên bố Customer login hoàn tất nếu backend online nhưng mail OTP chưa gửi thật được.

### Backend — Web Service

| Mục | Giá trị |
|---|---|
| Repository | Repo đã kiểm tra ở trên |
| Branch | Branch người dùng chọn có đủ code mới |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Backend dùng `process.env.PORT` Render cấp, bind public interface. Không hardcode localhost cho listener. Không chạy importer/seed trong build. Nếu tạo Blueprint, không commit secrets và chọn plan sau khi đã thống nhất.

Environment backend, nhập trong Render Dashboard:

```env
NODE_ENV=production
MONGO_URI=<MongoDB Atlas URI trỏ đúng database deployment mới>
USE_EMBEDDED_MONGO=false
AUTO_SEED=false
SEED_CATALOG_ON_START=false
CORS_ORIGIN=https://<frontend-thuc-te>.onrender.com
WEB_APP_URL=https://<frontend-thuc-te>.onrender.com
JWT_ACCESS_SECRET=<random-secret-rieng>
JWT_REFRESH_SECRET=<random-secret-rieng-khac>
JWT_ACCESS_EXPIRES_IN=15m
OTP_SECRET=<random-secret-it-nhat-32-ky-tu>
REDEEM_HMAC_SECRET=<random-secret-rieng>
PAYMENT_WEBHOOK_SECRET=<random-secret-rieng>
PAYMENT_SIMULATOR=false
```

Nếu là web demo có thanh toán giả lập, chỉ bật PAYMENT_SIMULATOR=true sau khi người dùng chọn demo và hiển thị đúng trạng thái giả lập. Không tuyên bố đó là thanh toán thật.

Mail khi chọn SMTP trên gói phù hợp:

```env
MAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<Gmail gui thu>
SMTP_PASS=<Google App Password>
EMAIL_FROM=Vouch <Gmail gui thu>
```

Nếu dùng HTTPS provider, thay cấu hình bằng biến của adapter thực sự đã triển khai. Không giả lập MAIL_MODE=smtp nếu không dùng SMTP.

VNPAY nếu cần: dùng đúng sandbox credentials và URL callback public mới; `VNPAY_RETURN_URL=https://<frontend>/payment-return`, `VNPAY_IPN_URL=https://<backend>/api/orders/vnpay-ipn`. Chưa có credentials thì báo giới hạn, không coi simulator là xác minh VNPAY.

### MongoDB Atlas

- Dùng database deployment riêng; database user chỉ có quyền cần thiết trên database đó.
- Cấu hình IP access list cho outbound IP/range thực tế của Render và máy thực hiện importer; không mặc định mở mọi IP.
- Lưu connection string trong env backend và phiên importer bảo mật, không đưa vào MD/commit/log/chat.
- Kiểm tra import và app cùng database. Không để một bên dùng local embedded, bên kia dùng Atlas.
- Nếu connection thất bại: sửa network/credentials/URI và dừng app production; không fallback MongoDB nhúng.

### Frontend — Static Site

| Mục | Giá trị |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Environment | `VITE_API_URL=https://<backend-thuc-te>.onrender.com` |

Thêm SPA rule trong Redirects/Rewrites:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

Không dùng Redirect cho rule SPA. Không đưa secret SMTP/Mongo/JWT vào biến `VITE_*`. Đổi VITE_API_URL phải rebuild frontend, không chỉ restart backend.

Sau khi có URL frontend thật, cập nhật CORS_ORIGIN và WEB_APP_URL backend tương ứng rồi redeploy. Kiểm tra cả `/login`, `/web/login`, link đặt lại mật khẩu và refresh trực tiếp một URL detail.

## 8. Authentication hiện tại — phải giữ

- Customer email OTP, không có password form.
- Admin/Owner/Staff email + password, không OTP form.
- Các API hiện có:
  - `POST /api/auth/otp/request`
  - `POST /api/auth/otp/verify`
  - `POST /api/auth/login`
- Chỉ CUSTOMER ACTIVE được OTP; role lấy DB. Không tự tạo User khi request email.
- OTP crypto/HMAC, hạn năm phút, một lần dùng, tối đa năm lần thử, resend 60 giây, rate limit IP/email, atomic consume.
- Giữ session, refresh rotation, logout và RBAC.

Tài khoản demo Management đã có trong dự án:

```text
admin@voucher.local
owner@highlands.local
staff@highlands.local
```

Password demo hiện tại: `Voucher@123`. Không reset account hiện có hoặc chạy seed để lấy lại account. Nếu dùng dữ liệu mới với chủ brand khác, kiểm tra assignment và quyền thực tế để demo login thấy được catalog tương ứng.

Email Customer người dùng muốn test: `tanhdang306@gmail.com`. Kiểm tra bản ghi CUSTOMER ACTIVE thật sự tồn tại trong database deployment trước test. Không mặc định email này đã được đăng ký.

Local `.env` đã được người dùng cho phép cấu hình trước đó: Gmail user/email-from ở trên, MAIL_MODE=smtp, OTP_SECRET đã tạo; SMTP_PASS tại lần kiểm tra gần nhất vẫn trống. **Không copy `.env` local lên Git hoặc xuất secrets.** Cấu hình Render là môi trường riêng, không tự nhận biến local.

## 9. Trình tự thực hiện và kiểm tra

1. Audit code/data/remote, xác định manifest và nguồn voucher mới. Báo nếu thiếu dữ liệu thực thay vì âm thầm quay về seed.
2. Chuẩn bị dataset bổ sung, importer idempotent/dry-run, validation hai loại và bảo vệ production MongoDB.
3. Chạy backend tests, frontend tests/build; kiểm tra không có secret trong tracked files.
4. Review tổng hợp file thay đổi, dữ liệu nhập và plan hosting. Đăng nhập tài khoản Render/Atlas do người dùng thực hiện khi cần; không đòi gửi password hoặc API secret qua chat.
5. Sau khi source đã có trên repo deployment được phép sử dụng, tạo service/config env, nhập đúng database một cách có kiểm soát, deploy và kiểm tra URL thật.
6. Nếu gói Free không có Shell/one-off job, chạy importer từ máy được phép kết nối Atlas; không chạy seed mỗi startup để thay thế.
7. Ghi kết quả thực tế và phần chưa test. Không ghi “deploy thành công” chỉ vì build local pass.

Acceptance checks:

- Public URL frontend mở được từ trình duyệt; HTTPS hoạt động; refresh đường dẫn con không 404.
- API health báo database up, đúng Atlas; restart backend vẫn còn dữ liệu.
- Aggregate campaign deployment theo voucherType chỉ có DISCOUNT/CASHBACK; đối chiếu public API toàn bộ phân trang, không chỉ trang đầu.
- Tổng dữ liệu là voucher mới hợp lệ được giữ lại cộng số voucher bổ sung thực tế. 32 dòng đề xuất không có nghĩa importer đã chạy hoặc tất cả đã được thêm.
- Không có tiêu đề/nội dung combo, mua một tặng một, voucher mệnh giá trong catalog mới. Không có bản ghi gõ thử hoặc catalog seed cũ.
- Discount phần trăm/số tiền, hóa đơn tối thiểu/trần giảm được kiểm tra backend và hiển thị đúng.
- Cashback hiển thị min invoice/cap, Merchant trả tiền; quy trình confirm/dispute và phân quyền vẫn hoạt động.
- Search/filter/pagination/detail/logo hoạt động và không trộn loại voucher ngoài yêu cầu.
- Customer nhận một OTP thật có kiểm soát và đăng nhập thành công; thử mã sai/dùng lại. Automated tests dùng mock mail, không gửi hàng loạt.
- Admin/Owner/Staff password login và redirect đúng; Owner/Staff thấy brand/store có quyền; Customer không truy cập Management.
- Refresh/logout/session restore hoạt động trên domain public. Không cần thay đổi cart context.
- Import dry-run không ghi DB; import hai lần không nhân đôi và không reset counters/timeline/password.
- Không thay đổi database local/production cũ; có nguồn dữ liệu và đường rollback rõ ràng.

Giới hạn Render Free phải báo đúng: service có thể ngủ sau thời gian không có traffic, filesystem không bền vững, cron nội bộ không chạy trong lúc service ngủ, SMTP ports bị chặn. Các job hết hạn/nhắc Cashback/đối soát cần phương án scheduler hoặc service luôn chạy nếu muốn bảo đảm chạy đúng giờ; không hứa chỉ cần cron trong process là đủ.

## 10. Báo cáo cuối cùng

Viết tiếng Việt và cập nhật file kết quả deployment gồm:

1. URL Customer, Management và API health thực tế.
2. Repo branch/commit được deploy, ngày kiểm tra và cấu hình service không chứa secrets.
3. Dataset nguồn, số voucher mỗi loại, số brand/store, số bản ghi giữ/bổ sung/không đưa vào deployment.
4. File/script đã sửa, cách chạy importer dry-run/import/verify và kết quả idempotency.
5. Kết quả test backend/frontend/build/browser và email thật; phân biệt test mock và thực tế.
6. SMTP/HTTPS provider và plan đã dùng; chi phí nếu có, trạng thái sender/domain.
7. Giới hạn còn lại, rollback app về commit trước và khôi phục manifest/database an toàn.

## 11. Tài liệu tham khảo chính thức

Đã kiểm tra tài liệu hosting khi soạn bản bàn giao ngày 05/11/2026; xác minh lại nếu triển khai sau đó:

- [Render Web Services](https://render.com/docs/web-services)
- [Render Static Sites](https://render.com/docs/static-sites)
- [Render Free limitations — bao gồm SMTP](https://render.com/docs/free)
- [Render SPA redirects/rewrites](https://render.com/docs/redirects-rewrites)
- [Vite static deployment](https://vite.dev/guide/static-deploy)
- [MongoDB Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [Google App Passwords](https://support.google.com/accounts/answer/185833)

Đọc thêm bối cảnh auth ở `CHAT_HANDOFF.md` và `PASSWORDLESS_OTP_REPORT.md`. **Yêu cầu hai loại DISCOUNT/CASHBACK trong file này là chỉ dẫn mới nhất, thay thế yêu cầu tạo mới CASHBACK/STORED_VALUE trước đây.**
