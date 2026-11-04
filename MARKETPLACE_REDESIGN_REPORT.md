# Báo cáo redesign Customer Marketplace và Authentication

Ngày thực hiện: 04/11/2026.

## A. Phạm vi và audit

Theo điều chỉnh mới nhất, ưu tiên bàn giao **bản web desktop**. Không tiếp tục phát triển hoặc kiểm thử riêng mobile/tablet. Một số CSS và ảnh responsive đã được tạo trước khi phạm vi được điều chỉnh; chúng không phải tiêu chí nghiệm thu bổ sung.

Source hiện tại sử dụng React 18, Vite, React Router 6 và CSS thuần. Customer đăng nhập bằng email → OTP; backend tạo Customer khi email mới yêu cầu OTP. Không có hệ thống đăng ký bằng mật khẩu hoặc social login cho Customer. Management sử dụng email/password, có password reset và activation hiện hữu.

UI cũ thiên về ứng dụng điện thoại: card đơn giản, emoji không đồng nhất, thiếu phân cấp thông tin quyền lợi và giá mua, auth ít branding. Header tìm kiếm chưa có input trên desktop. Các trang ví/tài khoản/đơn hàng chưa có cấu trúc phù hợp web.

Thiết kế mới dùng bố cục Marketplace desktop, header có tìm kiếm thật, hero bằng CSS ticket illustration, catalog dạng grid, thông tin mua và quyền lợi tách biệt. Không thêm ảnh stock, số liệu quảng cáo hoặc voucher mẫu vào dữ liệu đang chạy.

Design tokens được lấy từ dashboard đã hoàn thiện: indigo `#4f46e5`, surface trắng, nền `#f6f7fb`, text Slate, border `#e5e9f1`, font Inter/Segoe UI/system. Các giá trị được tập trung tại `design-system.css`. Bộ SVG Icon được tách từ Dashboard vào component dùng chung, giữ các path hiện tại. Dashboard chỉ đổi tham chiếu token/import icon, không đổi layout hoặc tính năng.

## B. Màn hình đã triển khai

| Màn hình | Thay đổi |
| --- | --- |
| Customer Home | Header sticky, search thật, hero có CTA đến catalog, danh mục từ API, sort và phân trang; hướng dẫn 4 bước và giải thích hai loại voucher. |
| Search/Explore | Search theo tên/Brand, lọc danh mục/Brand/giá và sort từ API; lọc Cashback/Stored-Value phía frontend trên toàn bộ các trang kết quả phù hợp; skeleton, empty/error, pagination; filter dialog dùng native dialog với Escape và focus management của trình duyệt. |
| Voucher Card | Brand, tên, loại, quyền lợi, giá mua, lượng bán, hạn dùng, chi tiết và yêu thích; link thật hỗ trợ bàn phím. Legacy giữ ý nghĩa Discount/Prepaid/Combo. |
| Voucher Detail | Bố cục hai cột trên desktop, ảnh/Brand/nội dung/chi nhánh/review ở cột chính; khối mua sticky hiển thị quyền lợi, giá, tồn kho, hạn và CTA. Giữ chuyển tiếp checkout cũ. |
| Wallet | Intro, grid vé, nhóm trạng thái và số lượng thực; thông tin quyền lợi, mã tra cứu, hạn dùng, chi tiết; canRedeem/offline vẫn theo điều kiện cũ. |
| Wallet Detail | Bổ sung điều kiện sử dụng và các mốc mua/sử dụng/hoàn tất từ timestamp có thật. Không thay đổi mã QR/OTP hoặc điều kiện hiện mã. |
| Cashback Panel | Phân cấp trạng thái và số tiền; giữ nguyên confirm/dispute, attestation, reminder 72h và nội dung biên nhận. Merchant reported paid vẫn là chờ khách kiểm tra. |
| Orders | Card hàng ngang trên desktop, mã đơn, ngày mua, số lượng, tổng tiền, trạng thái và nút chi tiết; giữ hành động thanh toán tiếp theo điều kiện cũ. |
| Profile | Avatar, thông tin cá nhân, chỉnh sửa hồ sơ, yêu thích, thông báo, refund, notification settings và logout. Không thêm đổi mật khẩu Customer không tồn tại. |
| Customer Login | Split screen trên desktop, email → OTP, autocomplete, lỗi inline, busy/cooldown, đổi email và link cổng quản lý. Không tạo route đăng ký hoặc password giả. |
| Management Login | Branding SaaS, email/password, hiện/ẩn mật khẩu, lỗi inline, loading, forgot password và demo account disclosure. Role vẫn lấy từ backend response. |
| Activation/Reset | Sử dụng cùng AuthLayout, trường mật khẩu hiện/ẩn; giữ request và validation hiện tại. |

