# Cách tự thử vượt quyền

Mục đích: tự đóng vai "kẻ gian" hoặc "người dùng tò mò" để chắc rằng mỗi vai trò chỉ làm được đúng phần của mình. Mọi cách dưới đây **đã có kiểm thử tự động** (cột "Kiểm thử"); bạn vẫn nên thử vài cách bằng tay để tận mắt thấy.

## 0. Chuẩn bị
1. `pnpm db:reset` (đưa dữ liệu mẫu về trạng thái sạch), rồi `pnpm dev`, mở http://localhost:3000.
2. Tài khoản mẫu (mật khẩu chung là giá trị `SEED_PASSWORD` trong `apps/api/.env`, không ghi ra file này):

| Vai trò | Email |
|---|---|
| Admin | quan.nguyen@cesglobal.vn |
| Quản lý tuyển sinh | ha.tran@cesglobal.vn |
| Tư vấn viên (Lê Hoàng Nam, có 7 khách) | nam.le@cesglobal.vn |
| Tư vấn viên khác (Phạm Thị Lan) | lan.pham@cesglobal.vn |
| Quản lý lớp học (Hoàng Thanh Tùng) | tung.hoang@cesglobal.vn |

3. Chạy toàn bộ kiểm thử tự động: `pnpm test` (riêng phần quyền: `pnpm --filter @ces/api exec node --test src/routes/phan-quyen.test.ts`).

## 1. Thử bằng giao diện (mỗi cách vài phút)
- **G1. Menu theo vai trò.** Đăng nhập Tư vấn viên: menu không có "Lớp học", "Người dùng", "Nhật ký". Gõ thẳng `localhost:3000/nguoi-dung` vào thanh địa chỉ: phải hiện "Bạn không có quyền xem trang này". (Lưu ý: ẩn menu chỉ để gọn mắt, lớp bảo vệ thật là API, xem phần 2.)
- **G2. Tư vấn viên chỉ thấy khách của mình.** Đăng nhập Lê Hoàng Nam: danh sách khách chỉ 7 người, cột "Người phụ trách" toàn "Lê Hoàng Nam". Tìm "Trần Thị Mai Anh" (khách của Phạm Thị Lan): không ra gì.
- **G3. Tư vấn viên không giao khách.** Mở form "Thêm khách" hoặc "Sửa": không có ô "Người phụ trách". Khách thêm mới tự thuộc về mình.
- **G4. Quản lý lớp học.** Đăng nhập Hoàng Thanh Tùng: chỉ 9 khách giai đoạn "Đăng ký", không có nút "Thêm khách" hay "Sửa". Trang "Việc cần làm" chỉ có việc nhắc học phí / nhắc buổi học / đánh giá cuối khóa; "Thêm việc" chỉ cho chọn ba loại này và bắt buộc chọn một khách đã đăng ký.
- **G5. Hết phiên.** Đăng nhập, bấm "Đăng xuất", bấm nút Back của trình duyệt: không xem lại được dữ liệu, bị đưa về trang đăng nhập.

## 2. Thử bằng lệnh (curl) — chỉ API, bỏ qua giao diện
Trên Windows hãy gõ `curl.exe` (không phải `curl`). Đăng nhập một lần, lưu cookie vào file, các lệnh sau dùng lại cookie đó:

```
curl.exe -s -c tv1.txt -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d "{\"email\":\"nam.le@cesglobal.vn\",\"password\":\"<SEED_PASSWORD>\"}"
curl.exe -s -c admin.txt -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d "{\"email\":\"quan.nguyen@cesglobal.vn\",\"password\":\"<SEED_PASSWORD>\"}"
```
Lấy id của khách thuộc người khác (dùng admin): `curl.exe -s -b admin.txt "http://localhost:3000/api/leads?q=0912345602"` rồi copy giá trị `"id"` (gọi là `<ID_KHACH_KHAC>`).

