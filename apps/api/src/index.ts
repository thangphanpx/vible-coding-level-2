import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openDatabase } from "./db/database.ts";

const port = Number(process.env.API_PORT ?? 8787);

// Mở DB (tạo file và bảng nếu chưa có) trước khi nhận yêu cầu.
const db = openDatabase();
const app = createApp(db);

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`API đang chạy tại http://localhost:${info.port}`);
});