Các trang phụ như checkout, payment result, refund, thông báo và Brand public nhận theme Customer dùng chung. Không viết lại hành vi thanh toán hoặc xử lý callback.

## C. File và component

Mới:

- `frontend/src/components/Icon.jsx`: SVG icons dùng chung, chuyển từ dashboard.
- `frontend/src/components/AuthLayout.jsx`: layout Customer/Management authentication.
- `frontend/src/styles/design-system.css`: brand primitives và styles dùng chung.
- `frontend/src/styles/auth.css`: authentication layout.
- `frontend/src/customer/MarketplaceUI.jsx`: VoucherBenefit, CatalogSkeleton, Pagination.
- `frontend/src/customer/marketplace.css`: storefront layout, catalog, detail, wallet, profile và orders.
- `frontend/src/utils/catalog.js`: nạp đầy đủ API pages trước khi lọc loại voucher mà backend chưa hỗ trợ.
- `frontend/test/catalog.test.mjs`, `frontend/test/benefits.test.mjs`: kiểm tra phân trang, lọc loại và ngữ nghĩa quyền lợi.

Sửa trong task này:

- `frontend/src/customer/Layout.jsx`, `Explore.jsx`, `Search.jsx`, `Campaign.jsx`, `Account.jsx`, `Wallet.jsx`, `CashbackPanel.jsx`.
- `frontend/src/web/WebApp.jsx`: chỉ phần giao diện authentication; giữ Shell/RequireRole và mapping HOME.
- `frontend/src/web/Dashboard.jsx`, `dashboard.css`: chỉ tách Icon/tham chiếu tokens chung, giữ giao diện dashboard.
- `frontend/src/main.jsx`: nạp shared styles.
- `frontend/src/App.jsx`: lazy-load Management bundle với Suspense; không đổi URL/route guards.
- `frontend/package.json`: thêm lệnh frontend `npm test`.

Không thêm dependency. Không sửa API client, backend, schema, validators, .env, secrets hoặc lockfile. Không commit/push. Các thay đổi từ task dashboard trước đó và artifact đang có được bảo toàn.

## D. Authentication verification

| Hạng mục | Kết quả thực tế |
| --- | --- |
| Customer OTP UI | Đã nhập `khach@voucher.local`, gửi OTP, điền mã demo từ UI, xác nhận thành công và redirect về `/`. |
| Customer session | Đã dùng phiên tồn tại trước khi test; sau OTP mới đã mở ví, đơn hàng và profile bằng session mới. |
| Customer logout/guard | Đã logout bằng UI, sau đó vào `/wallet` và thấy redirect `/login?next=%2Fwallet`. |
| Admin/Owner/Staff auth | Backend regression PASS cho các tài khoản/role theo fixture test. HOME mapping, setSession, refresh client và RequireRole giữ nguyên source. Chưa hoàn tất đăng nhập lại ba role bằng giao diện mới trong lần kiểm tra này. |
| Management session restore | Source không thay đổi cơ chế; chưa xác minh lại bằng UI sau khi triển khai authentication mới. |
| Password reset/activation | Chỉ thay UI; không submit đổi mật khẩu trong kiểm tra. |
| Customer đăng ký | Luồng tạo tài khoản qua OTP hiện có được giữ; không tạo tài khoản mới chỉ để demo. |

