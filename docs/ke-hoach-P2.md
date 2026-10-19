# Kế hoạch P2 (coi như đã được giảng viên duyệt)
Cấu trúc: pnpm workspace (pnpm-workspace.yaml, package.json gốc), apps/web, apps/api.
- apps/api: Hono + @hono/node-server, Node 24 chạy .ts trực tiếp (node --watch src/index.ts, import có đuôi .ts), cổng 8787, GET /health trả "ok" (và /api/health cho đường qua proxy). Chưa có DB/đăng nhập/AI.
- apps/web: TanStack Start (Vite) + React + TypeScript + Tailwind v4 (@tailwindcss/vite), cổng 3000. Vite server.proxy: /api -> http://localhost:8787 (bỏ tiền tố /api).
- Layout chung (route __root hoặc _app) có menu trái, tiếng Việt; trang trống theo spec: Tổng quan, Khách tiềm năng, Việc cần làm, Khóa học, Lớp học, Kho tri thức, Trợ lý AI, Người dùng, Nhật ký, (Đăng nhập: chưa làm vì chưa đăng nhập).
- Một lệnh "pnpm dev" chạy cả hai (pnpm -r --parallel dev). Thêm "pnpm typecheck".
- Kiểm: pnpm install, typecheck, pnpm dev, curl :8787/health, curl :3000/api/health (qua proxy), curl các trang web, tắt tiến trình.
- Không bí mật; .gitignore (node_modules, .env, .output...). Commit "P2: khung workspace web + api".
