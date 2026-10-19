import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { loadConfig } from "../config.ts";
import { seed } from "../db/seed.ts";
import { emailNguoi, khoiTao, MAT_KHAU_THU, ORIGIN_THU } from "../test-helpers.ts";

type Phien = { status: number; data: any; res: Response };
const dangNhap = (t: ReturnType<typeof khoiTao>, email: string, password: string, headers: Record<string, string> = {}): Promise<Phien> =>
  t.goi("POST", "/auth/login", { email, password }, null, headers);
const cookieTu = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

test("MẬT KHẨU: DB chỉ có bản băm scrypt, không có mật khẩu thô; mỗi người một muối", () => {
  const { db } = khoiTao({ matKhau: MAT_KHAU_THU });
  const rows = db.prepare("SELECT email, password_hash FROM users").all() as { email: string; password_hash: string }[];
  assert.equal(rows.length, 10);
  for (const r of rows) {
    assert.match(r.password_hash, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    assert.ok(!r.password_hash.includes(MAT_KHAU_THU));
  }
  assert.equal(new Set(rows.map((r) => r.password_hash.split("$")[4])).size, 10, "mỗi người một muối riêng");
  // Không có chỗ nào khác trong DB chứa mật khẩu thô
  for (const bang of ["users", "sessions", "login_attempts", "audit_logs"]) {
    const dump = JSON.stringify(db.prepare(`SELECT * FROM ${bang}`).all());
    assert.ok(!dump.includes(MAT_KHAU_THU), `${bang} chứa mật khẩu thô`);
  }
});

test("seed chạy hai lần: vẫn 10 tài khoản, đăng nhập được, không lộ bản băm qua API", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  seed(t.db, { password: MAT_KHAU_THU });
  assert.equal((t.db.prepare("SELECT count(*) n FROM users").get() as { n: number }).n, 10);
  const r = await dangNhap(t, emailNguoi.admin, MAT_KHAU_THU);
  assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(r.data).includes("password"), "phản hồi không được chứa mật khẩu hay bản băm");
  assert.deepEqual(Object.keys(r.data.user).sort(), ["email", "fullName", "id", "role"]);
});

test("đăng nhập đúng: 200, cookie HttpOnly + SameSite, phiên nằm trong DB (không lưu mã thô)", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const r = await dangNhap(t, "  Nam.Le@CesGlobal.vn ", MAT_KHAU_THU, { origin: ORIGIN_THU });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, "tu_van_vien");
  assert.equal(r.data.user.fullName, "Lê Hoàng Nam");
  const setCookie = r.res.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^ces_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//);
  assert.doesNotMatch(setCookie, /Secure/i, "chạy http cục bộ thì chưa bật Secure");
  const token = cookieTu(r.res).split("=")[1];
  const phien = t.db.prepare("SELECT token_hash, expires_at FROM sessions").all() as { token_hash: string; expires_at: string }[];
  assert.equal(phien.length, 1);
  assert.notEqual(phien[0].token_hash, token, "DB không lưu mã phiên thô");
  assert.match(phien[0].token_hash, /^[0-9a-f]{64}$/);
  // dùng cookie đó gọi /auth/me và API khác
  const me = await t.app.request("/auth/me", { headers: { cookie: cookieTu(r.res) } });
  assert.equal(me.status, 200);
  assert.equal(((await me.json()) as any).user.email, "nam.le@cesglobal.vn");
  const ds = await t.app.request("/leads", { headers: { cookie: cookieTu(r.res) } });
  assert.equal(ds.status, 200);
});

test("cookie Secure được bật khi cấu hình COOKIE_SECURE=true", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const app = createApp(t.db, { ...t.config, cookieSecure: true });
  const res = await app.request("/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: emailNguoi.admin, password: MAT_KHAU_THU }),
  });
  assert.match(res.headers.get("set-cookie") ?? "", /Secure/i);
});

test("đăng nhập sai: 401 cùng một câu cho mật khẩu sai và email không tồn tại; dữ liệu thiếu thì 400", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const saiMk = await dangNhap(t, emailNguoi.admin, "sai-mat-khau");
  const saiEmail = await dangNhap(t, "khong.co@cesglobal.vn", MAT_KHAU_THU);
  assert.equal(saiMk.status, 401);
  assert.equal(saiEmail.status, 401);
  assert.equal(saiMk.data.error, "Email hoặc mật khẩu không đúng");
  assert.deepEqual(saiMk.data, saiEmail.data, "không lộ email nào có tài khoản");
  assert.equal(saiMk.res.headers.get("set-cookie"), null);
  const thieu = await t.goi("POST", "/auth/login", {}, null);
  assert.equal(thieu.status, 400);
  assert.equal(thieu.data.fields.email, "Vui lòng nhập email");
  assert.equal(thieu.data.fields.password, "Vui lòng nhập mật khẩu");
  const emailXau = await t.goi("POST", "/auth/login", { email: "khong-phai-email", password: "x" }, null);
  assert.equal(emailXau.data.fields.email, "Email không hợp lệ");
});

