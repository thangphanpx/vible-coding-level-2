# Kế hoạch P6: áp bảng vai trò × quyền (coi như đã được giảng viên duyệt)

## Nguyên tắc
- Kiểm quyền **trong API, ở `apps/api/src/services/`** (route chỉ đọc yêu cầu và gọi service); web chỉ ẩn nút/menu cho gọn, không phải lớp bảo vệ.
- **401** chưa đăng nhập (đã có từ P5). **403** đăng nhập rồi nhưng vai trò không được làm việc đó (ví dụ Quản lý lớp học thêm khách). **404** bản ghi nằm ngoài phạm vi của người dùng (khách của người khác "như không tồn tại").
- Thứ tự kiểm: phạm vi (404) trước, rồi quyền thao tác (403) — để không lộ bản ghi có tồn tại hay không.
- Bảng quyền nằm một chỗ (`packages/shared/src/permissions.ts`) cho web và API cùng đọc; phần phạm vi dữ liệu (SQL) ở `apps/api/src/services/scope.ts`.

## Màn hình và dữ liệu đã có API: áp quyền
| Dữ liệu | Admin | Quản lý tuyển sinh | Tư vấn viên | Quản lý lớp học |
|---|---|---|---|---|
| Xem khách | tất cả | tất cả | `owner_id` = mình | `stage` = Đăng ký |
| Thêm khách | có | có | có, chỉ khách do mình phụ trách (403 nếu gán người khác) | 403 |
| Sửa khách, đổi giai đoạn | có | có | khách mình (khách người khác: 404) | 403 (khách Đăng ký), 404 (khách khác) |
| Đổi người phụ trách | có | có | 403 | 403 |
| Việc cần làm (xem, thêm, sửa, đánh dấu xong) | tất cả | tất cả | `assignee_id` = mình; chỉ tạo việc cho mình | việc loại nhắc học phí / nhắc buổi học / đánh giá cuối khóa gắn với khách Đăng ký |
| Danh sách chọn (lookups) | tất cả | tất cả | chỉ chính mình + khách của mình | người dùng + khách Đăng ký |

Việc có khách liên quan mà người xem không có quyền xem khách đó: ẩn tên khách. Thêm/sửa việc gắn khách ngoài phạm vi: 400 "Khách liên quan không tồn tại" (không phân biệt "không có" với "không được xem"). Báo trùng SĐT không kèm tên nếu khách trùng nằm ngoài phạm vi.

## Chưa có API hoặc màn hình: không dựng thêm, ghi nhận là thiếu
Khóa học và lịch khai giảng (xem/sửa), lớp học, ghi danh, đóng học phí, hoạt động/ghi chú của khách, kho tri thức, người dùng, nhật ký (xem), trợ lý AI. Các trang này vẫn là trang trống; menu và đường dẫn trực tiếp được ẩn/chặn theo vai trò (Lớp học: admin, tuyển sinh, quản lý lớp; Người dùng: admin; Nhật ký: admin, tuyển sinh). Xóa: không có route xóa nào.

## Audit log
Mọi thao tác thêm/sửa khách và việc ghi một dòng vào `audit_logs` (ai, làm gì, đối tượng, mô tả tiếng Việt, cờ AI = 0) trong cùng một giao dịch với thay đổi dữ liệu: `tao_khach`, `sua_khach`, `doi_giai_doan`, `giao_khach`, `tao_viec`, `sua_viec`, `hoan_thanh_viec`, `mo_lai_viec`. Không ghi số điện thoại hay bí mật vào mô tả. Thao tác bị từ chối (401/403/404) không ghi và không đổi dữ liệu. Không có chức năng xóa nên chưa có dòng "xóa".

## Web
- Menu chỉ hiện trang vai trò được xem; vào thẳng địa chỉ trang không được phép thì hiện "Bạn không có quyền xem trang này".
- Khách: ẩn "Thêm khách" với Quản lý lớp học, ẩn "Sửa" khi không có quyền sửa, ẩn ô "Người phụ trách" (và bộ lọc theo người phụ trách) khi không được đổi.
- Việc: Tư vấn viên chỉ thấy và tạo việc cho mình; Quản lý lớp học chỉ chọn loại việc chăm sóc sau đăng ký.

## Kiểm
- Kiểm thử tự động theo bảng quyền (mỗi vai trò × mỗi thao tác) và từng cách thử vượt quyền (ghi ở `docs/thu-vuot-quyen.md`, đánh số V01...), kiểm audit log, kiểm dữ liệu không đổi khi bị từ chối.
- typecheck, `pnpm dev`, curl theo từng vai trò, thử trong trình duyệt bằng tài khoản tư vấn viên và quản lý lớp học. Dọn tiến trình, commit "P6: phân quyền", tạo nhánh buoi-3.