Người dùng đã dừng computer-use bằng Escape và yêu cầu tập trung desktop; không tiếp tục điều khiển Chrome sau đó. Chrome có thể còn ở chế độ Device Toolbar/DevTools từ lần kiểm tra trước khi dừng; đóng DevTools để trở về cửa sổ web bình thường.

## E. Functional regression

- **Frontend tests: 6/6 PASS**, `npm test` tại frontend.
  - Cashback: đúng tỷ lệ, mức tối đa, hóa đơn tối thiểu và trách nhiệm Merchant; không mô tả giảm trực tiếp.
  - Stored-Value: đúng mệnh giá, tiết kiệm, sử dụng một lần và không có số dư.
  - Legacy Discount: giữ mức giảm và trần giảm.
  - Lọc loại bao gồm kết quả nằm sau trang 100 phần tử đầu tiên; total/page đúng.
  - Không chọn loại thì giữ pagination server; không tải toàn bộ catalog.
  - Lỗi một trang tiếp theo được báo lỗi, không coi tập kết quả thiếu là đầy đủ.
- **Frontend build: PASS**, `npm run build`. Đã chia bundle Management; build cuối không còn cảnh báo chunk chính vượt 500 kB.
- **Backend regression: 39/39 PASS**, `npm test` tại backend. Chạy trên MongoDB tạm riêng. Bao gồm auth, RBAC, campaign creation/approval, marketplace, order/payment, QR/OTP, redemption, cashback settlement/dispute và concurrency.
- **Browser checks: PARTIAL**, không tuyên bố Browser E2E đầy đủ PASS.
  - Đã mở trang chủ, xem catalog thật, bấm CTA khám phá, thực hiện Customer OTP login, mở Wallet/Orders/Profile và logout/guard.
  - Đã quan sát Home desktop 1440/1024 trước điều chỉnh phạm vi; các màn hình tài khoản được quan sát ở viewport mô phỏng 375 trước khi người dùng yêu cầu chỉ desktop.
  - Chưa hoàn tất kiểm tra UI filter dialog, voucher detail, checkout, Management login mới và Admin Dashboard sau thay đổi shared imports.
  - Console trên Home sau clear/reload chỉ có 2 React Router future warnings; không thấy request đỏ hoặc lỗi render ở lần quan sát đó. Chưa audit network/console cho toàn bộ workflow.

Catalog local trả về 9 voucher legacy (3 COMBO, 4 PREPAID, 2 DISCOUNT) ở thời điểm kiểm tra. Không thêm dữ liệu CASHBACK/STORED_VALUE vào database local. Hai loại mới được xác minh bằng frontend render tests và backend regression; chưa xác minh bằng Browser E2E với campaign mới trong task này.

## F. Screenshot

Ảnh là Chrome thực tế, không phải mockup:

- [Home desktop](artifacts/marketplace-redesign/home-desktop.png)
- [Home viewport 1440](artifacts/marketplace-redesign/home-1440.png)
- [Home viewport 1024](artifacts/marketplace-redesign/home-1024.png)

Các ảnh kiểm tra responsive đã chụp trước khi đổi phạm vi được giữ ở `artifacts/marketplace-redesign/` cùng ảnh Wallet/Orders/Profile/Customer Login. Không tiếp tục chụp hoặc nghiệm thu mobile/tablet theo yêu cầu mới.

## G. Mở bản web

- Marketplace: `http://localhost:5173/`
- Tìm voucher: `http://localhost:5173/search`
- Customer OTP login: `http://localhost:5173/login`
- Management login: `http://localhost:5173/web/login`

Customer và Management tiếp tục dùng hai session riêng như kiến trúc hiện tại. Không có giao dịch thật, mua voucher hoặc chuyển tiền được thực hiện bằng UI trong task này.
