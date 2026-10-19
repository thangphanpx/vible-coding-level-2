# Cơ sở dữ liệu CES CRM AI (SQLite)

File: đường dẫn trong `DB_PATH` (apps/api/.env). Mô tả bảng: `apps/api/src/db/schema.sql`. Dữ liệu mẫu: `apps/api/src/db/seed.ts`.
Lệnh: `pnpm db:seed` (nạp lại, không trùng), `pnpm db:reset` (xóa file DB rồi nạp lại), `pnpm --filter @ces/api db:migrate` (chỉ tạo bảng).

Quy ước chung: id là uuid; tiền là số nguyên theo đồng (cột `*_vnd`); mọi bảng có `created_at`, `updated_at` (UTC); `updated_at` tự đổi khi sửa.

| Bảng | Chứa gì | Liên quan bảng nào |
|---|---|---|
| users | Người dùng: email, tên, vai trò (admin, quản lý tuyển sinh, tư vấn viên, quản lý lớp học), còn dùng hay không, bản băm mật khẩu (password_hash, không bao giờ lưu mật khẩu thô) | Là người phụ trách khách (leads), người làm việc (tasks), người ghi hoạt động, nhật ký, trò chuyện, người nạp tài liệu |
| courses | Khóa học: tên, học phí (đồng), số buổi, mô tả | Có nhiều lịch khai giảng; khách quan tâm một khóa |
| course_intakes | Lịch khai giảng: khóa nào, ngày khai giảng, số chỗ | Thuộc courses; có nhiều lớp (classes) |
| leads | Khách tiềm năng: họ tên, SĐT, nguồn, khóa quan tâm, giai đoạn, người phụ trách, thời gian rảnh, lần liên hệ gần nhất | Trỏ tới users (owner_id), courses (khóa quan tâm); có nhiều activities, tasks, enrollments |
| activities | Hoạt động của khách: ghi chú, cuộc gọi, tin nhắn; có cờ do AI ghi | Thuộc một lead; do một user ghi |
| tasks | Việc cần làm: tiêu đề, hạn, loại (gọi lại, gửi tài liệu, nhắc học phí, nhắc buổi học, đánh giá cuối khóa), đã xong chưa | Giao cho một user; có thể gắn với một lead |
| classes | Lớp học: tên, giảng viên, sĩ số tối đa, trạng thái (sắp mở, đang học, kết thúc) | Thuộc một lịch khai giảng; có nhiều ghi danh |
| enrollments | Ghi danh: khách nào vào lớp nào, một lần hay trả góp, tổng học phí, đã đóng, hạn đợt 2 | Nối leads với classes (mỗi khách một lần cho mỗi lớp) |
| documents | Tài liệu trong kho tri thức: tiêu đề, tên file, người nạp | Do một user nạp; có nhiều document_chunks |
| document_chunks | Từng đoạn của tài liệu (để tra cứu), có chỗ để vector tìm kiếm | Thuộc một document (xóa tài liệu thì xóa luôn đoạn) |
| audit_logs | Nhật ký: ai làm gì, với đối tượng nào, lúc nào, có phải AI làm. Từ P6 mọi thêm/sửa khách và việc đều ghi vào đây (tao_khach, sua_khach, doi_giai_doan, giao_khach, tao_viec, sua_viec, hoan_thanh_viec, mo_lai_viec) | Trỏ tới users; trỏ lỏng tới đối tượng bị tác động (entity_type + entity_id) |
| sessions | Phiên đăng nhập: người dùng, HMAC của mã phiên (không lưu mã thô), hạn dùng | Thuộc một user (xóa user thì xóa phiên) |
| login_attempts | Mỗi lần đăng nhập sai (email, thời điểm) để khóa 10 lần / 15 phút | Không nối bảng nào (khóa theo email, kể cả email không tồn tại) |
| chat_messages | Lịch sử trò chuyện với trợ lý AI theo người dùng | Thuộc một user; có thể gắn với lead đang mở |

Ghi chú: bảng documents và document_chunks để trống trong dữ liệu mẫu; sẽ nạp từ thư mục tai-lieu-mau/ ở bước kho tri thức.
