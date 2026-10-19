# Kế hoạch P4: màn hình quản lý Khách tiềm năng và Việc cần làm (coi như đã được giảng viên duyệt)

Chọn hai loại dữ liệu cần màn hình quản lý: **khách tiềm năng** (trang /khach-tiem-nang) và **việc cần làm** (trang /viec-can-lam). Chưa có đăng nhập nên chưa kiểm tra quyền (buổi 3).

## Cấu trúc
- `packages/shared` (@ces/shared): lược đồ Zod dùng chung cho web và API (khách, việc, tham số tìm kiếm), nhãn tiếng Việt cho các giá trị liệt kê. Một nguồn duy nhất nên web và API không lệch nhau.
- `apps/api/src/services/leads.ts`, `tasks.ts`, `lookups.ts`: toàn bộ logic và câu SQL (tìm, lọc, phân trang, thêm, sửa, kiểm trùng SĐT). Route chỉ đọc yêu cầu, kiểm bằng Zod rồi gọi service.
- `apps/api/src/routes/leads.ts`, `tasks.ts`, `lookups.ts` gắn vào `createApp(db)` ở `app.ts` (nhận DB từ ngoài để kiểm thử dùng DB tạm).
- Web: hộp thoại dùng thẻ `<dialog>` có sẵn của trình duyệt; bộ lọc nằm trên địa chỉ trang (?page=2&q=...) để tải lại hoặc gửi link vẫn giữ nguyên.

## API (web gọi qua /api/..., API nhận không có tiền tố)
- `GET /leads?page&q&stage&ownerId&courseId` (20 dòng/trang; q tìm theo họ tên và số điện thoại, không phân biệt hoa thường và dấu; ownerId=none là chưa giao), `GET /leads/:id`, `POST /leads`, `PATCH /leads/:id`.
- `GET /tasks?page&q&type&status&assigneeId` (q tìm theo tiêu đề; status = open|done), `POST /tasks`, `PATCH /tasks/:id` (sửa và đánh dấu xong).
- `GET /lookups`: danh sách người dùng, khóa học, khách (để đổ vào ô chọn).
- Lỗi dữ liệu: 400 `{error, fields:{tên_trường: thông báo tiếng Việt}}`; không thấy: 404; trùng SĐT: 409. Không có route xóa (spec: không xóa dữ liệu).

## Kiểm
- Kiểm thử tự động (node --test) cho phân trang 20 dòng, tìm không dấu, từng bộ lọc, thêm/sửa hợp lệ, dữ liệu sai bị Zod chặn, trùng SĐT, 404.
- typecheck cả hai app; chạy `pnpm dev`, curl API qua proxy; mở trình duyệt thử tìm, lọc, đổi trang, thêm, sửa, lỗi hiển thị.
- Dọn tiến trình, commit "P4: màn hình khách tiềm năng và việc cần làm", tạo nhánh buoi-2.