test("tài khoản bị khóa (active = 0) hoặc chưa có mật khẩu thì không đăng nhập được", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  t.db.prepare("UPDATE users SET active = 0 WHERE email = ?").run(emailNguoi.tv2);
  assert.equal((await dangNhap(t, emailNguoi.tv2, MAT_KHAU_THU)).status, 401);
  const t2 = khoiTao(); // seed không truyền mật khẩu -> password_hash NULL
  assert.equal((await dangNhap(t2, emailNguoi.admin, "")).status, 400);
  assert.equal((await dangNhap(t2, emailNguoi.admin, "bất kỳ")).status, 401);
});

test("khóa đăng nhập: sai 10 lần trong 15 phút thì lần 11 bị 429 (kể cả nhập đúng), sau 15 phút được lại", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const dau = t.dongHo.t.getTime();
  for (let i = 0; i < 10; i++) {
    t.dongHo.t = new Date(dau + i * 1000);
    assert.equal((await dangNhap(t, emailNguoi.ts, "sai")).status, 401, `lần sai thứ ${i + 1}`);
  }
  t.dongHo.t = new Date(dau + 30_000);
  const khoa = await dangNhap(t, emailNguoi.ts, MAT_KHAU_THU);
  assert.equal(khoa.status, 429, "đúng mật khẩu nhưng đang bị khóa");
  assert.match(khoa.data.error, /quá nhiều lần/);
  assert.equal(khoa.res.headers.get("set-cookie"), null);
  // người khác không bị ảnh hưởng
  assert.equal((await dangNhap(t, emailNguoi.admin, MAT_KHAU_THU)).status, 200);
  // chưa đủ 15 phút vẫn khóa; qua 15 phút thì mở
  t.dongHo.t = new Date(dau + 9 * 1000 + 14 * 60_000);
  assert.equal((await dangNhap(t, emailNguoi.ts, MAT_KHAU_THU)).status, 429);
  t.dongHo.t = new Date(dau + 9 * 1000 + 15 * 60_000 + 1000);
  assert.equal((await dangNhap(t, emailNguoi.ts, MAT_KHAU_THU)).status, 200);
});

test("khóa đăng nhập: 9 lần sai rồi đúng thì vào được và bộ đếm về 0", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  for (let i = 0; i < 9; i++) await dangNhap(t, emailNguoi.tv1, "sai");
  assert.equal((await dangNhap(t, emailNguoi.tv1, MAT_KHAU_THU)).status, 200);
  assert.equal((t.db.prepare("SELECT count(*) n FROM login_attempts WHERE email = ?").get(emailNguoi.tv1) as { n: number }).n, 0);
});

test("khóa đăng nhập: 30 request sai gửi cùng lúc vẫn bị chặn sau 10 lần (không lách bằng gửi song song)", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const kq = await Promise.all(Array.from({ length: 30 }, () => dangNhap(t, emailNguoi.ql1, "sai")));
  assert.equal(kq.filter((r) => r.status === 401).length, 10);
  assert.equal(kq.filter((r) => r.status === 429).length, 20);
});

test("khóa đăng nhập cũng áp cho email không tồn tại (không lộ email nào có tài khoản)", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const kq: number[] = [];
  for (let i = 0; i < 11; i++) kq.push((await dangNhap(t, "ma.la@cesglobal.vn", "sai")).status);
  assert.deepEqual(kq, [...Array(10).fill(401), 429]);
});

test("chưa đăng nhập: mọi route dữ liệu trả 401, /health và /auth/login thì không cần", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  for (const [m, p] of [["GET", "/leads"], ["GET", "/leads/x"], ["POST", "/leads"], ["PATCH", "/leads/x"], ["GET", "/tasks"], ["POST", "/tasks"], ["PATCH", "/tasks/x"], ["GET", "/lookups"], ["GET", "/auth/me"], ["GET", "/khong-co-route"]]) {
    const r = await t.goi(m, p, m === "GET" ? undefined : {}, null);
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.equal(r.data.error, "Vui lòng đăng nhập");
  }
  assert.equal((await t.goi("GET", "/health", undefined, null)).status, 200);
});

test("cookie giả hoặc bị sửa thì 401", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const r = await dangNhap(t, emailNguoi.admin, MAT_KHAU_THU);
  const cookie = cookieTu(r.res);
  for (const xau of ["ces_session=abc", `${cookie}x`, cookie.slice(0, -2), "ces_session="]) {
    const res = await t.app.request("/leads", { headers: { cookie: xau } });
    assert.equal(res.status, 401, xau);
  }
});

