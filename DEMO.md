# Kịch bản demo Voucher Platform

Tài liệu này đi lần lượt từng chức năng theo đúng thứ tự trong "Hướng dẫn sử dụng ứng dụng Voucher Platform".
Mỗi bước ghi: **làm gì → kết quả phải thấy**.

---

## 0. Chuẩn bị

| Việc | Cách làm |
|---|---|
| Chạy hệ thống | Mở terminal tại `D:\sdn\chinh be`, chạy `npm run dev`. Chờ thấy `[mail] SMTP san sang` và `[api] ... chay tai http://localhost:3000/api` |
| Làm sạch dữ liệu (nên làm trước mỗi buổi demo) | `npm run seed`. **Lưu ý:** lệnh này xóa toàn bộ dữ liệu, kể cả tài khoản khách đã đăng nhập bằng email thật |
| Mở 3 cửa sổ trình duyệt | (1) **App khách hàng** http://localhost:5173. (2) **Web cửa hàng** http://localhost:5173/web, dùng cửa sổ ẩn danh. (3) **Web quản trị / thương hiệu** http://localhost:5173/web, dùng trình duyệt khác (Edge / Chrome) |

Vì sao cần 3 cửa sổ: mỗi trình duyệt chỉ giữ một phiên đăng nhập web, mà demo cần nhân viên và quản trị viên đăng nhập cùng lúc.

### Tài khoản

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách hàng | Email thật của bạn, ví dụ `phuongchinh22102003@gmail.com` | Đăng nhập bằng mã OTP gửi về Gmail |
| Nhân viên cửa hàng | `staff@highlands.local` | `Voucher@123` |
| Chủ thương hiệu | `owner@highlands.local` | `Voucher@123` |
| Quản trị viên | `admin@voucher.local` | `Voucher@123` |

Ở màn đăng nhập web có hộp "Tài khoản demo": bấm vào một dòng là email và mật khẩu tự điền.
Nhập sai mật khẩu 5 lần thì tài khoản bị khóa 15 phút.

---

## 1. Mở ứng dụng, khách vãng lai (mục 1 trong tài liệu)

1. Mở app khách hàng, **chưa đăng nhập** → thấy ngay màn **Khám phá**: banner "Chạm để săn deal", ô tìm kiếm, danh mục, danh sách voucher.
2. Thu nhỏ cửa sổ dưới 900px → giao diện điện thoại, thanh 5 tab ở dưới. Phóng to → giao diện máy tính, 5 tab nằm trên cùng.
3. Bấm tab **Ví voucher** → bị chuyển sang màn đăng nhập. (Khách vãng lai xem và tìm được voucher; muốn mua, xem ví, yêu thích thì phải đăng nhập.)

## 2. Đăng nhập bằng mã OTP (mục 2)

1. **Cá nhân → Đăng nhập** → nhập email thật → **Gửi mã OTP**.
2. Mở Gmail → thư "`xxxxxx` là mã đăng nhập Voucher Platform" (không thấy thì xem mục Spam).
3. Nhập 6 số → **Xác nhận** → tab Cá nhân hiện tên và email.
4. Nút "Gửi lại mã" chỉ bấm được sau 60 giây đếm ngược.
5. *(Tùy chọn)* Nhập sai mã → báo "Mã OTP không hợp lệ...". Sai quá 5 lần thì mã bị hủy, phải xin mã mới.
6. Tắt rồi mở lại trình duyệt → vẫn đăng nhập (phiên được giữ trên máy).

## 3. Khám phá, tìm kiếm, bộ lọc (mục 3)

1. **Khám phá**: bấm danh mục *Cà phê & trà* → chỉ còn voucher cà phê. Bấm *Bán chạy* → sắp xếp theo số đã bán.
2. Mỗi thẻ voucher có: nhãn % giảm, logo thương hiệu, giá bán, giá gốc gạch ngang, "Đã bán N". Voucher hết hàng có nhãn đỏ **Hết hàng**.
3. **Tìm kiếm**: gõ `phuc long` (không dấu) → **Enter** → ra 3 voucher Phúc Long. Gõ `HIGHLANDS` → ra voucher Highlands (không phân biệt hoa thường).
4. Bấm **⚙️ Lọc** → chọn sắp xếp *Giá tăng dần*, *Giảm tối thiểu 30%* → **Áp dụng**. Bấm **Xóa bộ lọc** để về mặc định.

