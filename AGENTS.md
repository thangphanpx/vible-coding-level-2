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
