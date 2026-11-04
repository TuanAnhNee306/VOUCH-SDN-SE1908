> Cập nhật tiếp nối 04/11/2026: workflow Merchant báo hoàn → Customer xác nhận/tranh chấp → Admin xử lý đã được triển khai. Xem [CASHBACK_WORKFLOW_REPORT.md](CASHBACK_WORKFLOW_REPORT.md) để biết trạng thái hiện tại, kiểm thử và hướng dẫn demo. Nội dung bên dưới giữ lại kết quả audit đợt đầu.

# Báo cáo audit và chỉnh sửa luồng voucher Merchant

Ngày: 04/11/2026.

## A. Phân tích ban đầu

- Kiến trúc thực tế: Express/Mongoose backend; React/Vite frontend. Voucher được cấu hình bằng Campaign, mỗi đơn vị sở hữu là VoucherItem, không có model mang tên UserVoucher.
- Loại đang tồn tại trong source là DISCOUNT, PREPAID, COMBO; không tự ánh xạ các loại này sang CASHBACK/STORED_VALUE.
- Luồng tạo: Brand owner → routes/brand.js → campaign.create → DRAFT → submit → PENDING → Admin approve → APPROVED/PUBLISHED. ownBrand/ownCampaign xác minh quyền bằng dữ liệu server.
- Luồng mua: Order PENDING giữ chỗ → callback thanh toán có xác minh → PAID → phát từng VoucherItem có code riêng → FULFILLED. GatewayTxnId có unique index và Order có cập nhật trạng thái có điều kiện.
- Redemption: QR ký/OTP ngắn hạn → kiểm tra nhân viên/chi nhánh → tiêu token → ACTIVE sang USED → RedemptionLog. Ban đầu chưa có Cashback và chưa có Customer xác nhận đã nhận tiền.
- Lỗi: ép kiểu số quá rộng; loại cũ vẫn tạo mới; validation discount chưa chặt; quota theo Customer đọc rồi kiểm tra nên có thể vượt khi gửi đồng thời; điều khoản/chi nhánh có thể sửa sau bán; chưa khóa khi có đơn giữ chỗ; chưa kiểm tra Order đã thanh toán tại điểm redemption; chưa lưu snapshot quyền lợi.
- Brand model chưa có cấu hình giới hạn tỷ lệ Cashback, ngân sách, số lượng tối đa hay danh sách sản phẩm đủ điều kiện. Không tự thêm chính sách tài chính giả định.

## B. File sửa và lý do

| File | Thay đổi |
| --- | --- |
| backend/src/utils/enums.js | Thêm CASHBACK/STORED_VALUE/PENDING_CASHBACK, giữ enum lịch sử. |
| backend/src/models/index.js | Trường Cashback, snapshot quyền lợi ở Order/VoucherItem, purchaseCounts do server quản lý; claim Cashback lưu nguyên tử trên VoucherItem với unique index mã hóa đơn; RedemptionLog lưu tiền hoàn dự kiến. Campaign dùng optimistic concurrency. |
| backend/src/services/rules.js | Validation riêng cho hai loại mới, tiền VND nguyên và hữu hạn, giới hạn an toàn cả quy đổi x100 cho gateway; công thức hoàn và làm tròn xuống VND; chặn dùng/hoàn phí mua khi đang chờ Cashback; vị trí/nhãn trong ví. |
| backend/src/services/campaign.js | Chỉ tạo mới hai loại; Brand phải APPROVED; kiểm tra chi nhánh đang hoạt động và thuộc Brand; whitelist field; kiểm tra kiểu; khóa quyền lợi/điều kiện khi đã bán hoặc giữ chỗ; giữ luồng duyệt lại; Admin approve kiểm tra Brand. |
| backend/src/services/order.js | Quota Customer được claim cùng stock trong một cập nhật Campaign có điều kiện; hoàn quota khi hủy; kiểm tra giá/Brand; snapshot lúc giữ chỗ và sao chép khi phát voucher; bù reservation nếu Order.create thất bại. Giữ callback/gateway hiện có. |
| backend/src/services/redeem.js | Kiểm tra Order đã trả tiền; sử dụng snapshot; kiểm tra Brand/chi nhánh; Stored-Value yêu cầu hóa đơn >= mệnh giá; Cashback tính tiền tại backend, khóa hóa đơn và chuyển sang PENDING_CASHBACK; chống trùng voucher/hóa đơn bằng CAS và unique index; không có API tự xác nhận hoàn tất. |
| backend/src/services/wallet.js | Trả quyền lợi snapshot và thông tin Cashback để Customer nhìn đúng quyền lợi đã mua. |
| backend/src/services/catalog.js | Không công khai bộ đếm mua nội bộ của Customer. |
| frontend/src/utils/format.js | Nhãn hai loại mới, giữ nhãn lịch sử. |
| frontend/src/utils/voucher-form.js | Validation form dùng chung cho Create/Edit với thông báo tiếng Việt. |
| frontend/src/web/Brand.jsx | Dropdown tạo mới chỉ có hai loại; field có điều kiện; đổi loại xóa/clear cấu hình không tương thích; tính tiết kiệm; khóa các field đã cam kết; ref ngăn submit lặp; chuyển số trước gọi API. |
| frontend/src/web/Store.jsx | Nhập mã hóa đơn Cashback; hiển thị tiền hoàn dự kiến và trạng thái chờ, không tuyên bố đã trả tiền. |
| frontend/src/customer/Campaign.jsx | Công bố đúng bản chất Cashback và quy tắc Stored-Value trước mua. |
| frontend/src/customer/Wallet.jsx | Hiển thị Cashback chờ hoàn, tiền dự kiến, dừng màn hình QR khi claim; không hiển thị đã nhận tiền. |
| backend/test/flows.test.js | Giữ test lịch sử; đổi test tạo COMBO sang Stored-Value vì tạo mới COMBO đã bị ngừng; thêm 6 nhóm test Marketplace. |

