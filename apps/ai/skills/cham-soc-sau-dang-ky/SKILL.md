---
name: cham-soc-sau-dang-ky
description: Dùng khi quản lý lớp học nhờ nhắc đóng học phí, nhắc buổi học đầu tiên, hoặc gửi đánh giá cuối khóa cho một học viên đã đăng ký.
---
# Mục tiêu
Giúp quản lý lớp học chăm sóc học viên sau đăng ký đúng quy trình và đúng hạn: soạn tin nhắn nháp lịch sự và đề xuất việc nhắc kèm hạn. Không tự gửi tin, không hứa ưu đãi.

# Các bước
1. Xác định học viên: dùng khách đang mở, hoặc gọi `search_leads` (giai đoạn dang_ky) để lấy lead_id thật. Nếu có nhiều người trùng tên thì hỏi lại.
2. Gọi `get_lead` để đọc hồ sơ và hoạt động gần đây.
3. Gọi `list_classes` rồi `get_class` để tìm lớp của học viên và xem hình thức đóng, số đã đóng, số còn thiếu, hạn đợt 2.
4. Gọi `search_docs` với từ khóa "chăm sóc sau đăng ký" để lấy đúng quy định: nhắc học phí trước hạn 3 ngày, nhắc buổi đầu trước 1 ngày, gửi đánh giá trong 2 ngày sau buổi cuối. Ghi nguồn.
5. Soạn tin nhắn NHÁP (không gửi), lịch sự, nêu rõ số tiền còn thiếu hoặc giờ học nếu có.
6. Đề xuất tạo việc nhắc bằng `create_task` (loại nhac_hoc_phi, nhac_buoi_hoc hoặc danh_gia_cuoi_khoa) với hạn theo quy định; chờ người dùng duyệt thẻ xác nhận.

# Mẫu câu nên dùng
- "Chào anh/chị [Tên], em nhắc nhẹ về đợt học phí còn lại [số tiền] trước ngày [hạn] ạ."
- "Em soạn sẵn tin nhắn dưới đây, anh/chị xem rồi tự gửi giúp em nhé."

# Lưu ý
- Chỉ dùng số liệu lấy từ công cụ, không đoán số tiền hay ngày.
- Không hứa giảm học phí hay ưu đãi nào ngoài chính sách trong tài liệu; trường hợp đặc biệt thì đề nghị chuyển cho quản lý tuyển sinh.
- Chỉ nói đã tạo việc khi công cụ báo thành công.

# Ví dụ tốt
Người dùng: "Nhắc anh Hưng đóng học phí". Trợ lý tìm anh Hưng, xem lớp AI-2611 còn thiếu 4.800.000đ hạn 2026-12-07, tra tài liệu (nhắc trước 3 ngày), soạn tin nháp nêu đúng số tiền, đề xuất việc "Nhắc anh Hưng đóng đợt 2" hạn 2026-12-04.

# Ví dụ không tốt
Tự bịa số tiền, tự nói "em đã gửi tin cho anh Hưng", hoặc tạo việc mà chưa tìm đúng học viên.
