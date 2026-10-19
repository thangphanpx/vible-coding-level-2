import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { handleError } from "./routes/http.ts";
import { leadRoutes } from "./routes/leads.ts";
import { lookupRoutes } from "./routes/lookups.ts";
import { taskRoutes } from "./routes/tasks.ts";

/** Tạo ứng dụng API với một cơ sở dữ liệu cho trước (kiểm thử dùng DB tạm). */
export function createApp(db: DatabaseSync) {
  const app = new Hono();
  app.get("/health", (c) => c.text("ok"));
  app.route("/leads", leadRoutes(db));
  app.route("/tasks", taskRoutes(db));
  app.route("/lookups", lookupRoutes(db));
  app.onError(handleError);
  app.notFound((c) => c.json({ error: "Không tìm thấy" }, 404));
  return app;
}