## 4. Voucher gần tôi và bản đồ chi nhánh (mục 4)

1. Tab **Tìm kiếm** → bấm **Gần tôi 3 km** → trình duyệt hỏi quyền vị trí → **Cho phép**.
   - Danh sách chỉ còn voucher có chi nhánh trong bán kính, kèm khoảng cách (ví dụ "430 m").
   - Dữ liệu mẫu đặt chi nhánh ở TP.HCM và Hà Nội. Nếu máy bạn ở xa thì có thể ra 0 kết quả; đó là đúng logic.
   - Bấm lại chip đang chọn (có dấu ✓) để tắt lọc theo vị trí.
2. Trường hợp **từ chối** quyền vị trí: trình duyệt đã nhớ lựa chọn "Cho phép" ở bước 1 nên sẽ không hỏi lại. Cần đặt lại quyền trước:
   - Bấm biểu tượng ổ khóa / ⓘ cạnh thanh địa chỉ → **Vị trí** → chọn **Chặn** (hoặc **Đặt lại quyền**) → tải lại trang (F5).
   - Bấm **Gần tôi 3 km** → nếu có hộp hỏi thì bấm **Chặn** → app vẫn dùng được, hiện thông báo "Bạn chưa cho phép truy cập vị trí..." và giữ danh sách mặc định.
   - Nhớ đặt quyền về **Cho phép** sau khi demo xong.
3. Bấm biểu tượng **🗺️** (góc phải trên) → bản đồ các chi nhánh.
   - Có quyền vị trí: bản đồ di chuyển tới vị trí của bạn (chấm đỏ).
   - Không có quyền: bản đồ tự thu phóng để thấy hết các ghim (cả TP.HCM và Hà Nội).
   - Bấm ghim → tên, địa chỉ, các voucher áp dụng và nút **➤ Chỉ đường** (mở Google Maps).

## 5. Xem chi tiết và mua voucher (mục 5) – Luồng 1

1. Mở voucher **"Voucher 100.000đ chỉ 80.000đ"** (Highlands) → thấy giá bán, giá trị, số còn lại, giới hạn 5 / tài khoản, điều kiện, thời hạn, chính sách hoàn tiền, chi nhánh áp dụng, đánh giá.
2. Bấm **🤍** góc trên → thành **❤️** (đã thêm vào Yêu thích).
3. **Mua ngay** → chọn số lượng **2** bằng nút **+** (nút + tự khóa khi đạt giới hạn) → tổng **160.000 ₫** → **Tiến hành thanh toán**.
4. Màn **Đang chờ thanh toán**: hiện "Giữ chỗ đến hh:mm", tức đơn được giữ 15 phút.
5. Bấm **Thanh toán thử (demo)** → **Thanh toán thành công** → **Xem voucher trong ví**.
   - *Giải thích khi demo:* khi chưa cấu hình VNPAY Sandbox thì dùng nút giả lập. Nút này xử lý y như IPN thật: chống xử lý trùng và đối chiếu số tiền.
6. Chuông thông báo có số đỏ → thông báo **"Voucher đã về ví"**.

### Nhánh ngoại lệ của Luồng 1 (nếu có thời gian)

| Tình huống | Cách làm | Kết quả |
|---|---|---|
| Vượt giới hạn mua | Voucher "Trà sữa Phúc Long mua 1 tặng 1": mua 5, chưa thanh toán; quay lại mua thêm 1 | "Bạn đã đạt giới hạn 5 voucher cho chiến dịch này." (đơn đang chờ cũng được tính) |
| Thanh toán lại | Tab **Đơn hàng** → đơn chờ có nút **Thanh toán lại** | Mở lại đúng đơn cũ, không tạo đơn mới |
| Thanh toán thất bại | Ở màn chờ bấm **Thanh toán thất bại** | Đơn **Đã hủy**, số lượng trả lại kho |
| Sai số tiền | Ở màn chờ bấm **Thanh toán sai số tiền** | "Số tiền không khớp", không phát hành voucher. Quản trị viên xử lý ở bước 9.4 |
| Quá 15 phút | Để đơn chờ hơn 15 phút | Tác vụ nền (5 phút / lần) tự hủy đơn và trả kho |

