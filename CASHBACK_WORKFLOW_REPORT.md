# Hoàn thiện Cashback: Merchant báo hoàn, Customer xác nhận, Admin xử lý tranh chấp

Ngày 04/11/2026. Đây là phần triển khai tiếp nối audit trước; các giới hạn “chưa có xác nhận/biên nhận/tranh chấp” trong VOUCHER_FLOW_AUDIT.md được thay thế bằng báo cáo này.

## A. Audit source thực tế

Đã kiểm tra Campaign/VoucherItem/RedemptionLog và enums, redeem, auth/RBAC/ownBrand, route Customer/Staff/Brand/Admin, notification, jobs, API client, Wallet, Store, Admin và WebApp. Source có claim Cashback trên VoucherItem và PENDING_CASHBACK, đã tính/khóa số tiền và hóa đơn, nhưng chưa có khai báo chi trả, Customer confirmation, dispute hay audit vòng đời này.

Hạ tầng có notification lưu MongoDB và scheduler node-cron chạy mỗi 5 phút. Không tìm thấy upload/multer/file storage/chứng từ. Vì vậy triển khai biên nhận điện tử dạng văn bản có cấu trúc, lưu phía server, không thêm cloud hoặc secrets, không nhận URL tùy ý hay base64 làm chứng cứ.

Phát hiện cần tích hợp tối thiểu: các trạng thái Cashback mới phải bị chặn tạo QR/redeem/refund phí mua; Wallet không được coi claim đã sử dụng là voucher hết hạn; COMPLETED phải vào tab đã dùng; review và đối soát doanh thu bán voucher cần nhận diện COMPLETED như voucher đã sử dụng, vẫn chỉ dùng unitPrice.

## B. Implementation

### File thay đổi trong đợt này

| File | Nội dung |
| --- | --- |
| backend/src/models/index.js | cashbackHistory append-only qua service; unique partial multikey index cho toàn bộ tham chiếu chi trả đã dùng trên claim. Tận dụng cashbackClaim Mixed, không migration claim cũ. |
| backend/src/utils/enums.js | MERCHANT_REPORTED_PAID, DISPUTED, COMPLETED và notification CASHBACK_UPDATE. |
| backend/src/services/cashback.js (mới) | State machine; phân quyền/scope; report-paid; supplement; Customer confirm/dispute; Admin note/request evidence/reopen/complete; biên nhận điện tử; audit nguyên tử; reminder 72 giờ; DTO riêng cho Customer. |
| backend/src/routes/cashback.js (mới) | Các endpoint authenticated, có role/ownership checks, dùng convention hiện tại. |
| backend/src/app.js | Mount riêng router Cashback trước router Staff/Brand/Admin hiện có. |
| backend/src/services/rules.js | Chặn reuse/refund cho toàn bộ trạng thái claim; nhãn Wallet và tab COMPLETED/đang xử lý. |
| backend/src/services/wallet.js | Trả DTO Cashback tối thiểu cho chính Customer; không trả raw lịch sử, lời khai Merchant hoặc biên bản độc lập Admin vào Wallet/cache offline. |
| backend/src/services/review.js | Cho voucher Cashback COMPLETED đánh giá tương đương USED; không thay đổi điều kiện legacy/Stored-Value. |
| backend/src/services/notification.js | Nhóm notification Cashback, tận dụng notify và dedupeKey đã có. |
| backend/src/jobs/index.js | Thêm reminder vào lịch 5 phút; lỗi reminder được cô lập để không ngăn các job Order/Campaign cũ. |
| backend/src/services/settlement.js | Chỉ thêm COMPLETED vào danh sách voucher đã tiêu dùng đủ điều kiện đối soát doanh thu. Công thức vẫn dùng giá mua voucher unitPrice, không dùng cashbackAmount; không tự chuyển tiền. |
| frontend/src/web/Cashback.jsx (mới) | Component quản lý dùng chung trong khu Store, Brand và Admin: list theo scope/status, biên nhận, lịch sử chỉ đọc, báo hoàn/bổ sung và xử lý tranh chấp. |
| frontend/src/customer/CashbackPanel.jsx (mới) | Thông tin khoản hoàn; checkbox xác nhận đủ tiền; báo chưa nhận kèm lý do/bằng chứng văn bản; cảnh báo 72 giờ và kết quả Admin. |
| frontend/src/web/WebApp.jsx | Thêm menu/route Cashback cho ba role web; giữ layout hiện tại. |
| frontend/src/customer/Wallet.jsx | Gắn panel; thêm mục Chờ xác nhận Cashback; hiển thị trạng thái/nhắc 72 giờ; dừng QR với các trạng thái đã claim. |
| frontend/src/utils/format.js | Màu nhãn trạng thái mới. |
| frontend/src/web/Brand.jsx | Cập nhật duy nhất nội dung trợ giúp đang nói workflow chưa tồn tại. Không đổi cấu trúc tạo voucher. |
| backend/test/flows.test.js | 11 nhóm test mới, giữ 28 test trước; fixture vẫn dùng MongoMemoryServer. |

