# Báo cáo redesign dashboard

Ngày thực hiện: 04/11/2026.

## A. Audit và hướng thiết kế

Frontend sử dụng React 18, React Router 6, Vite và CSS thuần. Không có thư viện component hoặc icon chuyên dụng; QR sử dụng html5-qrcode. API client giữ phiên Customer và Web riêng, có refresh token dùng chung cho request song song. Các trang Web nằm trong WebApp.jsx, Admin.jsx, Brand.jsx, Store.jsx và Cashback.jsx.

UI cũ có các điểm cần cải thiện: sidebar dùng emoji không thống nhất, layout mobile biến thành dãy menu ngang, thiếu overview riêng cho Brand/Staff, danh sách chiến dịch ít bộ lọc, form dài thiếu phần xem trước, phân cấp tiêu đề và khoảng cách chưa rõ. Dialog dùng chung thiếu focus trap và Escape.

Thiết kế mới dùng indigo, nền neutral, surface trắng, border nhẹ, góc bo thống nhất và font hệ thống có hỗ trợ tiếng Việt. CSS mới được giới hạn trong `.dashboard` để giữ giao diện Marketplace riêng. Không tải font hoặc thêm dependency.

Layout chung có sidebar theo role, active state, icon SVG cùng kiểu, desktop collapse, mobile drawer, breadcrumb, tiêu đề, avatar, menu tài khoản và liên kết Marketplace. Giữ RequireRole và API client hiện tại. Drawer hỗ trợ Escape và giữ focus; dialog có focus trap, trả focus và chặn đóng trong lúc submit.

## B. Màn hình đã cập nhật

| Vai trò | Thay đổi |
| --- | --- |
| Admin | Tổng quan số liệu backend; hàng đợi duyệt ưu tiên; bảng chiến dịch; tìm tên/Brand; lọc loại và Brand trong tập dữ liệu đã tải; panel chi tiết; dialog duyệt/từ chối; bảng Cashback/tranh chấp và trạng thái rõ ràng. |
| Brand Owner | Overview mới có báo cáo doanh thu, voucher đã bán, chiến dịch đang bán/chờ duyệt và nghĩa vụ Cashback; quick actions; tìm/lọc chiến dịch; chi tiết và mốc xét duyệt từ dữ liệu có thật; form chia section, preview trực tiếp, thông báo validation và trạng thái lưu. |
| Store Staff | Overview chi nhánh với quick actions, lượt xác minh của chính nhân viên trong ngày và nghĩa vụ Cashback; màn hình xác minh QR/OTP trong card; nhãn hóa đơn riêng; chọn chi nhánh bằng bàn phím; danh sách Cashback có tìm kiếm và bảng thông tin. |
| Trang phụ | Các trang chi nhánh, nhân viên, báo cáo, đối soát, hồ sơ, danh mục, đánh giá… nhận layout, tokens, card, button và form styles chung, giữ các thao tác nghiệp vụ hiện có. |

Brand/Staff được bổ sung route `/web/brand/overview` và `/web/store/overview`. Staff chưa chọn chi nhánh vẫn được đưa đến trang chọn chi nhánh theo luồng hiện tại. Form tạo voucher vẫn lưu nháp trước, sau đó gửi duyệt tại danh sách chiến dịch; không thêm bước API.

## C. File thay đổi

- `frontend/src/web/WebApp.jsx`: shell dùng chung, navigation, account menu, drawer/collapse, route overview và error state khi tải Brand.
- `frontend/src/web/Dashboard.jsx` (mới): Icon, StatCard, QuickActions, BrandOverview, StaffOverview và CashbackSummary.
- `frontend/src/web/dashboard.css` (mới): design tokens, layout, component styles, responsive và focus states.
- `frontend/src/web/Admin.jsx`: overview/hàng đợi duyệt, bảng và bộ lọc chiến dịch, xác nhận duyệt.
- `frontend/src/web/Brand.jsx`: tìm/lọc chiến dịch, phần chi tiết/mốc xét duyệt, section form và preview, thông báo validation.
- `frontend/src/web/Store.jsx`: UI redemption, label, keyboard selection.
- `frontend/src/web/Cashback.jsx`: bảng claim, tìm kiếm, badge trạng thái; giữ form biên nhận, resolution và lịch sử.
- `frontend/src/components/ui.jsx`: thông báo live, loading markup, accessibility dialog.
- `artifacts/dashboard-redesign/`: ảnh chụp màn hình thực tế.

Không thay đổi backend, schema, API contracts, công thức, validator voucher, VNPAY hoặc .env. Không thêm dependency, không commit/push. Các thay đổi tồn tại từ trước trong `artifacts/voucher-creation-demo/database-evidence.json` và file chưa track khác được giữ nguyên.

## D. Dữ liệu và giới hạn API

