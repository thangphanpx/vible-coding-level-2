import { createHmac, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Role, SessionUser } from "@ces/shared";
import type { AppConfig } from "../config.ts";
import { ServiceError, unauthorized } from "./errors.ts";
import { dummyHash, verifyPassword } from "./passwords.ts";

/** Quá 10 lần sai trong 15 phút thì khóa đăng nhập email đó. */
export const MAX_FAILED_LOGINS = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type UserRow = { id: string; email: string; full_name: string; role: Role; active: number; password_hash: string | null };

const toSessionUser = (u: Pick<UserRow, "id" | "email" | "full_name" | "role">): SessionUser => ({
  id: u.id, email: u.email, fullName: u.full_name, role: u.role,
});

/** Chỉ lưu HMAC của mã phiên: lộ file DB cũng không dựng lại được cookie. */
function tokenHash(config: AppConfig, token: string): string {
  return createHmac("sha256", config.sessionSecret).update(token).digest("hex");
}

export type LoginResult = { user: SessionUser; token: string; expiresAt: Date };

const BAD_LOGIN = "Email hoặc mật khẩu không đúng";

export async function login(db: DatabaseSync, config: AppConfig, emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const now = config.now();
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString();

  // Dọn các lần sai đã quá 15 phút (bảng không phình ra mãi).
  db.prepare("DELETE FROM login_attempts WHERE created_at < ?").run(since);
  const { n } = db.prepare("SELECT count(*) AS n FROM login_attempts WHERE email = ? AND created_at >= ?").get(email, since) as { n: number };
  if (n >= MAX_FAILED_LOGINS) {
    throw new ServiceError(429, "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.");
  }

  // Ghi "một lần thử" NGAY (trước khi băm mật khẩu, vốn chạy bất đồng bộ) để nhiều request gửi cùng lúc
  // cũng bị đếm đủ; đăng nhập đúng thì xóa bộ đếm của email này.
  db.prepare("INSERT INTO login_attempts (email, created_at) VALUES (?, ?)").run(email, now.toISOString());

  const user = db
    .prepare("SELECT id, email, full_name, role, active, password_hash FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;
  // Luôn chạy một phép băm (kể cả khi không có email) để thời gian phản hồi như nhau.
  const ok = await verifyPassword(password, user?.password_hash ?? dummyHash());
  if (!user || !user.password_hash || !user.active || !ok) throw unauthorized(BAD_LOGIN);

  db.prepare("DELETE FROM login_attempts WHERE email = ?").run(email);
  return { user: toSessionUser(user), ...createSession(db, config, user.id) };
}

/** Tạo phiên mới cho một người dùng: trả mã để đặt vào cookie (DB chỉ lưu HMAC của mã). */
export function createSession(db: DatabaseSync, config: AppConfig, userId: string): { token: string; expiresAt: Date } {
  const now = config.now();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + config.sessionDays * 86_400_000);
  db.prepare("INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    userId, tokenHash(config, token), expiresAt.toISOString(), now.toISOString(),
  );
  return { token, expiresAt };
}

/** Tìm người dùng theo mã phiên trong cookie; phiên hết hạn hoặc người dùng bị khóa thì coi như chưa đăng nhập. */
export function findSessionUser(db: DatabaseSync, config: AppConfig, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.full_name, u.role, u.active
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash(config, token)) as (UserRow & { session_id: string; expires_at: string }) | undefined;
  if (!row) return null;
  if (row.expires_at <= config.now().toISOString()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
    return null;
  }
  if (!row.active) return null;
  return toSessionUser(row);
}

export function logout(db: DatabaseSync, config: AppConfig, token: string | undefined): void {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(config, token));
}