Không thay đổi gateway VNPAY, luồng Order/Payment, auth middleware, dữ liệu lịch sử, schema/luật tạo Stored-Value hay framework. Không sửa .env/.env.example, không migration/xóa MongoDB thật, không commit/push.

### State machine thực thi

- PENDING_CASHBACK → MERCHANT_REPORTED_PAID: Merchant gửi biên nhận hợp lệ, cam kết đã trả đủ tiền bên ngoài hệ thống.
- MERCHANT_REPORTED_PAID → COMPLETED: đúng Customer xác nhận receivedInFull=true; lưu CUSTOMER_CONFIRMED, actor và thời gian.
- MERCHANT_REPORTED_PAID → DISPUTED: Customer gửi lý do và bằng chứng văn bản tùy chọn.
- DISPUTED → DISPUTED: Admin ghi chú/yêu cầu bổ sung; Merchant chỉ được bổ sung sau yêu cầu Admin. Bản khai cũ còn nguyên trong history, mã tham chiếu cũ tiếp tục được giữ để chống dùng lại cho claim khác.
- DISPUTED → MERCHANT_REPORTED_PAID: Admin ghi kết luận chuyển lại chờ Customer. Khi đã yêu cầu bổ sung thì phải có Merchant bổ sung trước. Không thay merchantReportedAt bằng thời điểm thao tác Admin.
- DISPUTED → COMPLETED: chỉ Admin với note, loại căn cứ độc lập/xác nhận Customer đã kiểm chứng, mã biên bản riêng, nội dung biên bản và cam kết đã kiểm chứng. Lưu ADMIN_VERIFIED, actor và thời gian. Riêng biên nhận/mã tham chiếu Merchant không đủ điều kiện API.
- Không có đường Merchant tự COMPLETED. Không đổi tiền, hóa đơn, Customer hay quyền sở hữu qua payload.

### Biên nhận và chứng cứ

BANK_TRANSFER và CASH đều bắt buộc phương thức, paidAt, mã tham chiếu/biên nhận và evidence={kind:ELECTRONIC_RECEIPT, statement}, cùng attested=true. Server tự gắn receipt UUID, claim ID, amount từ claim, actor, recordedAt, method/reference/paidAt và SHA256; nguồn luôn MERCHANT_DECLARATION, verified=false. Bản ghi có thể truy xuất qua chi tiết claim và lịch sử dưới quyền Staff đúng chi nhánh, owner đúng Brand hoặc Admin. Đây là hồ sơ điện tử có lưu vết, không phải bằng chứng ngân hàng xác thực hoặc chữ ký điện tử pháp lý.

Không có upload ảnh/PDF, không tải URL từ client, không tích hợp lưu trữ mới. UI nêu rõ giới hạn và yêu cầu tránh số tài khoản/CCCD/thông tin nhạy cảm. Customer chỉ nhận phương thức, số tiền, mốc thời gian, mã tham chiếu và receipt ID liên quan đến chính mình; không nhận biên bản xác minh nội bộ Admin.

Admin ghi biên bản độc lập dạng văn bản có nguồn, mã tra soát và nội dung kiểm chứng. Hệ thống bắt buộc dữ liệu/audit và phân quyền; việc kiểm chứng thực tế do Admin thực hiện ngoài ứng dụng, không tuyên bố hệ thống đã gọi ngân hàng để xác minh.

### API

Tất cả đường dẫn dưới /api:

| Actor | API |
| --- | --- |
| Staff | GET /staff/cashback; GET /staff/cashback/:id; POST /staff/cashback/:id/report-paid; POST /staff/cashback/:id/supplement |
| Brand owner | Các API tương ứng dưới /brand/:brandId/cashback, có ownBrand |
| Customer | GET /cashback/:id; POST /cashback/:id/confirm; POST /cashback/:id/dispute; DTO Cashback trong GET /wallet và /wallet/:id |
| Admin | GET /admin/cashback?status=DISPUTED; GET /admin/cashback/:id; POST /admin/cashback/:id/resolve |