- Admin KPI lấy từ `/admin/dashboard`; pending queue từ `/admin/campaigns/pending`.
- Brand KPI lấy từ `/brand/:id/report` và danh sách campaigns. Không suy doanh thu bằng soldQuantity nhân giá bán.
- Cashback summary lấy từ API claim hiện có, ghi rõ giới hạn tối đa 200 claim gần nhất. Nghĩa vụ Cashback tách riêng doanh thu bán voucher.
- Staff history là lịch sử của nhân viên hiện tại tại chi nhánh, theo ngày Việt Nam; không diễn giải thành toàn bộ hoạt động mọi nhân viên của cửa hàng.
- Không có notification API cho ba role Web. Không thêm chuông thông báo hoặc search toàn hệ thống không hoạt động. Không tạo lịch sử hoạt động hoặc số liệu giả.
- Search/loại/Brand thực hiện trên dữ liệu danh sách đã tải; backend chưa có pagination cho các danh sách này nên không thêm pagination giả.
- Backend dùng DRAFT/PENDING/APPROVED/PUBLISHED/SOLD_OUT/PAUSED/ENDED. Từ chối trả về DRAFT và rejectReason; UI giữ đúng ánh xạ, không tạo enum REJECTED/EXPIRED cho campaign.
- Không thêm preview tính Cashback trước redemption vì API hiện tại không cung cấp bước xem voucher an toàn trước khi redeem. Máy chủ vẫn xác minh và tính theo luồng hiện tại.

## E. Xác minh thực tế

| Kiểm tra | Kết quả và phạm vi |
| --- | --- |
| Frontend build | PASS — `npm run build` trong frontend. |
| Backend regression | PASS — `npm test` trong backend: 39 tests, 39 pass, 0 fail. MongoDB tạm riêng, không dùng dữ liệu dự án. |
| Auth/session UI | Đã dùng phiên Brand hiện có, logout, login Admin demo, logout/login Staff demo, chọn chi nhánh, logout/login Brand demo. |
| Navigation theo role | Đã mở overview Brand/Admin/Staff; menu tương ứng role; quick action tạo voucher; Admin campaign list; Staff redemption. |
| Form CASHBACK/STORED_VALUE | Đã mở form trên Chrome, đổi loại bằng UI; xác nhận field Cashback ẩn khi chọn Stored-Value, field mệnh giá xuất hiện; preview phản ánh loại. Chưa submit campaign mới bằng UI trong đợt redesign. |
| Admin approval UI | Đã mở danh sách và dialog xác nhận duyệt, kiểm tra Escape đóng dialog; không phê duyệt dữ liệu đang có chỉ để chụp ảnh. |
| Create/submit/approve/catalog | Regression tests kiểm tra workflow, validation, ownership, approval và lọc marketplace; không tuyên bố đã chạy lại toàn bộ Browser E2E. |
| Redemption | Đã chọn chi nhánh và mở form OTP; regression tests kiểm tra QR/OTP, hóa đơn, sai chi nhánh, mã hết hạn, chống dùng lại và đồng thời. Chưa quét camera hoặc redeem voucher thật bằng UI trong đợt này. |
| Cashback report-paid/dispute | Regression tests kiểm tra bằng chứng, timestamp, attestation, quyền staff/brand/store, bất biến số tiền, concurrency, Customer confirmation và Admin independent verification. Form UI giữ các trường và API cũ. Chưa có browser E2E submit biên nhận/resolve. |
| Responsive | Đã quan sát desktop trên Chrome; đặt viewport Responsive rộng 375px, kiểm tra bảng cuộn và drawer mở/đóng. CSS có breakpoint cho tablet/laptop; chưa xác minh riêng từng kích thước 768/1024/1440. |
| Console | Đã xem Chrome DevTools: có 2 React Router future warnings và 2 HTTP 401 `/api/brand/me` trong lịch sử phiên. Không thấy lỗi render React ở các màn hình đã quan sát. Chưa audit console/network đầy đủ cho mọi thao tác. |

Browser access host không khả dụng; đã dùng native Chrome UI qua computer-use để kiểm tra và chụp ảnh. **Browser E2E đầy đủ: NOT RUN.** Các kiểm tra UI nêu trên là kiểm tra trực tiếp từng màn hình, không thay thế E2E toàn bộ luồng.

## F. Screenshot

Ảnh là cửa sổ Chrome thực tế, có browser chrome và con trỏ; desktop đang ở zoom 80%. Không phải mockup. Ảnh mobile có DevTools bên cạnh, viewport được đặt rộng 375px. Không có ảnh trước redesign.

- [Admin overview](artifacts/dashboard-redesign/admin-desktop.png)
- [Admin approval dialog](artifacts/dashboard-redesign/admin-approval.png)
- [Admin mobile drawer](artifacts/dashboard-redesign/admin-mobile-drawer.png)
- [Brand overview](artifacts/dashboard-redesign/brand-desktop.png)
- [Staff overview](artifacts/dashboard-redesign/staff-desktop.png)
- [Staff redemption](artifacts/dashboard-redesign/staff-redemption.png)
- [Create Cashback](artifacts/dashboard-redesign/create-cashback.png)
- [Create Stored-Value](artifacts/dashboard-redesign/create-stored-value.png)

## G. Mở giao diện

Ứng dụng local đã chạy tại `http://localhost:5173`, API tại `http://localhost:3000`. Vào `/web/login`, chọn tài khoản demo theo role hoặc dùng tài khoản được cấp. Brand vào Tổng quan → Tạo voucher; Admin vào Bảng điều khiển → Xem hàng đợi; Staff chọn chi nhánh → Tổng quan hoặc Xác nhận sử dụng.
