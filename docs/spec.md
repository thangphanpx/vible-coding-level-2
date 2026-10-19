# Đặc tả: CES CRM AI

**Mục tiêu.** CRM cho tư vấn tuyển sinh và vận hành lớp học của CES Global (đào tạo ứng dụng AI cho người đi làm). Khoảng 10 người dùng, dữ liệu giả lập. Có trợ lý AI tra cứu và làm giúp, mọi thao tác ghi đều có xác nhận.

## Vai trò
- **Admin**: toàn quyền; quản lý người dùng; nạp/xóa tài liệu; xem nhật ký.
- **Quản lý tuyển sinh**: xem mọi khách, giao khách cho tư vấn viên, lọc khách, xem báo cáo tuần; xem nhật ký; không quản lý người dùng.
- **Tư vấn viên**: chỉ thấy và sửa khách mình phụ trách; khách người khác trả "không tìm thấy".
- **Quản lý lớp học**: quản lý lớp, ghi danh, đóng học phí, chăm sóc sau đăng ký; chỉ thấy khách giai đoạn Đăng ký; không tạo/xóa khách.

## Trang (menu bên trái, hiện theo vai trò)
Tổng quan · Khách tiềm năng (+ hồ sơ khách) · Việc cần làm · Khóa học và lịch khai giảng · Lớp học (+ ghi danh, học phí) · Kho tri thức · Trợ lý AI · Người dùng (admin) · Nhật ký (admin, quản lý tuyển sinh). Có trang Đăng nhập; không có đăng ký tự do.

## Dữ liệu cần lưu
Người dùng (email, tên, vai trò) · Khóa học (tên, học phí, số buổi) · Lịch khai giảng (ngày, số chỗ) · Khách tiềm năng (họ tên, SĐT, nguồn, khóa quan tâm, giai đoạn: mới/đã liên hệ/hẹn tư vấn/đăng ký/không theo, người phụ trách, thời gian rảnh, lần liên hệ gần nhất) · Hoạt động (ghi chú/cuộc gọi/tin nhắn, cờ do AI) · Việc cần làm (tiêu đề, hạn, người làm, khách liên quan, loại: gọi lại/gửi tài liệu/nhắc học phí/nhắc buổi học/đánh giá cuối khóa, đã xong) · Lớp học (tên, lịch khai giảng, giảng viên, sĩ số tối đa, trạng thái sắp mở/đang học/kết thúc) · Ghi danh (khách, lớp, một lần hay trả góp, đã đóng, tổng học phí, hạn đợt 2) · Tài liệu và đoạn tài liệu · Nhật ký (ai, làm gì, lúc nào, cờ AI) · Lịch sử trò chuyện AI theo người dùng.

## Tài liệu nạp
4 file trong tai-lieu-mau/: học phí và ưu đãi, hoàn phí và bảo lưu, giới thiệu khóa học, chăm sóc sau đăng ký.

## Trợ lý AI
- **Tra cứu**: khách, hồ sơ khách, việc, khóa học, lịch khai giảng, lớp và sĩ số, chính sách trong tài liệu (ghi nguồn).
- **Tự làm**: tóm tắt hồ sơ, đề xuất bước tiếp theo, thêm ghi chú (gắn nhãn "do AI ghi").
- **Làm sau khi người dùng xác nhận**: tạo việc, đổi giai đoạn, tạo khách, sửa khách, xếp khách vào lớp, ghi nhận đóng học phí.
- Mở hồ sơ một khách thì trợ lý biết đang nói về khách đó. Chỉ làm được đúng những gì vai trò của người đang đăng nhập làm được.

## Không làm
Không xóa dữ liệu (trừ admin xóa tài liệu). Không hứa ưu đãi ngoài chính sách. Không gửi tin nhắn ra ngoài, chỉ soạn nháp. Không đăng ký tài khoản tự do; tài khoản do admin tạo, dữ liệu mẫu seed sẵn.