| Thử | Lệnh | Kết quả đúng |
|---|---|---|
| Không đăng nhập | `curl.exe -s -w " [%{http_code}]" http://localhost:3000/api/leads` | 401 "Vui lòng đăng nhập" |
| Mở khách người khác | `curl.exe -s -b tv1.txt -w " [%{http_code}]" http://localhost:3000/api/leads/<ID_KHACH_KHAC>` | 404 "Không tìm thấy khách hàng" |
| Sửa khách người khác | `curl.exe -s -b tv1.txt -w " [%{http_code}]" -X PATCH http://localhost:3000/api/leads/<ID_KHACH_KHAC> -H "Content-Type: application/json" -d "{\"stage\":\"khong_theo\"}"` | 404 (dữ liệu không đổi) |
| Tìm số điện thoại khách người khác | `curl.exe -s -b tv1.txt "http://localhost:3000/api/leads?q=0912345602"` | `"total":0` |
| Tự đổi người phụ trách | lấy `<ID_KHACH_CUA_MINH>` từ `curl.exe -s -b tv1.txt http://localhost:3000/api/leads`, rồi `... -X PATCH .../api/leads/<ID_KHACH_CUA_MINH> -d "{\"ownerId\":null}"` | 403 "Bạn không có quyền đổi người phụ trách" |
| Trang giả mạo (Origin lạ) | `curl.exe -s -b admin.txt -w " [%{http_code}]" -X POST http://localhost:3000/api/leads -H "Origin: http://trang-gia-mao.example" -H "Content-Type: application/json" -d "{}"` | 403 "nguồn gửi không hợp lệ" |

Sau khi thử xong, xóa `tv1.txt` và `admin.txt` (chứa cookie đăng nhập).

## 3. Danh sách đầy đủ các cách vượt quyền và kiểm thử tự động tương ứng
File kiểm thử: `apps/api/src/routes/phan-quyen.test.ts` (mã V01–V26), `apps/api/src/routes/auth.test.ts` (đăng nhập, Origin, khóa 10 lần).

