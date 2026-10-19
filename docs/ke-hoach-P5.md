# Kế hoạch P5: đăng nhập bằng email và mật khẩu (coi như đã được giảng viên duyệt)

## API (apps/api)
- **Mật khẩu chỉ lưu bản băm**: dùng `scrypt` có sẵn của Node (`node:crypto`), mỗi mật khẩu một muối ngẫu nhiên; cột mới `users.password_hash` (định dạng `scrypt$N$r$p$muối$băm`). So sánh bằng `timingSafeEqual`. Không thêm thư viện.
- **Phiên lưu trong database**: bảng mới `sessions` (user_id, token_hash, expires_at). Trình duyệt giữ một mã ngẫu nhiên 32 byte; trong DB chỉ lưu `HMAC-SHA256(SESSION_SECRET, mã)` nên lộ file DB cũng không dựng lại được cookie. Hết hạn sau 7 ngày; đăng xuất thì xóa dòng; người dùng bị khóa (active = 0) thì phiên vô hiệu.
- **Cookie**: `ces_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` khi `COOKIE_SECURE=true` (khi chạy https).
- **Giới hạn đăng nhập sai**: bảng `login_attempts`; quá 10 lần sai trong 15 phút (tính theo email) thì trả 429 "đăng nhập sai quá nhiều lần", kể cả nhập đúng mật khẩu. Đăng nhập đúng thì xóa bộ đếm. Email không tồn tại cũng bị đếm (không lộ email nào có tài khoản). Thông báo sai luôn là một câu chung.
- **Origin lạ**: mọi request ghi (POST/PATCH/PUT/DELETE) có header `Origin` không nằm trong `ALLOWED_ORIGINS` bị từ chối 403. Không có header Origin (curl, kiểm thử) thì cho qua vì đó không phải trình duyệt chéo trang.
- **Route**: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Chưa đăng nhập thì mọi route khác (trừ /health) trả 401.
- **Secret trong .env**: `SESSION_SECRET` (bắt buộc, tối thiểu 32 ký tự; API không khởi động nếu thiếu), `ALLOWED_ORIGINS`, `COOKIE_SECURE`, `SEED_PASSWORD` (mật khẩu chung cho tài khoản mẫu). `.env.example` chỉ có giá trị giữ chỗ.
- **Seed**: cả 10 người dùng mẫu (đủ 4 vai trò) có tài khoản, mật khẩu lấy từ `SEED_PASSWORD`. Chạy `pnpm db:seed` lại không trùng.
- Cột mới cho DB cũ: `migrate()` tự thêm cột `password_hash` nếu bảng users đã có từ buổi 2.

## Web (apps/web)
- Trang `/login` (email, mật khẩu, lỗi tiếng Việt), nút "Đăng xuất" cuối menu, trang `/ho-so` (tên, email, vai trò).
- Chưa đăng nhập vào trang nào cũng chuyển về `/login` (kiểm ở trình duyệt qua `GET /api/auth/me`). Khi API trả 401 giữa chừng cũng chuyển về `/login`.
- Lược đồ đăng nhập (Zod) đặt ở `packages/shared`, web và API dùng chung.

## Kiểm
- Kiểm thử tự động: băm đúng (không lưu mật khẩu thô), đăng nhập đúng/sai, cookie HttpOnly, phiên lưu DB, đăng xuất, hết hạn, khóa 10 lần/15 phút (đồng hồ giả), Origin lạ bị chặn, 401 khi chưa đăng nhập, seed chạy hai lần.
- typecheck, `pnpm dev`, curl qua proxy, thử trong trình duyệt. Dọn tiến trình. Commit "P5: đăng nhập".