Các tên tương đương hiện có được giữ: voucherType, totalQuantity, limitPerUser, saleStartAt/saleEndAt/voucherExpireAt, terms. Không tạo field quantity/maxPerCustomer/termsAndConditions trùng nghĩa.

Giữ nguyên authentication/RBAC, route ownership, gateway VNPAY/chữ ký, framework, database, seed dữ liệu lịch sử và module đối soát. Không sửa .env/.env.example hoặc secrets, không chạy seed/migration trên database thật, không xóa dữ liệu, không commit/push. Thư mục được cung cấp không có .git nên không có git diff/status để đối chiếu.

## C. Quy tắc sau sửa

- CASHBACK và STORED_VALUE đều có salePrice > 0; thanh toán thành công mới phát VoucherItem sử dụng được.
- Cashback PERCENTAGE: tỷ lệ > 0 và <= 100, bắt buộc cap dương. FIXED_AMOUNT: số tiền nguyên dương; cap nếu có phải >= số tiền cố định. Hóa đơn phải đạt minOrderValue.
- Tiền hoàn = floor(min(quyền lợi theo công thức, hóa đơn đủ điều kiện, cap nếu có)). Ví dụ 50% của 10 triệu, cap 5 triệu, giá mua 300K → hoàn dự kiến 5 triệu; giá mua vẫn là 300K.
- Claim Cashback lưu số tiền, giá trị hóa đơn, mã hóa đơn theo Brand, chi nhánh và nhân viên. Một mã hóa đơn chuẩn hóa không được claim lại trên cùng Brand, kể cả khác campaign. Trạng thái và claim được ghi cùng một lệnh nguyên tử. QR/OTP bị tiêu; các request trùng không tạo quyền hưởng thêm.
- Merchant chịu trách nhiệm hoàn trực tiếp. Không gọi gateway/wallet để trả Cashback. Không có đường Merchant tự chuyển PENDING_CASHBACK thành USED/COMPLETED.
- STORED_VALUE: faceValue > 0; 0 < salePrice <= faceValue; không nhận cấu hình Cashback có giá trị. MVP một lần, không số dư. Hóa đơn nhỏ hơn mệnh giá bị từ chối và điều này được công bố trước mua để không mất phần giá trị còn lại.
- Merchant không thể gán brandId/status/approvedBy/soldQuantity bằng payload để vượt workflow. Điều khoản, quyền lợi, loại, thời hạn, phạm vi chi nhánh và các field đã cam kết được khóa khi đã bán/giữ chỗ. Chỉnh sửa chiến dịch đã phát hành vẫn phải duyệt lại.
- Dữ liệu lịch sử tiếp tục đọc và xử lý theo các nhánh DISCOUNT/PREPAID/COMBO hiện có; không chuyển đổi tự động. Snapshot chỉ được ghi cho Order/VoucherItem phát sinh mới. Bộ đếm quota được khởi tạo theo nhu cầu khi mua, không chạy migration hàng loạt.

## D. Kiểm thử thực tế