| Mã | Cách thử | Kết quả đúng | Kiểm thử |
|---|---|---|---|
| V01 | Gọi API khi chưa đăng nhập (mọi route trừ /health và đăng nhập) | 401 | `[V01]` |
| V02 | Gửi cookie giả, tự đặt header `x-user-id`, `x-role`, `Authorization`, thêm `?role=admin` | vẫn 401, hoặc vẫn chỉ thấy phần của mình | `[V02]` |
| V03 | Tư vấn viên mở khách người khác bằng id | 404, giống hệt id không tồn tại | `[V03]` |
| V04 | Tư vấn viên sửa khách người khác (tên, giai đoạn, người phụ trách, SĐT) | 404, dữ liệu và nhật ký không đổi | `[V04]` |
| V05 | Tư vấn viên liệt kê, tìm theo tên hoặc SĐT khách khác, lọc `ownerId=người khác` hoặc `none`, lật trang, xem danh sách chọn | chỉ thấy khách mình; danh sách chọn không lộ khách và email người khác | `[V05]` |
| V06 | Tư vấn viên tự đổi/bỏ người phụ trách; thêm khách gán cho người khác | 403 (gửi lại chính mình thì được; để trống = chính mình) | `[V06]` |
| V07 | Tư vấn viên "nhận" khách chưa giao | 404 (khách chưa giao chỉ Admin và Quản lý tuyển sinh thấy) | `[V07]` |
| V08 | Quản lý lớp học thêm khách; sửa khách đăng ký; sửa/mở khách chưa đăng ký | 403; 403; 404 | `[V08]` |
| V09 | Quản lý lớp học lọc `stage=moi`, tìm tên khách chưa đăng ký, xem danh sách chọn | rỗng; chỉ khách Đăng ký | `[V09]` |
| V10 | Đổi giai đoạn: khách mình, khách người khác, Quản lý lớp học | ok (có nhật ký); 404; 403 | `[V10]` |
| V11 | Tư vấn viên xem việc người khác (danh sách, theo id, lọc `assigneeId`) | chỉ việc mình; 404; rỗng | `[V11]` |
| V12 | Tư vấn viên đánh dấu xong, sửa, giật về mình việc của người khác | 404, dữ liệu không đổi | `[V12]` |
| V13 | Tư vấn viên tạo việc cho người khác, hoặc chuyển việc của mình cho người khác | 403 | `[V13]` |
| V14 | Gắn việc vào khách ngoài phạm vi | 400 "Khách liên quan không tồn tại" (không phân biệt được với khách không có); việc không hiện tên khách ngoài phạm vi | `[V14]` |
| V15 | Quản lý lớp học: xem/sửa việc "gọi lại", tạo việc ngoài loại chăm sóc, tạo không gắn khách hoặc gắn khách chưa đăng ký, đổi loại việc | 404; 403; 400; 403 | `[V15]` |
| V16 | Kiểm ngược: Admin và Quản lý tuyển sinh làm được mọi thao tác (không bị chặn quá tay) | 200 | `[V16]`, hai test "BẢNG QUYỀN" |
| V17 | Gửi thêm trường lạ (`id`, `role`, `createdAt`, `password_hash`, `by_ai`), sửa người dùng qua API | bị bỏ qua / 404 | `[V17]` |
| V18 | Xóa khách, việc, người dùng bằng DELETE (kể cả Admin); PUT | 404, không có chức năng xóa | `[V18]` |
| V19 | Trang web khác (Origin lạ) bắt người đang đăng nhập ghi dữ liệu | 403, dữ liệu không đổi | `[V19]`, `auth.test.ts` |
| V20 | Tài khoản bị khóa giữa chừng vẫn dùng cookie cũ | 401 ngay | `[V20]` |
| V21 | Đoán id lạ, chèn SQL vào id và ô tìm kiếm | 404 / không lòi dữ liệu, bảng còn nguyên | `[V21]` |
| V22 | Thêm khách trùng SĐT với khách người khác để dò tên | 409 nhưng không nêu tên khách ngoài phạm vi | `[V22]` |
| V23 | Đoán các route chưa có (`/users`, `/audit-logs`, `/classes`...) | 404 (chưa đăng nhập: 401) | `[V23]` |
| V24 | Kiểm nhật ký: đúng người, đúng hành động, không lộ SĐT; thao tác bị từ chối không ghi gì | đúng | `[V24]` |
| V25 | Lỗi khi ghi nhật ký giữa chừng | thay đổi dữ liệu bị hoàn tác (cùng một giao dịch) | `[V25]` |
| V26 | Nhiều tài khoản gọi cùng lúc | mỗi người chỉ thấy phần của mình | `[V26]` |
| A1 | Đăng nhập sai quá 10 lần / 15 phút (kể cả gửi song song 30 request, kể cả email không tồn tại) | 429, hết sau 15 phút | `auth.test.ts` "khóa đăng nhập" |
| A2 | Mật khẩu lưu trong DB | chỉ bản băm scrypt, mỗi người một muối | `auth.test.ts` "MẬT KHẨU" |
| A3 | Cookie | HttpOnly, SameSite=Lax; DB chỉ lưu HMAC của mã phiên | `auth.test.ts` "đăng nhập đúng" |

## 4. Những phần chưa thử được vì chưa có API/màn hình
Khóa học và lịch khai giảng (admin sửa), lớp học, ghi danh, đóng học phí (Quản lý lớp học sửa), hoạt động/ghi chú khách, kho tri thức (admin nạp/xóa), người dùng, xem nhật ký, trợ lý AI. Khi các phần đó được làm, phải thêm kiểm thử tương tự: mỗi vai trò × mỗi thao tác, và thử như bảng trên.
