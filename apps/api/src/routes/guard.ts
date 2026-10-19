import { timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { DatabaseSync } from "node:sqlite";
import type { SessionUser } from "@ces/shared";
import type { AppConfig } from "../config.ts";
import { findSessionUser } from "../services/auth.ts";
import { forbidden, unauthorized } from "../services/errors.ts";

export const SESSION_COOKIE = "ces_session";

/** Biến Hono gắn vào mỗi request đã đăng nhập. */
/** Người đang đăng nhập; viaAi = true khi request đến từ dịch vụ AI (có khóa dịch vụ đúng). */
export type RequestUser = SessionUser & { viaAi?: boolean };
export type AuthEnv = { Variables: { user: RequestUser } };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Chặn request GHI (POST, PATCH, PUT, DELETE) có header Origin không nằm trong danh sách cho phép.
 * Trình duyệt luôn gửi Origin khi một trang web khác (trang giả mạo) bắt người dùng gửi request ghi;
 * request không có Origin (curl, kiểm thử) không đến từ trình duyệt nên được cho qua.
 */
export function originGuard(config: AppConfig) {
  return createMiddleware(async (c, next) => {
    const origin = c.req.header("origin");
    if (!SAFE_METHODS.has(c.req.method) && origin !== undefined && !config.allowedOrigins.includes(origin)) {
      throw forbidden("Yêu cầu bị từ chối vì nguồn gửi không hợp lệ");
    }
    await next();
  });
}

/** So khóa dịch vụ bằng so sánh thời gian cố định. */
function isAiService(config: AppConfig, sent: string | undefined): boolean {
  if (!config.aiServiceKey || !sent) return false;
  const a = Buffer.from(config.aiServiceKey);
  const b = Buffer.from(sent);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Bắt buộc đăng nhập: chưa đăng nhập hoặc phiên hết hạn thì trả 401. */
export function requireUser(db: DatabaseSync, config: AppConfig) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = findSessionUser(db, config, getCookie(c, SESSION_COOKIE));
    if (!user) throw unauthorized();
    // Khóa dịch vụ chỉ để NHÃN thao tác là "do AI làm" trong nhật ký; quyền vẫn đúng quyền của người dùng trong cookie.
    c.set("user", { ...user, viaAi: isAiService(config, c.req.header("x-ai-service-key")) });
    await next();
  });
}
