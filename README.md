# CES CRM AI

Web app CRM cho đội tư vấn tuyển sinh và quản lý lớp học, có trợ lý AI tra cứu và làm giúp.
Đây là sản phẩm mẫu của khóa học AI Engineering (CES Global). Toàn bộ dữ liệu là dữ liệu giả.

| Phần | Công nghệ | Cổng |
|---|---|---|
| `apps/web` | TanStack Start, React, Tailwind | 3000 |
| `apps/api` | Hono, SQLite (`node:sqlite`), Zod | 8787 |
| `apps/ai` | TanStack AI, DeepSeek (chuẩn tương thích OpenAI) | 8788 |
| `packages/shared`, `packages/contracts` | Kiểu dữ liệu, quyền, khai báo công cụ AI dùng chung | |

Đặc tả đầy đủ: [docs/spec.md](docs/spec.md). Quy ước cho trợ lý lập trình: [AGENTS.md](AGENTS.md).

## 1. Chuẩn bị

- Node.js 24 trở lên (`node -v`)
- pnpm (`pnpm -v`), cài bằng `npm i -g pnpm` nếu chưa có
- Khóa API DeepSeek của riêng bạn (chỉ cần khi thử khung chat AI; không có khóa thì phần còn lại vẫn chạy)

## 2. Cài đặt và tạo file cấu hình

```bash
pnpm install
```

Tạo hai file cấu hình từ mẫu. File `.env` đã nằm trong `.gitignore`, **không bao giờ commit**.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/ai/.env.example apps/ai/.env
```

Trên PowerShell dùng `copy` thay cho `cp`.

Điền các giá trị sau (mỗi máy tự tạo giá trị riêng, không dùng lại giá trị của người khác):

| File | Biến | Cách điền |
|---|---|---|
| `apps/api/.env` | `SESSION_SECRET` | Chuỗi ngẫu nhiên từ 32 ký tự. Tạo: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `apps/api/.env` | `SEED_PASSWORD` | Mật khẩu chung của các tài khoản mẫu, bạn tự đặt (không dùng mật khẩu thật của bạn) |
| `apps/api/.env` và `apps/ai/.env` | `AI_SERVICE_KEY` | Cùng một chuỗi ở cả hai file, từ 16 ký tự. Tạo: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
| `apps/ai/.env` | `AI_API_KEY` | Khóa DeepSeek của bạn (tùy chọn, chỉ để dùng chat AI) |

## 3. Nạp dữ liệu mẫu và chạy

```bash
pnpm db:reset
pnpm dev
```

Mở http://localhost:3000. Muốn trả dữ liệu về ban đầu: dừng `pnpm dev`, chạy lại `pnpm db:reset`.

Đăng nhập bằng email dưới đây và mật khẩu là `SEED_PASSWORD` bạn đã đặt:

| Vai trò | Email |
|---|---|
| Admin | `quan.nguyen@cesglobal.vn` |
| Quản lý tuyển sinh | `ha.tran@cesglobal.vn` |
| Tư vấn viên | `nam.le@cesglobal.vn` |
| Quản lý lớp học | `tung.hoang@cesglobal.vn` |

## 4. Kịch bản demo gợi ý (15 phút)

1. **Phân quyền thật ở API.** Đăng nhập tư vấn viên: menu không có Lớp học, và gọi thẳng `/api/classes` bằng trình duyệt cũng nhận 403. Tư vấn viên chỉ thấy khách do mình phụ trách. Đăng nhập Quản lý lớp học: thấy lớp, xếp khách vào lớp, ghi đóng học phí, nhưng không thêm được khách.
2. **Quản lý dữ liệu.** Trang Khách tiềm năng: thêm, sửa, tìm, lọc, đổi giai đoạn. Trang Việc cần làm: tạo việc, đánh dấu xong. Mỗi thao tác ghi một dòng nhật ký.
3. **Chat AI tra cứu** (cần `AI_API_KEY`). Mở khung chat (có ở mọi trang sau khi đăng nhập) và hỏi:
   - "Khách nào lâu chưa liên hệ?"
   - "Lớp nào cần chú ý về sĩ số?"
   - "Học phí khóa Python cơ bản là bao nhiêu?" (trả lời có ghi nguồn tài liệu ở Kho tri thức)
   - Một câu ngoài tài liệu: AI phải nói chưa có thông tin, không bịa.
4. **Chat AI làm giúp, có người duyệt.** Nhờ "Tạo việc gọi lại chị Lan hạn 2026-10-26": hiện thẻ **Duyệt / Từ chối**. Chưa bấm Duyệt thì chưa có gì ghi vào CSDL. Bấm Duyệt hai lần vẫn chỉ ra một việc. Ghi chú do AI thêm có nhãn "Do AI ghi" ở hồ sơ khách; nhật ký trong CSDL (`audit_logs`) đánh dấu thao tác do AI làm.
5. **AI không tự ý vào CSDL.** Nhờ AI "Tạo lớp Vibe Coding Level 2". AI trả lời không có công cụ tạo lớp và không có khóa học đó. Lý do:
   - AI chỉ có danh sách công cụ khai báo ở `packages/contracts`; không có công cụ mở lớp thì không làm được.
   - Dịch vụ `apps/ai` không có kết nối CSDL. Nó chỉ gọi API bằng cookie của người đang hỏi.
   - API kiểm quyền và dữ liệu từng lần ghi; việc ghi quan trọng phải qua thẻ Duyệt.
   - Thử thêm: đăng nhập tư vấn viên, nhờ AI xếp khách vào lớp. API trả 403 và AI báo lại không có quyền.

## 5. Kiểm thử

```bash
pnpm test        # API và dịch vụ AI (AI dùng mô hình giả, không gọi mạng)
pnpm typecheck
```

## 6. Cấu trúc

```
apps/api/src/    routes (đọc yêu cầu, Zod) -> services (nghiệp vụ, SQL, kiểm quyền) -> db
apps/ai/         AGENT.md, skills/*/SKILL.md, src/ (server, tools, skills)
apps/web/src/    routes/, components/ (ChatPanel, ApprovalCard)
packages/        shared (Zod, quyền), contracts (khai báo công cụ AI)
docs/            spec, kế hoạch từng buổi, tài liệu mẫu
```

## 7. Bảo mật khi dùng và đẩy code

- Không commit `.env`, file SQLite (`data/`, `*.sqlite`), khóa API, mật khẩu. `.gitignore` đã chặn; chỉ `.env.example` (không có giá trị thật) được commit.
- Trước khi push, kiểm tra: `git ls-files | grep -i env` chỉ được ra hai file `.env.example`.
- Mật khẩu người dùng chỉ lưu dạng băm (scrypt, muối riêng); mã phiên chỉ lưu bản băm HMAC.
- Khóa `AI_SERVICE_KEY` chỉ để gắn nhãn "do AI làm" vào nhật ký, không cấp thêm quyền.
- Đây là dự án học tập chạy trên máy cá nhân. Chưa đủ để chạy thật trên internet (chưa có HTTPS, giới hạn lượt hỏi AI nằm trong bộ nhớ).

## 8. Việc còn lại đã biết

- 4 trang trong menu còn trống: Tổng quan, Người dùng, Nhật ký, Trợ lý AI toàn màn hình.
- Chưa có tạo, sửa khóa học và lớp học (giữ nguyên có chủ ý, xem kịch bản demo mục 5).
- Phần AI mới kiểm bằng mô hình giả trong test; chất lượng với DeepSeek thật cần thử tay.