## 6. Ví voucher (mục 6)

1. Tab **Ví voucher** có 4 tab: **Đang hiệu lực / Đã dùng / Hết hạn / Đã hoàn**.
2. Bấm một voucher → chi tiết: **mã tra cứu**, ngày mua, hạn sử dụng, **Chi nhánh áp dụng**, **Hạn chót yêu cầu hoàn tiền** (= sớm hơn giữa "ngày mua + 7 ngày" và "hạn dùng − 3 ngày").
3. Nhấn mạnh: mã tra cứu chỉ để đối chiếu, **không dùng để sử dụng voucher**.
4. *(Tùy chọn)* Tắt backend → tải lại ví → vẫn xem được danh sách đã lưu, kèm thông báo "Đang mất mạng", và không hiện nút "Sử dụng ngay".

## 7. Sử dụng voucher tại cửa hàng (mục 7) – Luồng 2

**Cửa sổ web cửa hàng:**
1. Đăng nhập `staff@highlands.local` → màn **Chọn chi nhánh làm việc** → chọn **Highlands Lê Lợi**.

**Cửa sổ app khách:**
2. Ví → voucher Highlands vừa mua → **Sử dụng ngay** → hiện **mã QR + OTP 6 số**, đồng hồ "Còn hiệu lực 60s". Hết 60 giây mã tự đổi; bấm **Làm mới mã** thì mã cũ mất hiệu lực ngay.

**Cửa sổ web cửa hàng:**
3. Tab **Nhập OTP** → gõ 6 số của khách → **Xác nhận sử dụng** (cố ý để trống ô hóa đơn).
   → Báo **"Mã của khách vẫn còn hiệu lực. Nhập giá trị hóa đơn rồi gửi lại"** (voucher mệnh giá bắt buộc nhập hóa đơn).
4. Nhập **Giá trị hóa đơn = 120000** → **➤ Gửi lại kèm hóa đơn** → màn xanh **HỢP LỆ** (tên voucher, mã voucher, giờ xác nhận, hóa đơn).
   - Muốn demo quét QR: tab **Quét QR** → **Bật camera** → đưa mã QR trên điện thoại vào. Nếu máy không có camera: trên app mở "Demo trên cùng một máy: sao chép nội dung mã QR", dán vào ô bên dưới camera.

**Cửa sổ app khách:**
5. Màn mã QR **tự chuyển** sang **"Voucher đã được sử dụng"** (trong vòng 2 giây), có thông báo "Đã sử dụng voucher tại Highlands Lê Lợi".

**Nhánh ngoại lệ (web cửa hàng):**

| Tình huống | Cách làm | Kết quả |
|---|---|---|
| Dùng lại mã | **Khách tiếp theo** → nhập lại cùng OTP | Màn đỏ **ĐÃ SỬ DỤNG** kèm giờ và chi nhánh đã dùng |
| Mã cũ | Khách bấm Làm mới mã, nhân viên nhập mã cũ | Báo mã đã được thay bằng mã mới / hết hiệu lực |
| Sai chi nhánh | Khách dùng voucher Phúc Long hoặc CGV đưa cho nhân viên Highlands | **SAI CHI NHÁNH** kèm danh sách chi nhánh áp dụng |
| Nhập sai OTP | Nhập 6 số bất kỳ 5 lần | Báo còn mấy lần thử; lần thứ 5 khóa ô OTP 15 phút (vẫn quét QR được) |

6. Menu **Lịch sử trong ngày** → lượt vừa xác nhận. Nút **✎ Sửa hóa đơn** chỉ dùng được trong 10 phút sau khi xác nhận.

## 8. Đánh giá sau khi dùng (mục 8)

