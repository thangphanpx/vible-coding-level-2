---
name: kiem-tra-si-so-lop
description: Dùng khi hỏi lớp nào sắp khai giảng, lớp còn chỗ không, hoặc lớp nào đang thiếu học viên cần xử lý.
---
# Mục tiêu
Cho người hỏi thấy nhanh các lớp cần chú ý về sĩ số và việc nên làm tiếp, kèm lý do có nguồn.

# Các bước
1. Gọi `list_classes` để lấy danh sách lớp, ngày khai giảng, sĩ số hiện tại và tối đa.
2. Gọi `search_docs` với từ khóa "sĩ số lớp" để lấy quy định (mỗi lớp tối đa 25 học viên; lớp dưới 8 học viên hai tuần trước khai giảng thì báo quản lý tuyển sinh để gộp hoặc dời lịch). Ghi nguồn.
3. Lọc các lớp chưa kết thúc và áp quy định: lớp đã đầy (đủ sĩ số tối đa) hoặc lớp thiếu người sắp khai giảng. Hôm nay là ngày trong phần ngữ cảnh, không tự đoán ngày.
4. Liệt kê tối đa 5 lớp cần chú ý, mỗi lớp một dòng: tên lớp, ngày khai giảng, sĩ số, lý do.
5. Nếu cần xem ai trong lớp thì gọi `get_class`.
6. Đề xuất việc tiếp theo (ví dụ báo quản lý tuyển sinh về lớp thiếu người) bằng `create_task` và chờ người dùng duyệt; không tự làm.

# Mẫu câu nên dùng
- "Em thấy [n] lớp cần chú ý:" rồi liệt kê.
- "Theo quy định [Nguồn: ...], lớp dưới 8 học viên hai tuần trước khai giảng cần báo quản lý tuyển sinh."

# Lưu ý
- Tư vấn viên không xem được thông tin lớp: nếu công cụ báo không có quyền thì nói rõ và gợi ý nhờ quản lý lớp học.
- Không đoán sĩ số; chỉ dùng số công cụ trả về.
- Lớp đã kết thúc thì bỏ qua.

# Ví dụ tốt
"Lớp PY-2611 khai giảng 16/11, mới 1/25 học viên, dưới ngưỡng 8 [Nguồn: Chăm sóc sau đăng ký]. Đề xuất tạo việc báo quản lý tuyển sinh để gộp hoặc dời lịch."

# Ví dụ không tốt
Kết luận "lớp vẫn ổn" khi chưa gọi công cụ, hoặc liệt kê cả lớp đã kết thúc.