List quản lý giới hạn 200 claim gần nhất, có lọc trạng thái. Actor Customer chỉ được xem/thao tác voucher của mình. Staff phải có session activeStoreId, StaffAssignment active và Store hoạt động; scope cả Brand lẫn chi nhánh. Owner chỉ scope các Brand mình sở hữu; path brandId được kiểm tra lại. Actor bị khóa bị auth hiện tại từ chối. Payload có field lạ/sửa tiền/status/customerId bị trả 400. Trạng thái sai hoặc cạnh tranh trả 409; ngoài scope trả 404/403.

### Concurrency, audit và reminder

State + revision + trường claim + sự kiện history được ghi bằng một findOneAndUpdate có điều kiện trên cùng VoucherItem. Một request thắng; request đọc revision/state cũ trả 409. Không dùng transaction/replica set mới. Unique multikey index ràng buộc mọi mã tham chiếu Brand+method đã dùng, kể cả phiên bản chứng từ trước bổ sung. Lịch sử không có API sửa/xóa.

Claim lịch sử chưa có revision được nhận diện bằng exists:false, tăng revision từ lần thao tác mới đầu tiên. Không batch migrate. ExpireAt sau khi claim không cản việc nhận tiền/xử lý tranh chấp; QR vẫn không tái sử dụng.

reminderDue được tính lúc truy vấn từ merchantReportedAt + 72 giờ, chỉ khi MERCHANT_REPORTED_PAID. Wallet có cảnh báo và mục cần xác nhận. Lịch 5 phút lưu notification trong ứng dụng với dedupeKey; tuân thủ notification preferences. Không gửi email/push ngân hàng. Notification có thể tới muộn hơn mốc 72 giờ tối đa khoảng một chu kỳ job khi server hoạt động; sau downtime sẽ rà lại. Không đổi status, không tự mở tranh chấp, không tự COMPLETED.

## C. Verification

- npm test --prefix backend: 39/39 PASS, 0 FAIL, 0 SKIP.
- npm run build --prefix frontend: PASS, Vite 5.4.11, 122 modules.
- node --check toàn bộ backend/src/**/*.js và backend/test/flows.test.js: PASS.
- Không có lint script trong package.json; không báo đã chạy lint.
- 28 test regression cũ vẫn pass: Stored-Value/legacy, mua hàng, stock/quota đồng thời, callback VNPAY, refund phí mua, redemption, quyền và phê duyệt.
- 11 nhóm mới: BANK_TRANSFER/CASH hợp lệ; thiếu/sai bằng chứng/method/kiểu/timestamp; role/Brand/store ownership; khóa account/assignment; field tiền không được sửa; report concurrent/replay; reference trùng và giữ reference lịch sử; Customer xác nhận và tranh chấp; confirm-vs-dispute và Admin-vs-Customer race; mốc trước/đúng/sau 72h và dedupe notification; request supplement/reopen; Admin thiếu căn cứ bị từ chối; ADMIN_VERIFIED có audit; claim cũ không revision; voucher hết hạn sau claim; không phát sinh Payment/PaymentRefund; đối soát doanh thu 300K, không dùng 5 triệu Cashback.
- Các test dùng database MongoMemoryServer riêng. Fixture nâng giới hạn sinh token tạm thời chỉ trong lời gọi tạo fixture, rồi khôi phục; không thay rate limit production hay .env.
- Chưa chạy browser/camera end-to-end, chuyển tiền thật, đối soát ngân hàng thật, upload tệp, scheduler chờ đủ 72 giờ wall-clock, thử tải production hoặc phục hồi khi tiến trình chết. Reminder được test trực tiếp bằng timestamp/now truyền vào; scheduler được kiểm tra mã tích hợp, không chờ ba ngày.

## D. Hướng dẫn demo

