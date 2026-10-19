# AGENTS.md

## Dự án
CES CRM AI: web app CRM cho đội tư vấn tuyển sinh và quản lý lớp học của CES Global, có trợ lý AI tra cứu và làm giúp (đặc tả đầy đủ ở docs/spec.md).

## Bộ công nghệ cố định
Node.js 24, pnpm workspace. apps/web: TanStack Start + TypeScript + Tailwind. apps/api: Hono + SQLite (node:sqlite). apps/ai: TanStack AI. Kiểm tra dữ liệu bằng Zod.

## Quy tắc
- Trình kế hoạch trước, chờ duyệt, rồi mới làm.
- Mọi kiểm tra quyền làm ở API, không chỉ ẩn nút.
- Không đưa bí mật vào code; dùng .env, không commit .env.
- Thao tác dữ liệu đặt trong apps/api/src/services/.
- Viết kiểm thử tự động cho phần quyền và phần tiền.
- Commit sau mỗi bước hoàn thành.
- Trả lời người dùng bằng tiếng Việt dễ hiểu, không biệt ngữ.

## Lệnh và cổng
- `pnpm install` cài đặt; `pnpm dev` chạy cả web (cổng 3000) và api (cổng 8787); `pnpm typecheck` kiểm kiểu.
- Web gọi API qua đường dẫn `/api/...` (Vite proxy sang api, bỏ tiền tố `/api`).
- Api chạy TypeScript trực tiếp bằng Node 24: import nội bộ phải có đuôi `.ts`.
- `pnpm test` chạy kiểm thử tự động (node --test, cả API); `pnpm db:seed` nạp dữ liệu mẫu (chạy lại không trùng); `pnpm db:reset` xóa file DB rồi nạp lại. File DB lấy từ `DB_PATH` trong `apps/api/.env` (sao chép từ `.env.example`).

## Cấu trúc code
- `packages/shared` (@ces/shared): lược đồ Zod, kiểu dữ liệu và nhãn tiếng Việt dùng chung cho web và API; mọi kiểm tra dữ liệu vào đặt ở đây, web và API cùng dùng.
- `apps/api/src/services/`: logic nghiệp vụ và câu SQL; `apps/api/src/routes/`: chỉ đọc yêu cầu, kiểm Zod, gọi service; `apps/api/src/db/`: schema.sql, seed.ts, database.ts.
- Lỗi API trả JSON tiếng Việt: `{ error, fields? }` (400 sai dữ liệu, 404 không thấy, 409 trùng).
- Danh sách phân trang 20 dòng; bộ lọc nằm trên địa chỉ trang (search params).

## Đăng nhập và bí mật (P5)
- Đăng nhập bằng email + mật khẩu ở API (`/auth/login`, `/auth/logout`, `/auth/me`). Mật khẩu chỉ lưu bản băm scrypt; phiên lưu bảng `sessions` (DB chỉ giữ HMAC của mã), gửi bằng cookie `ces_session` (HttpOnly, SameSite=Lax). Sai quá 10 lần / 15 phút thì khóa (429). Request ghi có Origin lạ bị 403.
- Mọi route dữ liệu cần đăng nhập (chưa đăng nhập: 401). Web kiểm bằng `GET /api/auth/me` và chuyển về `/login`.
- Bí mật chỉ nằm trong `apps/api/.env` (không commit): `SESSION_SECRET` (>= 32 ký tự, thiếu thì API không chạy), `ALLOWED_ORIGINS`, `COOKIE_SECURE`, `SEED_PASSWORD` (mật khẩu chung của tài khoản mẫu). `.env.example` chỉ có giá trị giữ chỗ.
- `pnpm db:seed` cần `SEED_PASSWORD`. Cột/bảng mới cho DB cũ: `migrate()` tự thêm cột thiếu (xem `ensureColumn` trong `db/database.ts`).
- Kiểm thử: dùng `khoiTao()` trong `apps/api/src/test-helpers.ts` (DB tạm, đồng hồ giả, `goi(method, path, body, vaiTro)`).

## Phân quyền (P6)
- Bảng vai trò × quyền: quyền thao tác ở `packages/shared/src/permissions.ts` (web và API cùng đọc); phạm vi dữ liệu (khách nào, việc nào được thấy) ở `apps/api/src/services/scope.ts`. Mọi service nhận `actor` (người đang đăng nhập, lấy từ phiên, không bao giờ từ nội dung request) và tự kiểm quyền.
- Mã lỗi: 401 chưa đăng nhập; 403 vai trò không được làm việc đó; 404 bản ghi ngoài phạm vi (kiểm phạm vi TRƯỚC, rồi mới kiểm quyền thao tác). Báo lỗi tham chiếu, trùng SĐT không được lộ tên/bản ghi ngoài phạm vi.
- Mọi thêm/sửa khách và việc ghi `audit_logs` (`services/audit.ts`, cùng giao dịch với thay đổi dữ liệu). Hàm service mới phải làm tương tự và có kiểm thử mỗi vai trò × thao tác.
- Cách tự thử vượt quyền: `docs/thu-vuot-quyen.md`; kiểm thử ở `apps/api/src/routes/phan-quyen.test.ts`.