1. App → Ví → tab **Đã dùng** → voucher vừa dùng ghi rõ thời gian và chi nhánh sử dụng.
2. **☆ Đánh giá** → chọn 5 sao → viết nhận xét (tối đa 1000 ký tự) → **Gửi đánh giá** → chi tiết voucher hiện "Bạn đã đánh giá chiến dịch này".
3. Mở lại chi tiết voucher "Voucher 100.000đ chỉ 80.000đ" → mục **Đánh giá (1)** hiện đánh giá vừa viết. Tên người đánh giá được rút gọn, ví dụ họ tên "Phương Chính" hiện là "Chính P." (đặt họ tên ở Cá nhân → Sửa hồ sơ).
4. **Web thương hiệu** (`owner@highlands.local`) → **Đánh giá** → **Phản hồi** → nhập nội dung. App hiện "Phản hồi của thương hiệu". Mỗi đánh giá chỉ phản hồi một lần.
5. **Web quản trị** → **Đánh giá** → **Ẩn đánh giá** (nhập lý do) → đánh giá biến khỏi app; **Hiện lại** để khôi phục.

## 9. Yêu cầu hoàn tiền (mục 9) – Luồng 4

Điều kiện hoàn tiền: voucher **chưa dùng**, trong **7 ngày** kể từ khi mua, còn ít nhất **3 ngày** trước hạn dùng. Hoàn đúng đơn giá của từng voucher.

Kết quả của cổng hoàn tiền được chọn ở **Web quản trị → Hoàn tiền thủ công**, ô "Cổng hoàn giả lập": **Thành công / Từ chối / Không phản hồi**. Đổi bất cứ lúc nào, không cần khởi động lại.

### 9.1 Hoàn thành công
1. Quản trị: chọn **Thành công**.
2. App: mua 1 voucher **"Cặp vé xem phim 2D cuối tuần"** (thanh toán thử).
3. Ví → mở voucher đó → **⟲ Yêu cầu hoàn tiền** → thấy số tiền hoàn dự kiến và hạn chót → nhập lý do (không bắt buộc) → **Gửi yêu cầu**.
4. Kết quả hiện ngay: **"Hoàn tiền thành công 150.000 ₫"**. Voucher sang tab **Đã hoàn**, có thông báo "Kết quả hoàn tiền".

### 9.2 Cổng từ chối
1. Quản trị: chọn **Từ chối**. App: mua thêm 1 vé CGV → yêu cầu hoàn.
2. Kết quả: **"Hoàn tiền không thành công"**, voucher được **khôi phục** trong tab Đang hiệu lực.

### 9.3 Cổng không phản hồi → quản trị viên hoàn tay
1. Quản trị: chọn **Không phản hồi**. App: mua 1 **"Phiếu mua mỹ phẩm 300.000đ"** → yêu cầu hoàn.
2. Kết quả: **"Chờ quản trị viên hoàn tiền"**. Ví hiện nhãn **Đang hoàn tiền**; bấm Sử dụng ngay sẽ bị chặn (voucher đang chờ hoàn không dùng được).
3. Quản trị: **Hoàn tiền thủ công** → tab *Hoàn tiền thủ công (1)* → thấy khách, số tiền, giao dịch gốc → **✓ Đã hoàn tiền** → nhập mã giao dịch, ví dụ `MB-REF-0001` → Xác nhận.
4. App: **Cá nhân → Yêu cầu hoàn tiền** → dòng thời gian đủ các bước và "Mã giao dịch hoàn: MB-REF-0001".
5. Nhớ đặt lại cổng về **Thành công**.

### 9.4 Đơn sai số tiền (tiếp nối nhánh ngoại lệ ở bước 5)
Quản trị: **Hoàn tiền thủ công** → tab **Đơn lệch số tiền** → thấy số phải trả và số đã nhận → **✓ Đã hoàn tiền** → nhập mã giao dịch. Khách nhận thông báo đã hoàn.

### 9.5 Không đủ điều kiện
Yêu cầu hoàn với voucher **đã dùng** → nút Yêu cầu hoàn tiền bị khóa, kèm dòng đỏ "Voucher đã được sử dụng nên không thể hoàn tiền."

## 10. Thông báo và cài đặt thông báo (mục 10)