1. Owner vào /web/brand/campaigns/new tạo Cashback: giá 300.000, 50%, trần 5.000.000, min bill và terms phù hợp, công bố hoàn tiền mặt/chuyển khoản; chọn chi nhánh và thời gian hợp lệ. Gửi duyệt.
2. Admin vào /web/admin/campaigns duyệt để chương trình mở bán.
3. Customer mua và hoàn tất thanh toán mua voucher bằng luồng hiện có. Production dùng VNPAY; test suite dùng simulator có sẵn, không coi simulator là giao dịch thật.
4. Customer mua hàng tại Merchant và thanh toán đủ hóa đơn ở bên ngoài Marketplace. Ứng dụng không thực hiện hay tự xác minh giao dịch mua hàng này.
5. Customer mở QR/OTP trong Wallet. Staff chọn đúng chi nhánh, xác minh tại /web/store/redeem, nhập billAmount=10.000.000 và mã hóa đơn duy nhất. Backend ghi claim 5.000.000 ở PENDING_CASHBACK.
6. Merchant thực sự giao 5.000.000 tiền mặt hoặc chuyển khoản bên ngoài ứng dụng. Chưa trả tiền thì không báo đã trả.
7. Staff vào /web/store/cashback hoặc Owner vào /web/brand/cashback. Chọn claim, nhập CASH/BANK_TRANSFER, thời điểm thực trả (có giây), mã giao dịch/biên nhận, nội dung chứng từ điện tử và cam kết. Gửi → MERCHANT_REPORTED_PAID; đây vẫn chỉ là Merchant báo trả tiền.
8. Customer vào /wallet/:id, kiểm tra tiền thực nhận. Tick đã nhận đủ và chọn “Tôi đã nhận đủ tiền”.
9. Backend lưu CUSTOMER_CONFIRMED và COMPLETED; voucher ở tab đã dùng, QR không dùng lại.
10. Nhánh tranh chấp dùng một claim khác: sau bước 7 Customer nhập lý do/bằng chứng và chọn “Tôi chưa nhận tiền” → DISPUTED. Admin vào /web/admin/cashback xem lịch sử/biên nhận. Có thể ghi chú hoặc yêu cầu bổ sung; Merchant bổ sung tại trang Cashback, bản cũ vẫn lưu. Admin chuyển lại chờ Customer sau đối chiếu, hoặc hoàn tất ADMIN_VERIFIED chỉ sau khi đã thực sự kiểm chứng căn cứ độc lập và lưu biên bản. Chưa đủ căn cứ thì giữ DISPUTED.

Demo 72 giờ: trong test dùng now có kiểm soát; không cần sửa ngày MongoDB thật. Production cảnh báo xuất hiện khi query Wallet sau mốc, notification được ghi qua job hiện có. Không đổi đồng hồ hay dữ liệu thật để giả làm đã nhận tiền.

## E. Rủi ro còn lại

- Biên nhận điện tử có thể là lời khai gian; SHA256 phát hiện khác biệt bản ghi khi đối chiếu, không chứng minh giao dịch thật. Không tích hợp ngân hàng/POS/e-invoice hay anti-fraud lớn.
- Admin có thể ghi căn cứ sai; ứng dụng kiểm soát role/field/audit, không tự chứng minh tính độc lập của một văn bản. Cần quy trình vận hành và kiểm tra quyền Admin.
- Không xác minh Customer khai thiếu tiền có đúng hay không; tranh chấp cần đối chiếu thực tế. Không tự hoàn lại/đảo giao dịch khi khoản chuyển thất bại, bị hoàn ngược hoặc Customer trả hàng.
- Chưa có SLA trả tiền/ngân sách riêng trong Brand policy. Không tự invent hạn trả, ký quỹ, ví hoặc tài chính mới. Account/Brand bị khóa cần hỗ trợ vận hành; ứng dụng không bỏ qua RBAC để cho actor khóa thao tác.
- Không có upload ảnh/PDF/chữ ký số pháp lý; nếu cần chứng từ gốc, phải bổ sung hạ tầng lưu trữ riêng với phân quyền, giới hạn tệp và chính sách dữ liệu. Hiện chỉ lưu hồ sơ điện tử văn bản tối thiểu.
- Notification là in-app, không phải email/push. Hạ tầng lỗi có thể mất thông báo sự kiện tức thời; Wallet/list vẫn là nguồn trạng thái và reminder được retry/dedupe khi job chạy lại. Không xây transactional outbox trong phạm vi này.
- Unique indexes mới phải tạo thành công khi deploy. reportPaid chờ model init trong cấu hình autoIndex hiện tại; môi trường tắt autoIndex cần tạo index theo quy trình triển khai trước nhận request. Không chạy syncIndexes/migration MongoDB thật trong task.
- History và paymentReferenceKeys tăng theo số lần xử lý trên một claim; list giới hạn 200 và chưa phân trang. Khi quy mô lớn cần chính sách lưu trữ/phân trang, không refactor kiến trúc hiện tại.
- Tổng quan thống kê legacy ở báo cáo Brand vẫn chủ yếu đếm USED; dashboard thống kê tiêu dùng Cashback theo từng trạng thái có thể cần bổ sung riêng. Trang quản lý Cashback mới hiển thị state machine đầy đủ.
- Luồng Order/Payment đa lệnh ghi và sandbox hoàn phí mua có giới hạn đã nêu trong audit cũ; không thay đổi trong task này. Không dùng chúng để chi Cashback.
