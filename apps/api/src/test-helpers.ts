import type { AppConfig } from "./config.ts";
import { createApp } from "./app.ts";
import { openDatabase } from "./db/database.ts";
import { seed, uuidFrom } from "./db/seed.ts";
import { SESSION_COOKIE } from "./routes/guard.ts";
import { createSession } from "./services/auth.ts";

/** Mật khẩu chỉ dùng trong kiểm thử (không phải mật khẩu thật). */
export const MAT_KHAU_THU = "Mat-khau-thu-nghiem-123";
/** Khóa dịch vụ AI chỉ dùng trong kiểm thử. */
export const KHOA_DICH_VU_THU = "khoa-dich-vu-thu-nghiem-0123";
export const ORIGIN_THU = "http://localhost:3000";

/** Người dùng mẫu theo mã trong seed: admin, ts, tv1..tv6, ql1, ql2. */
export const idNguoi = (ma: string) => uuidFrom(`user:${ma}`);
export const emailNguoi: Record<string, string> = {
  admin: "quan.nguyen@cesglobal.vn", ts: "ha.tran@cesglobal.vn", tv1: "nam.le@cesglobal.vn", tv2: "lan.pham@cesglobal.vn",
  ql1: "tung.hoang@cesglobal.vn", ql2: "chau.ngo@cesglobal.vn",
};

export type Goi = <T = any>(method: string, path: string, body?: unknown, who?: string | null, headers?: Record<string, string>) => Promise<{ status: number; data: T; res: Response }>;

/**
 * Dựng ứng dụng với DB tạm đã nạp dữ liệu mẫu.
 * - goi(method, path, body, who): gửi request với phiên đăng nhập của người dùng mẫu `who` (mặc định admin; null = chưa đăng nhập).
 * - Đồng hồ giả: đổi `dongHo.t` để thử hết hạn phiên hoặc khóa 15 phút.
 */
export function khoiTao(opts: { matKhau?: string; allowedOrigins?: string[] } = {}) {
  const db = openDatabase(":memory:");
  seed(db, { password: opts.matKhau });
  const dongHo = { t: new Date() };
  const config: AppConfig = {
    sessionSecret: "bi-mat-thu-nghiem-khong-dung-that-0123456789",
    allowedOrigins: opts.allowedOrigins ?? [ORIGIN_THU],
    cookieSecure: false,
    sessionDays: 7,
    aiServiceKey: KHOA_DICH_VU_THU,
    now: () => dongHo.t,
  };
  const app = createApp(db, config);
  const cookies = new Map<string, string>();

  /** Cookie của một phiên mới cho người dùng mẫu (không qua bước đăng nhập, để kiểm thử nhanh). */
  function cookieCho(ma: string): string {
    let c = cookies.get(ma);
    if (!c) {
      c = `${SESSION_COOKIE}=${createSession(db, config, idNguoi(ma)).token}`;
      cookies.set(ma, c);
    }
    return c;
  }

  const goi: Goi = async (method, path, body, who = "admin", headers = {}) => {
    const h: Record<string, string> = { ...headers };
    if (body !== undefined) h["content-type"] = "application/json";
    if (who) h.cookie = cookieCho(who);
    const res = await app.request(path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, res };
  };

  return { db, app, config, dongHo, goi, cookieCho };
}