1. Chuông ở góc trên có **số thông báo chưa đọc**; thông báo chưa đọc được tô nền đậm.
2. Bấm một thông báo → mở đúng màn liên quan (đơn hàng / ví / hoàn tiền / chiến dịch).
3. **Đọc tất cả** → số trên chuông về 0.
4. **⚙️** → **Cài đặt thông báo**: tắt "Voucher đã sử dụng", rồi dùng thêm một voucher → không nhận thông báo đó nữa.
5. **Cá nhân → Cho phép thông báo trên thiết bị** → khi app đang mở, thông báo mới còn hiện trên thanh thông báo của Windows / điện thoại.

## 11. Đơn hàng, hồ sơ, yêu thích, đăng xuất (mục 11)

1. **Đơn hàng**: danh sách đơn kèm trạng thái (Đã phát hành voucher / Chờ thanh toán / Đã hủy / Sai số tiền). Đơn chờ có **Thanh toán lại**; nút ⟳ để làm mới.
2. **Cá nhân → Sửa hồ sơ**: đổi họ tên, số điện thoại.
3. **Cá nhân → Yêu thích**: voucher đã bấm ❤️ và thương hiệu đang theo dõi.
4. Theo dõi thương hiệu: chi tiết voucher → bấm thẻ thương hiệu → **+ Theo dõi**. Khi thương hiệu đó có chiến dịch mới được phát hành, khách nhận thông báo "... có ưu đãi mới".
5. **Đăng xuất** → xóa dữ liệu tài khoản trên máy, ví quay về yêu cầu đăng nhập.

---

## 12. Chiến dịch, phê duyệt, đối soát – Luồng 3 (phía web)

### 12.1 Chủ thương hiệu tạo chiến dịch
1. Web: `owner@highlands.local` → **Chiến dịch** → **+ Tạo chiến dịch**.
2. Điền: Tiêu đề *"Bánh croissant tặng kèm cà phê"*, Loại *Combo*, Nội dung gói, Giá bán 39000, Giá trị 55000, Bắt đầu bán = **hôm nay (giờ đã qua)**, Kết thúc bán = +30 ngày, chọn chi nhánh Lê Lợi.
3. Cố ý đặt **Hạn sử dụng** chỉ +35 ngày → **Lưu nháp** → báo lỗi "Hạn sử dụng voucher phải sau ngày kết thúc bán ít nhất 10 ngày". Sửa thành +45 ngày → lưu được, trạng thái **Nháp**.
4. **➤ Gửi duyệt** → **Chờ duyệt**. Lúc này không có nút Sửa (chiến dịch bị khóa); muốn sửa phải **↩ Rút về nháp**.

### 12.2 Quản trị viên duyệt
1. Web quản trị → **Duyệt chiến dịch** → thấy đủ thông tin chiến dịch.
2. **✕ Từ chối** → nhập lý do *"Thiếu ảnh"*. Bên thương hiệu: chiến dịch về **Nháp**, hiện "Bị từ chối: Thiếu ảnh".
3. Thương hiệu sửa (ví dụ thêm điều kiện áp dụng) → Gửi duyệt lại → quản trị **✓ Duyệt**.
4. Ngày bắt đầu bán đã tới nên chiến dịch chuyển ngay sang **Đang bán**; app khách thấy voucher mới ở Khám phá.
   - Nếu ngày bắt đầu ở tương lai: trạng thái **Đã duyệt**, tác vụ nền 5 phút / lần sẽ tự phát hành khi tới ngày. Muốn chạy ngay, bấm **⟳ Chạy rà soát trạng thái** ở trang Duyệt chiến dịch.
5. Thương hiệu: **❚❚ Tạm dừng** → app không mua được; **▶ Tiếp tục bán** để mở lại. Sửa chiến dịch đang bán → chuyển về **Chờ duyệt** lại. Chiến dịch đã bán được voucher thì không sửa được giá và hạn dùng.

