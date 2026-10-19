import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { openDatabase } from "./db/database.ts";

const port = Number(process.env.API_PORT ?? 8787);

// Mở DB (tạo file và bảng nếu chưa có) trước khi nhận yêu cầu.
export const db = openDatabase();

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`API đang chạy tại http://localhost:${info.port}`);
});
