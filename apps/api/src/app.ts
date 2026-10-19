import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "./config.ts";
import { authRoutes } from "./routes/auth.ts";
import { chatRoutes } from "./routes/chats.ts";
import { classRoutes, courseRoutes, enrollmentRoutes } from "./routes/classes.ts";
import { originGuard, requireUser, type AuthEnv } from "./routes/guard.ts";
import { documentRoutes } from "./routes/documents.ts";
import { handleError } from "./routes/http.ts";
import { leadRoutes } from "./routes/leads.ts";
import { lookupRoutes } from "./routes/lookups.ts";
import { taskRoutes } from "./routes/tasks.ts";

/** Tạo ứng dụng API với một cơ sở dữ liệu và cấu hình cho trước (kiểm thử dùng DB tạm). */
export function createApp(db: DatabaseSync, config: AppConfig) {
  const app = new Hono();
  app.onError(handleError);
  app.notFound((c) => c.json({ error: "Không tìm thấy" }, 404));

  // Mọi request ghi có Origin lạ đều bị chặn trước khi làm bất cứ việc gì.
  app.use("*", originGuard(config));

  // Không cần đăng nhập
  app.get("/health", (c) => c.text("ok"));
  app.route("/auth", authRoutes(db, config));

  // Từ đây trở xuống: bắt buộc đăng nhập (chưa đăng nhập -> 401)
  const secured = new Hono<AuthEnv>();
  secured.use("*", requireUser(db, config));
  secured.route("/leads", leadRoutes(db));
  secured.route("/tasks", taskRoutes(db));
  secured.route("/lookups", lookupRoutes(db));
  secured.route("/chats", chatRoutes(db));
  secured.route("/documents", documentRoutes(db));
  secured.route("/courses", courseRoutes(db));
  secured.route("/classes", classRoutes(db));
  secured.route("/enrollments", enrollmentRoutes(db));
  app.route("/", secured);
  return app;
}