### 12.3 Hoa hồng và đối soát
1. Quản trị → **Tỷ lệ hoa hồng**: đang 10%. Đổi thành 15% → chỉ áp dụng cho đơn thanh toán **sau** thời điểm lưu; đơn cũ giữ tỷ lệ đã chốt. Nhớ đổi lại 10%.
2. Quản trị → **Đối soát** → **⊙ Chốt đối soát tháng trước** → Chốt → "Đã tạo 2 phiếu đối soát":
   - **Highlands Coffee**: 3 voucher, doanh thu gộp 240.000 ₫, hoa hồng 24.000 ₫, **thực nhận 216.000 ₫**.
   - **Phúc Long**: 2 voucher, thực nhận 99.000 ₫.
   - *Giải thích:* chỉ tính voucher **đã hết quyền hoàn** (đã dùng / hết hạn / quá hạn hoàn). Voucher Highlands mua cuối tháng trước vẫn còn trong hạn hoàn nên **không** vào phiếu.
3. Bấm Chốt lần nữa → "Đã tạo 0 phiếu" (không sinh phiếu trùng).
4. **✓ Đánh dấu đã chi trả** phiếu Highlands → nhập mã chuyển khoản `VCB-0001` → **Đã chi trả**.
5. Web thương hiệu → **Đối soát** → thấy phiếu **Đã chi trả** kèm mã giao dịch.
6. Hệ thống tự chốt lúc 01:00 ngày 01 hằng tháng (giờ Việt Nam). Muốn chốt lại từ đầu thì chạy `npm run seed`.

## 13. Các chức năng quản lý khác

| Chức năng | Ở đâu | Demo |
|---|---|---|
| Chi nhánh | Thương hiệu → **Chi nhánh** | Thêm chi nhánh (bắt buộc có vĩ độ / kinh độ). **Vô hiệu hóa** chi nhánh áp dụng cuối cùng của chiến dịch mà khách còn voucher → bị chặn kèm lý do |
| Nhân viên | Thương hiệu → **Nhân viên** | Gán **email thật** vào chi nhánh → người đó nhận email kích hoạt, tự đặt mật khẩu tại `/web/activate`. **Vô hiệu hóa** → nhân viên bị đăng xuất ngay |
| Báo cáo | Thương hiệu → **Báo cáo** | Lọc theo ngày / chiến dịch / chi nhánh: số đã bán, doanh thu, tỷ lệ sử dụng, bảng theo chiến dịch |
| Hồ sơ thương hiệu | Thương hiệu → **Hồ sơ thương hiệu** | Sửa logo, mô tả, tài khoản nhận tiền |
| Duyệt thương hiệu | Quản trị → **Duyệt thương hiệu** → lọc *Chờ duyệt* | Duyệt hồ sơ **Circle K**. **Đình chỉ** thương hiệu → mọi chiến dịch đang bán chuyển Tạm dừng; **Khôi phục** |
| Bảng điều khiển | Quản trị → **Bảng điều khiển** | Doanh thu, hoa hồng, số giao dịch, biểu đồ doanh thu theo ngày, số việc chờ xử lý |
| Danh mục | Quản trị → **Danh mục ngành hàng** | Thêm / xóa danh mục (không xóa được danh mục đang dùng) |
| Quên mật khẩu | Màn đăng nhập web → **Quên mật khẩu?** | Gửi liên kết đặt lại qua email (chỉ dùng được với tài khoản có email thật) |

---

## 14. Câu hỏi thường gặp khi demo (mục 12)

| Tình huống | Xử lý |
|---|---|
| Không nhận được OTP | Xem mục Spam; đợi 60 giây rồi bấm "Gửi lại mã". Mỗi email tối đa 5 lần / giờ |
| Thanh toán xong chưa thấy voucher | Ở màn kết quả bấm **⟳ Kiểm tra lại**, hoặc làm mới Ví / Đơn hàng |
| Nhân viên báo mã không hợp lệ | Khách bấm **Làm mới mã**; kiểm tra voucher có áp dụng tại chi nhánh đó |
| Web không đăng nhập được | Có thể đang bị khóa 15 phút do sai 5 lần (thông báo ghi rõ giờ mở khóa). Xóa ô mật khẩu rồi tự gõ lại `Voucher@123` (trình duyệt có thể tự điền mật khẩu cũ) |
| Hết voucher để demo lại | Mỗi tài khoản giới hạn 4–5 voucher / chiến dịch: đổi sang chiến dịch khác hoặc chạy `npm run seed` |
| "Gần tôi" không có kết quả | Dữ liệu mẫu ở TP.HCM / Hà Nội; bán kính tối đa 5 km |