- npm test --prefix backend: 28/28 PASS, 0 FAIL, 0 SKIP. Dùng MongoMemoryServer với database test riêng; không dùng dữ liệu MongoDB đang chạy của project.
- npm run build --prefix frontend: PASS, Vite 5.4.11, 120 modules.
- node --check cho toàn bộ backend/src/**/*.js và frontend/src/utils/voucher-form.js: PASS.
- Repository không khai báo lint script; không báo giả rằng đã chạy lint.
- Test mới: tạo Cashback 50%/cap 5 triệu/giá 300K; fixed amount; tỷ lệ/giá/cap/số lượng/kiểu dữ liệu sai; NaN/Infinity/giá trị vượt giới hạn; loại legacy bị từ chối; field server không thể tự gán; Brand khác/role sai; Stored-Value hợp lệ và sai giá/mệnh giá/field Cashback; đổi loại; công thức và làm tròn; không hoàn vượt hóa đơn; quota cùng Customer đồng thời; callback đồng thời không phát trùng; snapshot; khóa sửa khi giữ chỗ/đã bán; redeem đồng thời một voucher và hai voucher cùng hóa đơn; không tự xác nhận hoàn tất; không sửa hóa đơn/số tiền hoàn; không dùng khi Order PENDING/CANCELLED/PAYMENT_MISMATCH; logic validation form cả hai loại.
- Test cũ vẫn kiểm tra chống oversell giữa hai Customer, thanh toán thất bại, callback lặp và VNPAY IPN giả chữ ký, redemption/refund/đối soát lịch sử.
- Chưa chạy thao tác UI end-to-end bằng trình duyệt/camera thật, gateway hoặc chuyển khoản thật, thử tải production hay mô phỏng tiến trình chết giữa các lệnh ghi. Test validation form và build không thay thế kiểm tra tương tác trình duyệt.

## E. Rủi ro và phần cần xử lý riêng

1. Chưa có workflow Customer xác nhận nhận tiền, upload/xác minh bằng chứng hoàn, nhắc quá hạn hay tranh chấp. Cashback dừng an toàn ở PENDING_CASHBACK; chưa thể vận hành toàn bộ vòng đời hoàn tiền. Không giả lập xác nhận tiền đã được chuyển.
2. Mã hóa đơn duy nhất chỉ chống trùng định danh do Merchant nhập. Chưa tích hợp POS/hóa đơn điện tử để xác minh hóa đơn thật, giá trị thanh toán thực tế, danh mục sản phẩm, hủy hóa đơn hoặc trả hàng. Merchant có thể gian lận bằng mã khác; cần nguồn chứng cứ xác thực.
3. Chưa có Brand Policy cho ngân sách, giới hạn phát hành/tỷ lệ riêng, SLA hoàn, ngày bắt đầu sử dụng độc lập với saleStartAt hoặc xử lý trả hàng. Điều kiện bổ sung được công bố bằng terms, chưa được kiểm chứng tự động. Không xây ví, ký quỹ hoặc cơ chế giữ/chuyển tiền Cashback.
4. Module đối soát hiện có không chọn PENDING_CASHBACK, nên không tự đưa claim đang chờ vào đối soát. Cần định nghĩa chính sách đối soát phí bán voucher sau khi có workflow hoàn/tranh chấp; không sửa cơ chế tiền thật trong nhiệm vụ này.
5. Luồng Order/Payment hiện tại có nhiều lệnh ghi riêng; tính idempotent và chống request đồng thời đã được test nhưng chưa có cơ chế phục hồi tổng quát khi tiến trình chết giữa Payment, Order, stock và issuance. Claim Cashback vẫn lưu nguyên tử cùng trạng thái ngay cả nếu ghi RedemptionLog sau đó lỗi; cần tác vụ đối chiếu/phục hồi log cho tình huống hạ tầng lỗi.
6. Unique partial indexes mới là điều kiện để chống trùng hóa đơn. Schema khai báo index, test chạy với index; khi triển khai phải bảo đảm index được tạo thành công trước nhận claim (đặc biệt môi trường tắt autoIndex). Không chạy syncIndexes/xóa index hay thao tác MongoDB production trong nhiệm vụ này.
7. purchaseCounts nằm trong Campaign phục vụ claim quota nguyên tử theo mô hình hiện tại. Cần đánh giá giới hạn kích thước document và giải pháp đếm riêng khi có chiến dịch rất đông Customer; không đổi kiến trúc trong phạm vi này.
8. Nhánh hoàn phí mua voucher cũ có sandbox/simulated refund và nhánh refundFull ghi COMPLETED theo cơ chế sẵn có. Không dùng các nhánh đó cho Cashback và không coi chúng là bằng chứng đã chuyển tiền thật. Cần audit riêng trước vận hành hoàn phí mua ở production.
