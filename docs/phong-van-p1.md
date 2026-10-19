# Phỏng vấn ngược P1 (hỏi từng câu, tối đa 12 câu)

Mô tả ngắn điền vào prompt: "CES CRM AI, CRM cho tư vấn tuyển sinh và vận hành lớp học của CES Global, trung tâm đào tạo ứng dụng AI cho người đi làm".

**Câu 1.** Công ty có khoảng bao nhiêu người dùng, và dữ liệu là thật hay giả lập?
- Trả lời: Khoảng 10 người dùng, công ty nhỏ. Dữ liệu giả lập.

**Câu 2.** Ai sẽ dùng app và mỗi người giữ vai trò gì?
- Trả lời: 4 vai trò. Admin (toàn quyền, quản lý người dùng, nạp tài liệu, xem nhật ký); Quản lý tuyển sinh (xem mọi khách, giao khách, xem báo cáo tuần); Tư vấn viên (chỉ thấy và sửa khách mình phụ trách, khách người khác như không tồn tại); Quản lý lớp học (quản lý lớp, học viên đã đăng ký, chăm sóc sau đăng ký; không thấy khách chưa đăng ký).

**Câu 3.** Tư vấn viên hằng ngày thao tác gì?
- Trả lời: Thêm khách, ghi hoạt động (ghi chú, cuộc gọi, tin nhắn), đổi giai đoạn, tạo việc gọi lại.

**Câu 4.** Quản lý tuyển sinh thao tác gì?
- Trả lời: Lọc khách theo giai đoạn, người phụ trách, khóa quan tâm; xem khách lâu chưa liên hệ; giao khách.

**Câu 5.** Quản lý lớp học thao tác gì?
- Trả lời: Mở lớp theo lịch khai giảng, xếp học viên (khách giai đoạn Đăng ký) vào lớp, ghi nhận đóng học phí, tạo và theo dõi việc chăm sóc sau đăng ký.

**Câu 6.** Cần lưu thông tin gì về khách tiềm năng và hoạt động của họ?
- Trả lời: Họ tên, số điện thoại, nguồn, khóa quan tâm, giai đoạn (mới, đã liên hệ, hẹn tư vấn, đăng ký, không theo), người phụ trách, thời gian rảnh, lần liên hệ gần nhất. Hoạt động theo từng khách (ghi chú, cuộc gọi, tin nhắn; có cờ do AI ghi).

**Câu 7.** Cần lưu gì về khóa học, lịch khai giảng, lớp học, ghi danh?
- Trả lời: Khóa học (tên, học phí, số buổi); lịch khai giảng (ngày, số chỗ); lớp (tên, thuộc một lịch khai giảng, giảng viên, sĩ số tối đa, trạng thái sắp mở/đang học/kết thúc); ghi danh (khách vào lớp, hình thức một lần/trả góp, số tiền đã đóng, tổng học phí, hạn đóng đợt 2).

**Câu 8.** Còn dữ liệu nào khác (người dùng, việc cần làm, nhật ký, lịch sử trò chuyện)?
- Trả lời: Người dùng (email, tên, vai trò); việc cần làm (tiêu đề, hạn, người làm, khách liên quan, loại: gọi lại/gửi tài liệu/nhắc học phí/nhắc buổi học/đánh giá cuối khóa, đã xong chưa); nhật ký (ai làm gì lúc nào, cờ do AI); lịch sử trò chuyện với AI theo người dùng.

**Câu 9.** Cần nạp tài liệu nào vào kho tri thức?
- Trả lời: Các file trong tai-lieu-mau/: học phí và ưu đãi, quy định hoàn phí và bảo lưu, giới thiệu khóa học, chăm sóc sau đăng ký. Lưu tài liệu và các đoạn của tài liệu.

**Câu 10.** Trợ lý AI nên tra cứu những gì?
- Trả lời: Khách, hồ sơ khách, việc cần làm, khóa học và lịch khai giảng, lớp học và sĩ số, chính sách trong tài liệu (có nguồn).

**Câu 11.** Trợ lý AI nên làm gì giúp người dùng, và cái nào cần xác nhận?
- Trả lời: Tóm tắt hồ sơ khách, đề xuất bước tiếp theo, thêm ghi chú (có nhãn do AI ghi). Làm có xác nhận: tạo việc, đổi giai đoạn, tạo khách mới, sửa thông tin khách, xếp khách vào lớp, ghi nhận đóng học phí. Khi mở hồ sơ một khách, trợ lý biết đang nói về khách đó.

**Câu 12.** Có điều gì app và trợ lý tuyệt đối không làm?
- Trả lời: Không xóa dữ liệu. Không hứa ưu đãi ngoài chính sách. Không gửi tin nhắn ra ngoài (chỉ soạn nháp). Không có đăng ký tài khoản tự do: tài khoản do admin tạo (dữ liệu mẫu seed sẵn).
