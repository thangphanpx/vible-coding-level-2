# Kế hoạch P3: SQLite, schema và dữ liệu mẫu (coi như đã được giảng viên duyệt)

## Làm gì
- Dùng module `node:sqlite` có sẵn của Node 24 trong apps/api. Đường dẫn file DB lấy từ biến `DB_PATH` trong `apps/api/.env` (có `.env.example`, `.env` không commit; file *.sqlite đã nằm trong .gitignore).
- `apps/api/src/db/schema.sql`: tạo bảng (`CREATE TABLE IF NOT EXISTS`) nên chạy lại nhiều lần được.
- `apps/api/src/db/seed.ts`: dữ liệu giả lập tiếng Việt, id cố định (uuid sinh ra từ tên) và ghi kiểu "thêm hoặc cập nhật", nên chạy lại nhiều lần không bị trùng.
- `apps/api/src/db/database.ts`: mở DB, bật khóa ngoại, chạy schema khi API khởi động.
- Lệnh: `pnpm --filter @ces/api db:migrate`, `db:seed`, `db:reset`; ở thư mục gốc có `pnpm db:seed`.

## Quy ước
- id là uuid (chữ, 36 ký tự); tiền là số nguyên theo đồng (cột `..._vnd`, có CHECK kiểu integer, không âm); mọi bảng có `created_at`, `updated_at` (giờ UTC, ISO 8601) và trigger tự cập nhật `updated_at` khi sửa.
- Giá trị liệt kê (vai trò, giai đoạn, loại việc...) lưu mã không dấu, có CHECK; giao diện sẽ hiển thị tên tiếng Việt.

## Bảng (12 bảng, đúng mục "Dữ liệu cần lưu" trong spec)
users, courses, course_intakes, leads, activities, tasks, classes, enrollments, documents, document_chunks, audit_logs, chat_messages. (Bảng giải thích chi tiết ghi trong docs/du-lieu.md.)

## Kiểm
- Kiểm thử tự động (node --test): schema tạo được hai lần; seed chạy hai lần số dòng không đổi; id đúng dạng uuid; mọi bảng có created_at/updated_at; tiền từ chối số lẻ và số âm; số đã đóng không vượt tổng học phí; updated_at đổi khi sửa.
- typecheck, chạy thật API (`/health`), không in bí mật. Commit "P3: schema và dữ liệu mẫu".
