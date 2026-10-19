import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "./database.ts";
import { demBang, seed, uuidFrom } from "./seed.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BANG = [
  "users", "courses", "course_intakes", "leads", "activities", "tasks",
  "classes", "enrollments", "documents", "document_chunks", "audit_logs", "chat_messages",
];

function taoDb() {
  const db = openDatabase(":memory:");
  seed(db);
  return db;
}

test("schema chạy lại nhiều lần không lỗi", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  migrate(db);
  const n = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get() as { n: number };
  assert.equal(n.n, BANG.length);
});

test("seed chạy hai lần: số dòng không đổi, không trùng", () => {
  const db = openDatabase(":memory:");
  const lan1 = seed(db);
  const lan2 = seed(db);
  assert.deepEqual(lan2, lan1);
  assert.deepEqual(demBang(db), lan1);
  assert.ok(lan1.users === 10 && lan1.leads >= 30 && lan1.courses === 3);
});

test("mọi id là uuid và mọi bảng có created_at, updated_at", () => {
  const db = taoDb();
  for (const bang of BANG) {
    const cot = (db.prepare(`PRAGMA table_info(${bang})`).all() as { name: string }[]).map((c) => c.name);
    assert.ok(cot.includes("created_at") && cot.includes("updated_at"), `${bang} thiếu created_at/updated_at`);
    for (const r of db.prepare(`SELECT id, created_at, updated_at FROM ${bang}`).all() as { id: string; created_at: string; updated_at: string }[]) {
      assert.match(r.id, UUID, `${bang}.id không phải uuid`);
      assert.ok(!Number.isNaN(Date.parse(r.created_at)) && !Number.isNaN(Date.parse(r.updated_at)));
    }
  }
});

test("id tự sinh khi không truyền (uuid v4) và uuidFrom ổn định", () => {
  const db = openDatabase(":memory:");
  db.prepare("INSERT INTO courses (name, tuition_vnd, sessions) VALUES ('Thử', 1000, 1)").run();
  const { id } = db.prepare("SELECT id FROM courses").get() as { id: string };
  assert.match(id, UUID);
  assert.equal(uuidFrom("a"), uuidFrom("a"));
  assert.notEqual(uuidFrom("a"), uuidFrom("b"));
});

test("TIỀN: chỉ nhận số nguyên đồng, không nhận số lẻ, số âm hay chữ", () => {
  const db = taoDb();
  const them = (hocPhi: unknown) => () =>
    db.prepare("INSERT INTO courses (name, tuition_vnd, sessions) VALUES (?, ?, 1)").run(`K${Math.random()}`, hocPhi as number);
  assert.throws(them(1_500_000.5));
  assert.throws(them(-1));
  assert.throws(them("12 triệu"));
  assert.doesNotThrow(them(1_500_000));
  // Dữ liệu mẫu: mọi cột tiền đều là số nguyên
  const kieu = db.prepare("SELECT DISTINCT typeof(tuition_vnd) AS t FROM courses").all() as { t: string }[];
  assert.deepEqual(kieu.map((r) => r.t), ["integer"]);
  const ghiDanh = db.prepare("SELECT typeof(total_tuition_vnd) AS a, typeof(paid_vnd) AS b FROM enrollments").all() as { a: string; b: string }[];
  assert.ok(ghiDanh.every((r) => r.a === "integer" && r.b === "integer"));
});

test("TIỀN: số đã đóng không vượt tổng học phí; trả góp đợt 1 đúng 60%", () => {
  const db = taoDb();
  const e = db.prepare("SELECT id FROM enrollments LIMIT 1").get() as { id: string };
  assert.throws(() => db.prepare("UPDATE enrollments SET paid_vnd = total_tuition_vnd + 1 WHERE id = ?").run(e.id));
  const quaMuc = db.prepare("SELECT count(*) AS n FROM enrollments WHERE paid_vnd > total_tuition_vnd").get() as { n: number };
  assert.equal(quaMuc.n, 0);
  // đợt 1 = 60% tổng học phí cho khách trả góp chưa đóng đợt 2 (hạn đợt 2 còn sau hôm nay)
  const dot1 = db
    .prepare("SELECT total_tuition_vnd AS t, paid_vnd AS p FROM enrollments WHERE payment_plan = 'tra_gop' AND second_due_date >= '2026-10-19'")
    .all() as { t: number; p: number }[];
  assert.ok(dot1.length > 0);
  for (const r of dot1) assert.equal(r.p, r.t * 0.6);
});

test("học phí giảm giá đúng chính sách (không có số lẻ)", () => {
  const db = taoDb();
  const rows = db
    .prepare(`SELECT e.total_tuition_vnd AS t, c.tuition_vnd AS goc FROM enrollments e
      JOIN classes l ON l.id = e.class_id JOIN course_intakes i ON i.id = l.intake_id JOIN courses c ON c.id = i.course_id`)
    .all() as { t: number; goc: number }[];
  for (const r of rows) assert.ok([r.goc, r.goc * 0.9, r.goc * 0.85].includes(r.t), `học phí ${r.t} không khớp ưu đãi của ${r.goc}`);
});

test("khóa ngoại và giá trị liệt kê được kiểm tra", () => {
  const db = taoDb();
  assert.throws(() => db.prepare("INSERT INTO leads (full_name, phone, source, owner_id) VALUES ('A', '0900000000', 'facebook', 'khong-ton-tai-0000-0000-000000000000')").run());
  assert.throws(() => db.prepare("INSERT INTO leads (full_name, phone, source, stage) VALUES ('A', '0900000000', 'facebook', 'sai')").run());
  assert.throws(() => db.prepare("INSERT INTO users (email, full_name, role) VALUES ('x@y.vn', 'X', 'sieu_nhan')").run());
});

test("updated_at tự đổi khi sửa dòng, created_at giữ nguyên", async () => {
  const db = taoDb();
  const truoc = db.prepare("SELECT id, created_at, updated_at FROM leads LIMIT 1").get() as { id: string; created_at: string; updated_at: string };
  await new Promise((r) => setTimeout(r, 15));
  db.prepare("UPDATE leads SET free_time = 'Sáng thứ 7' WHERE id = ?").run(truoc.id);
  const sau = db.prepare("SELECT created_at, updated_at FROM leads WHERE id = ?").get(truoc.id) as { created_at: string; updated_at: string };
  assert.equal(sau.created_at, truoc.created_at);
  assert.ok(sau.updated_at > truoc.updated_at);
});

test("dữ liệu mẫu bằng tiếng Việt có dấu và có đủ giai đoạn, vai trò", () => {
  const db = taoDb();
  const gd = (db.prepare("SELECT DISTINCT stage FROM leads").all() as { stage: string }[]).map((r) => r.stage).sort();
  assert.deepEqual(gd, ["da_lien_he", "dang_ky", "hen_tu_van", "khong_theo", "moi"]);
  const vt = (db.prepare("SELECT DISTINCT role FROM users").all() as { role: string }[]).map((r) => r.role).sort();
  assert.deepEqual(vt, ["admin", "quan_ly_lop_hoc", "quan_ly_tuyen_sinh", "tu_van_vien"]);
  const ten = db.prepare("SELECT full_name FROM users WHERE role = 'admin'").get() as { full_name: string };
  assert.equal(ten.full_name, "Nguyễn Minh Quân");
});