test("đăng xuất: xóa phiên trong DB, cookie cũ hết tác dụng", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const r = await dangNhap(t, emailNguoi.admin, MAT_KHAU_THU);
  const cookie = cookieTu(r.res);
  const out = await t.app.request("/auth/logout", { method: "POST", headers: { cookie } });
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie") ?? "", /ces_session=;/);
  assert.equal((t.db.prepare("SELECT count(*) n FROM sessions").get() as { n: number }).n, 0);
  assert.equal((await t.app.request("/auth/me", { headers: { cookie } })).status, 401);
});

test("phiên hết hạn sau 7 ngày thì 401 và dòng phiên bị dọn", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const r = await dangNhap(t, emailNguoi.admin, MAT_KHAU_THU);
  const cookie = cookieTu(r.res);
  t.dongHo.t = new Date(t.dongHo.t.getTime() + 6 * 86_400_000);
  assert.equal((await t.app.request("/auth/me", { headers: { cookie } })).status, 200);
  t.dongHo.t = new Date(t.dongHo.t.getTime() + 2 * 86_400_000);
  assert.equal((await t.app.request("/auth/me", { headers: { cookie } })).status, 401);
  assert.equal((t.db.prepare("SELECT count(*) n FROM sessions").get() as { n: number }).n, 0);
});

test("người dùng bị khóa giữa chừng: phiên đang dùng cũng mất tác dụng", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const r = await dangNhap(t, emailNguoi.tv1, MAT_KHAU_THU);
  const cookie = cookieTu(r.res);
  t.db.prepare("UPDATE users SET active = 0 WHERE email = ?").run(emailNguoi.tv1);
  assert.equal((await t.app.request("/auth/me", { headers: { cookie } })).status, 401);
});

test("ORIGIN lạ: request ghi bị 403, request đọc và request không có Origin thì qua", async () => {
  const t = khoiTao({ matKhau: MAT_KHAU_THU });
  const la = { origin: "http://trang-gia-mao.example" };
  // đăng nhập từ trang lạ
  const dn = await dangNhap(t, emailNguoi.admin, MAT_KHAU_THU, la);
  assert.equal(dn.status, 403);
  assert.equal(dn.res.headers.get("set-cookie"), null);
  // đã đăng nhập (cookie hợp lệ) nhưng ghi từ trang lạ
  const khach = { fullName: "Khách Thử Origin", phone: "0911223344", source: "zalo", interestedCourseId: null, stage: "moi", ownerId: null };
  for (const origin of ["http://trang-gia-mao.example", "null", "http://localhost:3001", "https://localhost:3000", "http://localhost:3000.evil.com"]) {
    const r = await t.goi("POST", "/leads", khach, "admin", { origin });
    assert.equal(r.status, 403, `Origin ${origin}`);
    assert.equal(r.data.error, "Yêu cầu bị từ chối vì nguồn gửi không hợp lệ");
  }
  const dau = (t.db.prepare("SELECT count(*) n FROM leads").get() as { n: number }).n;
  assert.equal(dau, 40, "không có khách nào được tạo từ Origin lạ");
  assert.equal((await t.goi("PATCH", "/tasks/x", { done: true }, "admin", la)).status, 403);
  assert.equal((await t.goi("DELETE", "/leads/x", undefined, "admin", la)).status, 403);
  // Origin đúng: ghi được
  assert.equal((await t.goi("POST", "/leads", khach, "admin", { origin: ORIGIN_THU })).status, 201);
  // Đọc từ Origin lạ: không bị chặn bởi bộ lọc này (trình duyệt chặn đọc chéo trang bằng CORS)
  assert.equal((await t.goi("GET", "/leads", undefined, "admin", la)).status, 200);
  // Không có header Origin (curl): qua
  assert.equal((await t.goi("POST", "/leads", { ...khach, phone: "0911223355" })).status, 201);
});

test("cấu hình: thiếu hoặc ngắn SESSION_SECRET thì không khởi động; ALLOWED_ORIGINS đọc được", () => {
  assert.throws(() => loadConfig({}), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ SESSION_SECRET: "ngan" }), /SESSION_SECRET/);
  const c = loadConfig({ SESSION_SECRET: "x".repeat(32), ALLOWED_ORIGINS: "https://a.vn, https://b.vn", COOKIE_SECURE: "true" });
  assert.deepEqual(c.allowedOrigins, ["https://a.vn", "https://b.vn"]);
  assert.equal(c.cookieSecure, true);
  assert.deepEqual(loadConfig({ SESSION_SECRET: "x".repeat(32) }).allowedOrigins, ["http://localhost:3000", "http://127.0.0.1:3000"]);
});
