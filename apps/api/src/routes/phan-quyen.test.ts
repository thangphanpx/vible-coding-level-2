import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Lead, Lookups, Page, Task } from "@ces/shared";
import { CARE_TASK_TYPES } from "@ces/shared";
import { idNguoi, khoiTao } from "../test-helpers.ts";

/**
 * Kiểm thử bảng vai trò × quyền (P6) và từng cách thử vượt quyền.
 * Các test có mã [V01]...[V26] khớp với danh sách ở docs/thu-vuot-quyen.md.
 */

const CARE = CARE_TASK_TYPES as readonly string[];
const sdtMoi = (() => { let n = 0; return () => `09${String(77000000 + ++n)}`; })();
const khachMoi = (them: object = {}) => ({
  fullName: "Nguyễn Thị Thử Quyền", phone: sdtMoi(), source: "facebook", interestedCourseId: null, stage: "moi", ownerId: null, ...them,
});
const viecMoi = (assigneeId: string, them: object = {}) => ({
  title: "Việc thử quyền", dueDate: "2026-11-01", assigneeId, leadId: null, type: "goi_lai", ...them,
});

/** Dựng môi trường và các id hay dùng. */
function moi() {
  const t = khoiTao();
  const { db } = t;
  const hang = <T>(sql: string, ...p: any[]) => db.prepare(sql).get(...p) as T;
  const hangs = <T>(sql: string, ...p: any[]) => db.prepare(sql).all(...p) as T[];
  const tv1 = idNguoi("tv1"), tv2 = idNguoi("tv2"), ql1 = idNguoi("ql1"), ts = idNguoi("ts"), admin = idNguoi("admin");
  const khachCua = (owner: string, stage?: string) =>
    hang<{ id: string; full_name: string; phone: string }>(
      `SELECT id, full_name, phone FROM leads WHERE owner_id = ? ${stage ? "AND stage = ?" : ""} ORDER BY full_name LIMIT 1`,
      ...(stage ? [owner, stage] : [owner]),
    );
  const chuaGiao = hang<{ id: string; full_name: string }>("SELECT id, full_name FROM leads WHERE owner_id IS NULL LIMIT 1");
  const khachDangKy = hang<{ id: string; full_name: string }>("SELECT id, full_name FROM leads WHERE stage = 'dang_ky' ORDER BY full_name LIMIT 1");
  const khachChuaDangKy = hang<{ id: string; full_name: string }>("SELECT id, full_name FROM leads WHERE stage = 'moi' AND owner_id IS NOT NULL ORDER BY full_name LIMIT 1");
  const viecCua = (assignee: string, type?: string) =>
    hang<{ id: string; title: string }>(`SELECT id, title FROM tasks WHERE assignee_id = ? ${type ? "AND type = ?" : ""} AND done = 0 ORDER BY id LIMIT 1`, ...(type ? [assignee, type] : [assignee]));
  /** Dấu vân tay của toàn bộ bảng khách và việc: để chứng minh thao tác bị từ chối không đổi dữ liệu. */
  const dauVan = () =>
    createHash("sha256")
      .update(JSON.stringify([hangs("SELECT * FROM leads ORDER BY id"), hangs("SELECT * FROM tasks ORDER BY id"), hangs("SELECT * FROM users ORDER BY id")]))
      .digest("hex");
  const soNhatKy = () => hang<{ n: number }>("SELECT count(*) n FROM audit_logs").n;
  return { ...t, hang, hangs, tv1, tv2, ql1, ts, admin, khachCua, chuaGiao, khachDangKy, khachChuaDangKy, viecCua, dauVan, soNhatKy };
}

// ============ BẢNG QUYỀN: mỗi vai trò × mỗi thao tác ============

test("BẢNG QUYỀN: số khách và số việc mỗi vai trò được thấy", async () => {
  const m = moi();
  const dem = (sql: string, ...p: any[]) => m.hang<{ n: number }>(sql, ...p).n;
  const kachCuaNguoi = async (who: string) => (await m.goi<Page<Lead>>("GET", "/leads", undefined, who)).data.total;
  assert.equal(await kachCuaNguoi("admin"), 40);
  assert.equal(await kachCuaNguoi("ts"), 40);
  assert.equal(await kachCuaNguoi("tv1"), dem("SELECT count(*) n FROM leads WHERE owner_id = ?", m.tv1));
  assert.equal(await kachCuaNguoi("tv2"), dem("SELECT count(*) n FROM leads WHERE owner_id = ?", m.tv2));
  assert.equal(await kachCuaNguoi("ql1"), dem("SELECT count(*) n FROM leads WHERE stage = 'dang_ky'"));
  assert.ok(dem("SELECT count(*) n FROM leads WHERE owner_id = ?", m.tv1) < 40, "dữ liệu mẫu phải đủ để thấy sự khác biệt");

  const viecCuaNguoi = async (who: string) => (await m.goi<Page<Task>>("GET", "/tasks", undefined, who)).data.total;
  assert.equal(await viecCuaNguoi("admin"), 21);
  assert.equal(await viecCuaNguoi("ts"), 21);
  assert.equal(await viecCuaNguoi("tv1"), dem("SELECT count(*) n FROM tasks WHERE assignee_id = ?", m.tv1));
  const careIn = CARE.map((c) => `'${c}'`).join(",");
  assert.equal(
    await viecCuaNguoi("ql1"),
    dem(`SELECT count(*) n FROM tasks t JOIN leads l ON l.id = t.lead_id WHERE t.type IN (${careIn}) AND l.stage = 'dang_ky'`),
  );
});

test("BẢNG QUYỀN: thêm khách, sửa khách, đổi giai đoạn, đổi người phụ trách (mỗi vai trò)", async () => {
  const m = moi();
  const dangKy = m.khachDangKy.id;
  // [vai trò, thêm khách, sửa tên khách Đăng ký (mọi vai trò đều thấy), đổi người phụ trách, đổi giai đoạn]
  const khachTv1 = m.khachCua(m.tv1, "da_lien_he").id;
  const truthTable: [string, number, number, number, number][] = [
    ["admin", 201, 200, 200, 200],
    ["ts", 201, 200, 200, 200],
    ["ql1", 403, 403, 403, 403],
  ];
  for (const [who, them, sua, giao, stage] of truthTable) {
    assert.equal((await m.goi("POST", "/leads", khachMoi(), who)).status, them, `${who} thêm khách`);
    assert.equal((await m.goi("PATCH", `/leads/${dangKy}`, { fullName: "Tên Sửa Thử" }, who)).status, sua, `${who} sửa khách`);
    assert.equal((await m.goi("PATCH", `/leads/${dangKy}`, { ownerId: who === "ts" ? m.tv2 : m.tv1 }, who)).status, giao, `${who} giao khách`);
    assert.equal((await m.goi("PATCH", `/leads/${dangKy}`, { stage: "dang_ky" }, who)).status, stage, `${who} đổi giai đoạn`);
  }
  // Tư vấn viên: khách của mình được sửa và đổi giai đoạn, không được đổi người phụ trách, khách của người khác là 404
  assert.equal((await m.goi("POST", "/leads", khachMoi(), "tv1")).status, 201);
  assert.equal((await m.goi("PATCH", `/leads/${khachTv1}`, { fullName: "Tên Do Tư Vấn Sửa" }, "tv1")).status, 200);
  assert.equal((await m.goi("PATCH", `/leads/${khachTv1}`, { stage: "hen_tu_van" }, "tv1")).status, 200);
  assert.equal((await m.goi("PATCH", `/leads/${khachTv1}`, { ownerId: m.tv2 }, "tv1")).status, 403);
  assert.equal((await m.goi("PATCH", `/leads/${dangKy}`, { stage: "dang_ky" }, "tv1")).status, 404, "khách của người khác như không tồn tại");
});

test("BẢNG QUYỀN: Admin và Quản lý tuyển sinh thấy và giao được mọi khách, kể cả khách chưa giao", async () => {
  const m = moi();
  for (const who of ["admin", "ts"]) {
    const r = await m.goi<Lead>("PATCH", `/leads/${m.chuaGiao.id}`, { ownerId: m.tv2 }, who);
    assert.equal(r.status, 200, who);
    assert.equal(r.data.ownerId, m.tv2);
    assert.equal((await m.goi("PATCH", `/leads/${m.chuaGiao.id}`, { ownerId: null }, who)).status, 200);
    assert.equal((await m.goi("GET", `/leads/${m.chuaGiao.id}`, undefined, who)).status, 200);
  }
});

// ============ CÁC CÁCH THỬ VƯỢT QUYỀN ============

test("[V01] chưa đăng nhập: mọi route dữ liệu 401", async () => {
  const m = moi();
  const id = m.khachDangKy.id;
  for (const [method, path] of [["GET", "/leads"], ["GET", `/leads/${id}`], ["POST", "/leads"], ["PATCH", `/leads/${id}`], ["GET", "/tasks"], ["POST", "/tasks"], ["GET", "/lookups"]]) {
    assert.equal((await m.goi(method, path, method === "GET" ? undefined : {}, null)).status, 401, `${method} ${path}`);
  }
});

test("[V02] cookie giả, cookie của phiên đã đăng xuất, tiêu đề tự đặt tên người dùng đều vô dụng", async () => {
  const m = moi();
  assert.equal((await m.goi("GET", "/leads", undefined, null, { cookie: "ces_session=toi-la-admin" })).status, 401);
  // đặt header giả danh: vẫn chỉ thấy theo phiên thật
  const r = await m.goi<Page<Lead>>("GET", "/leads", undefined, "tv1", { "x-user-id": m.admin, "x-role": "admin", authorization: "Bearer admin" });
  assert.ok(r.data.total < 40);
  assert.ok(r.data.items.every((l) => l.ownerId === m.tv1));
  const r2 = await m.goi<Page<Lead>>("GET", `/leads?userId=${m.admin}&role=admin&as=admin`, undefined, "tv1");
  assert.ok(r2.data.items.every((l) => l.ownerId === m.tv1));
});

test("[V03] tư vấn viên mở khách của người khác bằng id: 404, giống hệt id không tồn tại", async () => {
  const m = moi();
  const cuaNguoiKhac = m.khachCua(m.tv2).id;
  const that = await m.goi("GET", `/leads/${cuaNguoiKhac}`, undefined, "tv1");
  const gia = await m.goi("GET", `/leads/${idNguoi("khong-ton-tai")}`, undefined, "tv1");
  assert.equal(that.status, 404);
  assert.deepEqual(that.data, gia.data, "không lộ khách có tồn tại hay không");
  assert.equal(that.data.error, "Không tìm thấy khách hàng");
  assert.equal((await m.goi("GET", `/leads/${cuaNguoiKhac}`, undefined, "tv2")).status, 200, "chủ của khách vẫn mở được");
});

test("[V04] tư vấn viên sửa khách của người khác: 404 và dữ liệu không đổi", async () => {
  const m = moi();
  const k = m.khachCua(m.tv2);
  const truoc = m.dauVan();
  const nhatKy = m.soNhatKy();
  for (const body of [{ fullName: "Bị sửa trộm" }, { stage: "khong_theo" }, { ownerId: m.tv1 }, { phone: "0999999999" }]) {
    assert.equal((await m.goi("PATCH", `/leads/${k.id}`, body, "tv1")).status, 404, JSON.stringify(body));
  }
  assert.equal(m.dauVan(), truoc, "dữ liệu không được đổi");
  assert.equal(m.soNhatKy(), nhatKy, "thao tác bị từ chối không ghi nhật ký");
});

test("[V05] tư vấn viên liệt kê: chỉ thấy khách mình; lọc, tìm tên, đoán người khác, danh sách chọn đều không lộ", async () => {
  const m = moi();
  const cuaMinh = (await m.goi<Page<Lead>>("GET", "/leads", undefined, "tv1")).data;
  assert.ok(cuaMinh.items.length > 0 && cuaMinh.items.every((l) => l.ownerId === m.tv1));
  const khachNguoiKhac = m.khachCua(m.tv2);
  const tim = (await m.goi<Page<Lead>>("GET", "/leads?q=" + encodeURIComponent(khachNguoiKhac.full_name), undefined, "tv1")).data;
  assert.equal(tim.total, 0, "tìm theo tên khách người khác ra rỗng");
  const timSdt = (await m.goi<Page<Lead>>("GET", `/leads?q=${khachNguoiKhac.phone}`, undefined, "tv1")).data;
  assert.equal(timSdt.total, 0, "tìm theo số điện thoại khách người khác ra rỗng");
  assert.equal((await m.goi<Page<Lead>>("GET", `/leads?ownerId=${m.tv2}`, undefined, "tv1")).data.total, 0);
  assert.equal((await m.goi<Page<Lead>>("GET", "/leads?ownerId=none", undefined, "tv1")).data.total, 0, "khách chưa giao không thấy");
  for (let p = 1; p <= 3; p++) {
    const r = (await m.goi<Page<Lead>>("GET", `/leads?page=${p}`, undefined, "tv1")).data;
    assert.ok(r.items.every((l) => l.ownerId === m.tv1), `trang ${p}`);
  }
  const lk = (await m.goi<Lookups>("GET", "/lookups", undefined, "tv1")).data;
  assert.equal(lk.leads.length, cuaMinh.total, "danh sách chọn chỉ có khách của mình");
  assert.ok(!lk.leads.some((l) => l.fullName === khachNguoiKhac.full_name));
  assert.deepEqual(lk.users.map((u) => u.id), [m.tv1], "danh sách chọn người dùng chỉ có chính mình");
  assert.ok(!JSON.stringify(lk).includes("@"), "không lộ email");
});

test("[V06] tư vấn viên tự đổi người phụ trách hoặc gán khách mới cho người khác: 403", async () => {
  const m = moi();
  const k = m.khachCua(m.tv1).id;
  assert.equal((await m.goi("PATCH", `/leads/${k}`, { ownerId: m.tv2 }, "tv1")).status, 403, "giao cho người khác");
  assert.equal((await m.goi("PATCH", `/leads/${k}`, { ownerId: null }, "tv1")).status, 403, "bỏ người phụ trách");
  assert.equal(m.hang<{ owner_id: string }>("SELECT owner_id FROM leads WHERE id = ?", k).owner_id, m.tv1);
  assert.equal((await m.goi("PATCH", `/leads/${k}`, { ownerId: m.tv1, fullName: "Gửi lại đúng chủ" }, "tv1")).status, 200, "gửi lại chính mình (form đầy đủ) thì được");
  assert.equal((await m.goi("POST", "/leads", khachMoi({ ownerId: m.tv2 }), "tv1")).status, 403, "thêm khách gán người khác");
  const tuNhan = await m.goi<Lead>("POST", "/leads", khachMoi({ ownerId: null }), "tv1");
  assert.equal(tuNhan.status, 201);
  assert.equal(tuNhan.data.ownerId, m.tv1, "thêm khách bỏ trống người phụ trách thì là chính mình");
});

test("[V07] tư vấn viên tự nhận khách chưa giao: 404 (không thấy khách chưa giao)", async () => {
  const m = moi();
  const truoc = m.dauVan();
  assert.equal((await m.goi("GET", `/leads/${m.chuaGiao.id}`, undefined, "tv1")).status, 404);
  assert.equal((await m.goi("PATCH", `/leads/${m.chuaGiao.id}`, { ownerId: m.tv1 }, "tv1")).status, 404);
  assert.equal(m.dauVan(), truoc);
});

test("[V08] quản lý lớp học: thêm khách 403; sửa khách đăng ký 403; khách chưa đăng ký 404", async () => {
  const m = moi();
  const truoc = m.dauVan();
  assert.equal((await m.goi("POST", "/leads", khachMoi(), "ql1")).status, 403);
  for (const body of [{ fullName: "Sửa trộm" }, { stage: "khong_theo" }, { ownerId: m.tv1 }]) {
    assert.equal((await m.goi("PATCH", `/leads/${m.khachDangKy.id}`, body, "ql1")).status, 403, `khách đăng ký ${JSON.stringify(body)}`);
    assert.equal((await m.goi("PATCH", `/leads/${m.khachChuaDangKy.id}`, body, "ql1")).status, 404, `khách chưa đăng ký ${JSON.stringify(body)}`);
  }
  assert.equal((await m.goi("GET", `/leads/${m.khachDangKy.id}`, undefined, "ql1")).status, 200);
  assert.equal((await m.goi("GET", `/leads/${m.khachChuaDangKy.id}`, undefined, "ql1")).status, 404);
  assert.equal(m.dauVan(), truoc);
});

test("[V09] quản lý lớp học liệt kê: chỉ khách giai đoạn Đăng ký, lọc hay tìm cũng không lòi khách khác", async () => {
  const m = moi();
  const ds = (await m.goi<Page<Lead>>("GET", "/leads", undefined, "ql1")).data;
  assert.ok(ds.total > 0 && ds.items.every((l) => l.stage === "dang_ky"));
  assert.equal((await m.goi<Page<Lead>>("GET", "/leads?stage=moi", undefined, "ql1")).data.total, 0);
  assert.equal((await m.goi<Page<Lead>>("GET", "/leads?stage=khong_theo", undefined, "ql1")).data.total, 0);
  assert.equal((await m.goi<Page<Lead>>("GET", "/leads?q=" + encodeURIComponent(m.khachChuaDangKy.full_name), undefined, "ql1")).data.total, 0);
  const lk = (await m.goi<Lookups>("GET", "/lookups", undefined, "ql1")).data;
  assert.equal(lk.leads.length, ds.total);
});

test("[V10] đổi giai đoạn: khách của mình được (có nhật ký), khách người khác 404, quản lý lớp học 403", async () => {
  const m = moi();
  const mine = m.khachCua(m.tv1, "da_lien_he").id;
  const r = await m.goi<Lead>("PATCH", `/leads/${mine}`, { stage: "hen_tu_van" }, "tv1");
  assert.equal(r.status, 200);
  assert.equal(r.data.stage, "hen_tu_van");
  const log = m.hang<{ action: string; user_id: string; detail: string; by_ai: number }>("SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1", mine);
  assert.equal(log.action, "doi_giai_doan");
  assert.equal(log.user_id, m.tv1);
  assert.equal(log.by_ai, 0);
  assert.match(log.detail, /Đã liên hệ -> Hẹn tư vấn/);
  assert.equal((await m.goi("PATCH", `/leads/${m.khachCua(m.tv2).id}`, { stage: "dang_ky" }, "tv1")).status, 404);
  assert.equal((await m.goi("PATCH", `/leads/${m.khachDangKy.id}`, { stage: "moi" }, "ql1")).status, 403);
});

test("[V11] tư vấn viên xem việc của người khác: danh sách chỉ có việc mình, mở theo id 404, lọc theo người khác rỗng", async () => {
  const m = moi();
  const ds = (await m.goi<Page<Task>>("GET", "/tasks", undefined, "tv1")).data;
  assert.ok(ds.total > 0 && ds.items.every((t) => t.assigneeId === m.tv1));
  const cuaNguoiKhac = m.viecCua(m.tv2).id;
  assert.equal((await m.goi("GET", `/tasks/${cuaNguoiKhac}`, undefined, "tv1")).status, 404);
  assert.equal((await m.goi<Page<Task>>("GET", `/tasks?assigneeId=${m.tv2}`, undefined, "tv1")).data.total, 0);
  assert.equal((await m.goi<Page<Task>>("GET", `/tasks?q=${encodeURIComponent("gọi lại")}&status=open`, undefined, "tv1")).data.items.every((t) => t.assigneeId === m.tv1), true);
  assert.equal((await m.goi("GET", `/tasks/${cuaNguoiKhac}`, undefined, "tv2")).status, 200);
});

test("[V12] tư vấn viên sửa hoặc đánh dấu xong việc của người khác: 404, dữ liệu không đổi", async () => {
  const m = moi();
  const v = m.viecCua(m.tv2).id;
  const truoc = m.dauVan();
  assert.equal((await m.goi("PATCH", `/tasks/${v}`, { done: true }, "tv1")).status, 404);
  assert.equal((await m.goi("PATCH", `/tasks/${v}`, { title: "Sửa trộm tiêu đề" }, "tv1")).status, 404);
  assert.equal((await m.goi("PATCH", `/tasks/${v}`, { assigneeId: m.tv1 }, "tv1")).status, 404, "không giật việc của người khác về mình");
  assert.equal(m.dauVan(), truoc);
});

test("[V13] tư vấn viên giao việc cho người khác (tạo mới hoặc chuyển việc của mình đi): 403", async () => {
  const m = moi();
  const mine = m.viecCua(m.tv1).id;
  assert.equal((await m.goi("POST", "/tasks", viecMoi(m.tv2), "tv1")).status, 403);
  assert.equal((await m.goi("PATCH", `/tasks/${mine}`, { assigneeId: m.tv2 }, "tv1")).status, 403);
  assert.equal(m.hang<{ assignee_id: string }>("SELECT assignee_id FROM tasks WHERE id = ?", mine).assignee_id, m.tv1);
  assert.equal((await m.goi("POST", "/tasks", viecMoi(m.tv1), "tv1")).status, 201, "tạo việc cho chính mình thì được");
  assert.equal((await m.goi("PATCH", `/tasks/${mine}`, { assigneeId: m.tv1, done: true }, "tv1")).status, 200);
  // Admin và Quản lý tuyển sinh giao việc cho ai cũng được
  assert.equal((await m.goi("POST", "/tasks", viecMoi(m.tv2), "admin")).status, 201);
  assert.equal((await m.goi("POST", "/tasks", viecMoi(m.tv2), "ts")).status, 201);
});

test("[V14] gắn việc vào khách ngoài phạm vi: 400 như khách không tồn tại; việc không hiện tên khách ngoài phạm vi", async () => {
  const m = moi();
  const khachNguoiKhac = m.khachCua(m.tv2).id;
  const r = await m.goi("POST", "/tasks", viecMoi(m.tv1, { leadId: khachNguoiKhac }), "tv1");
  assert.equal(r.status, 400);
  assert.equal(r.data.fields.leadId, "Khách liên quan không tồn tại");
  const gia = await m.goi("POST", "/tasks", viecMoi(m.tv1, { leadId: idNguoi("khong-ton-tai") }), "tv1");
  assert.deepEqual(gia.data, r.data, "không phân biệt được khách ngoài phạm vi với khách không có");
  const mine = m.viecCua(m.tv1).id;
  assert.equal((await m.goi("PATCH", `/tasks/${mine}`, { leadId: khachNguoiKhac }, "tv1")).status, 400);
  assert.equal((await m.goi("POST", "/tasks", viecMoi(m.tv1, { leadId: m.khachCua(m.tv1).id }), "tv1")).status, 201, "khách của mình thì được");
  // Việc của tv1 nhưng khách đã thuộc người khác: ẩn tên khách
  m.db.prepare("UPDATE tasks SET lead_id = ? WHERE id = ?").run(khachNguoiKhac, mine);
  const t = (await m.goi<Task>("GET", `/tasks/${mine}`, undefined, "tv1")).data;
  assert.equal(t.leadName, null, "không lộ tên khách ngoài phạm vi");
  assert.ok(!JSON.stringify((await m.goi("GET", "/tasks", undefined, "tv1")).data).includes(m.khachCua(m.tv2).full_name));
  // sửa tiêu đề việc đó vẫn được (không bị kẹt vì khách đã ra ngoài phạm vi)
  assert.equal((await m.goi("PATCH", `/tasks/${mine}`, { title: "Đổi tiêu đề thôi" }, "tv1")).status, 200);
  assert.equal(m.hang<{ lead_id: string }>("SELECT lead_id FROM tasks WHERE id = ?", mine).lead_id, khachNguoiKhac, "sửa tiêu đề không làm mất liên kết khách");
});

test("[V15] quản lý lớp học: chỉ việc chăm sóc sau đăng ký; việc gọi lại 404; tạo việc ngoài phạm vi 403 hoặc 400", async () => {
  const m = moi();
  const ds = (await m.goi<Page<Task>>("GET", "/tasks", undefined, "ql1")).data;
  assert.ok(ds.total > 0);
  assert.ok(ds.items.every((t) => CARE.includes(t.type)), "chỉ loại chăm sóc sau đăng ký");
  const goiLai = m.hang<{ id: string }>("SELECT id FROM tasks WHERE type = 'goi_lai' LIMIT 1").id;
  assert.equal((await m.goi("GET", `/tasks/${goiLai}`, undefined, "ql1")).status, 404);
  assert.equal((await m.goi("PATCH", `/tasks/${goiLai}`, { done: true }, "ql1")).status, 404);
  assert.equal((await m.goi<Page<Task>>("GET", "/tasks?type=goi_lai", undefined, "ql1")).data.total, 0);
  // tạo việc
  assert.equal((await m.goi("POST", "/tasks", viecMoi(m.ql1, { type: "goi_lai", leadId: m.khachDangKy.id }), "ql1")).status, 403, "loại việc không phải chăm sóc");
  const khongKhach = await m.goi("POST", "/tasks", viecMoi(m.ql1, { type: "nhac_hoc_phi" }), "ql1");
  assert.equal(khongKhach.status, 400);
  assert.ok(khongKhach.data.fields.leadId);
  const khachChua = await m.goi("POST", "/tasks", viecMoi(m.ql1, { type: "nhac_hoc_phi", leadId: m.khachChuaDangKy.id }), "ql1");
  assert.equal(khachChua.status, 400, "khách chưa đăng ký");
  const ok = await m.goi<Task>("POST", "/tasks", viecMoi(m.ql1, { type: "nhac_buoi_hoc", leadId: m.khachDangKy.id }), "ql1");
  assert.equal(ok.status, 201);
  assert.equal(ok.data.leadName, m.khachDangKy.full_name);
  // sửa
  const cs = ok.data.id;
  assert.equal((await m.goi("PATCH", `/tasks/${cs}`, { type: "goi_lai" }, "ql1")).status, 403, "đổi sang loại ngoài chăm sóc");
  assert.equal((await m.goi("PATCH", `/tasks/${cs}`, { leadId: null }, "ql1")).status, 400, "bỏ khách khỏi việc chăm sóc");
  assert.equal((await m.goi("PATCH", `/tasks/${cs}`, { leadId: m.khachChuaDangKy.id }, "ql1")).status, 400);
  assert.equal((await m.goi("PATCH", `/tasks/${cs}`, { done: true }, "ql1")).status, 200, "đánh dấu xong việc chăm sóc");
  // Việc chăm sóc nhưng khách chuyển khỏi giai đoạn Đăng ký: ql không còn thấy
  m.db.prepare("UPDATE leads SET stage = 'khong_theo' WHERE id = ?").run(m.khachDangKy.id);
  assert.equal((await m.goi("GET", `/tasks/${cs}`, undefined, "ql1")).status, 404);
});

test("[V16] Admin và Quản lý tuyển sinh thấy mọi việc và làm được mọi thao tác trong bảng", async () => {
  const m = moi();
  const v = m.viecCua(m.tv2);
  for (const who of ["admin", "ts"]) {
    assert.equal((await m.goi<Page<Task>>("GET", "/tasks", undefined, who)).data.total, 21);
    assert.equal((await m.goi("PATCH", `/tasks/${v.id}`, { done: true }, who)).status, 200);
    assert.equal((await m.goi("PATCH", `/tasks/${v.id}`, { done: false, assigneeId: m.tv1 }, who)).status, 200);
    assert.equal((await m.goi("PATCH", `/tasks/${v.id}`, { assigneeId: m.tv2 }, who)).status, 200);
    const lk = (await m.goi<Lookups>("GET", "/lookups", undefined, who)).data;
    assert.equal(lk.users.length, 10);
    assert.equal(lk.leads.length, 40);
  }
});

test("[V17] gửi thêm trường lạ để leo quyền (id, role, createdAt, updatedAt, by_ai): bị bỏ qua", async () => {
  const m = moi();
  const k = m.khachCua(m.tv1);
  const truoc = m.hang<{ id: string; created_at: string }>("SELECT id, created_at FROM leads WHERE id = ?", k.id);
  const r = await m.goi<Lead>("PATCH", `/leads/${k.id}`, {
    fullName: "Tên Hợp Lệ", id: m.khachCua(m.tv2).id, role: "admin", createdAt: "2000-01-01T00:00:00Z", updatedAt: "2000-01-01T00:00:00Z", password_hash: "x", by_ai: 1,
  }, "tv1");
  assert.equal(r.status, 200);
  assert.equal(r.data.id, k.id);
  assert.equal(m.hang<{ created_at: string }>("SELECT created_at FROM leads WHERE id = ?", k.id).created_at, truoc.created_at);
  assert.equal(m.hang<{ role: string }>("SELECT role FROM users WHERE id = ?", m.tv1).role, "tu_van_vien");
  // người dùng gửi {role} cho API đăng nhập/hồ sơ: không có route sửa người dùng
  assert.equal((await m.goi("PATCH", `/users/${m.tv1}`, { role: "admin" }, "tv1")).status, 404);
  assert.equal((await m.goi("PATCH", "/auth/me", { role: "admin" }, "tv1")).status, 404);
  // việc: không đổi được id
  const v = m.viecCua(m.tv1).id;
  const rv = await m.goi<Task>("PATCH", `/tasks/${v}`, { done: true, id: m.viecCua(m.tv2).id }, "tv1");
  assert.equal(rv.data.id, v);
});

test("[V18] không có chức năng xóa: DELETE (cả PUT) vào khách, việc, người dùng đều không làm được gì, kể cả Admin", async () => {
  const m = moi();
  const truoc = m.dauVan();
  for (const who of ["admin", "ts", "tv1", "ql1"]) {
    for (const [method, path] of [["DELETE", `/leads/${m.khachCua(m.tv1).id}`], ["DELETE", `/tasks/${m.viecCua(m.tv1).id}`], ["DELETE", `/users/${m.tv1}`], ["PUT", `/leads/${m.khachCua(m.tv1).id}`], ["DELETE", "/leads"]]) {
      const r = await m.goi(method, path, undefined, who);
      assert.ok(r.status === 404, `${who} ${method} ${path} -> ${r.status}`);
    }
  }
  assert.equal(m.dauVan(), truoc);
});

test("[V19] trang giả mạo (Origin lạ) không ghi được dù đang đăng nhập bằng tài khoản có quyền", async () => {
  const m = moi();
  const truoc = m.dauVan();
  const la = { origin: "http://trang-gia-mao.example" };
  assert.equal((await m.goi("PATCH", `/leads/${m.khachCua(m.tv1).id}`, { fullName: "Bị CSRF" }, "tv1", la)).status, 403);
  assert.equal((await m.goi("POST", "/tasks", viecMoi(m.tv1), "tv1", la)).status, 403);
  assert.equal(m.dauVan(), truoc);
});

test("[V20] người dùng bị khóa thì mất quyền ngay ở request kế tiếp", async () => {
  const m = moi();
  assert.equal((await m.goi("GET", "/leads", undefined, "tv1")).status, 200);
  m.db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(m.tv1);
  assert.equal((await m.goi("GET", "/leads", undefined, "tv1")).status, 401);
});

test("[V21] đoán id kỳ quặc và chèn SQL vào ô tìm kiếm: không lòi dữ liệu, không lỗi hệ thống", async () => {
  const m = moi();
  for (const id of ["' OR '1'='1", "1; DROP TABLE leads", "../etc/passwd", "%00", encodeURIComponent("' OR 1=1 --"), "*"]) {
    const r = await m.goi("GET", `/leads/${id}`, undefined, "tv1");
    assert.equal(r.status, 404, id);
    assert.equal((await m.goi("PATCH", `/tasks/${id}`, { done: true }, "tv1")).status, 404, id);
  }
  const tong = (await m.goi<Page<Lead>>("GET", "/leads", undefined, "tv1")).data.total;
  for (const q of ["' OR 1=1 --", "%", "_", "\\", "x' UNION SELECT * FROM users --"]) {
    const r = await m.goi<Page<Lead>>("GET", `/leads?q=${encodeURIComponent(q)}`, undefined, "tv1");
    assert.equal(r.status, 200, q);
    assert.ok(r.data.total <= tong && r.data.items.every((l) => l.ownerId === m.tv1), q);
  }
  assert.equal((await m.goi("GET", "/leads?ownerId=' OR '1'='1", undefined, "tv1")).status, 400);
  assert.equal(m.hang<{ n: number }>("SELECT count(*) n FROM leads").n, 40, "bảng khách còn nguyên");
});

test("[V22] báo trùng số điện thoại không lộ tên khách ngoài phạm vi", async () => {
  const m = moi();
  const cuaNguoiKhac = m.khachCua(m.tv2);
  const cuaMinh = m.khachCua(m.tv1);
  const lo = await m.goi("POST", "/leads", khachMoi({ phone: cuaNguoiKhac.phone }), "tv1");
  assert.equal(lo.status, 409);
  assert.ok(!JSON.stringify(lo.data).includes(cuaNguoiKhac.full_name), "không lộ tên");
  const cua = await m.goi("POST", "/leads", khachMoi({ phone: cuaMinh.phone }), "tv1");
  assert.equal(cua.status, 409);
  assert.ok(cua.data.fields.phone.includes(cuaMinh.full_name), "khách của mình thì báo rõ tên");
  const qtr = await m.goi("POST", "/leads", khachMoi({ phone: cuaNguoiKhac.phone }), "admin");
  assert.ok(qtr.data.fields.phone.includes(cuaNguoiKhac.full_name), "admin thấy tất cả nên báo rõ tên");
  // đổi số điện thoại sang số của khách người khác cũng không lộ
  const sua = await m.goi("PATCH", `/leads/${cuaMinh.id}`, { phone: cuaNguoiKhac.phone }, "tv1");
  assert.equal(sua.status, 409);
  assert.ok(!JSON.stringify(sua.data).includes(cuaNguoiKhac.full_name));
});

test("[V23] đoán các route chưa có (người dùng, nhật ký...): 404, chưa đăng nhập thì 401", async () => {
  const m = moi();
  for (const path of ["/users", "/audit-logs", "/admin", "/chat", "/leads/export", "/debug"]) {
    const r = await m.goi("GET", path, undefined, "tv1");
    assert.equal(r.status, 404, path);
    assert.equal((await m.goi("GET", path, undefined, null)).status, 401, `${path} chưa đăng nhập`);
  }
});

test("[V24] nhật ký: mỗi thao tác thêm/sửa ghi đúng người làm, hành động, mô tả (không lộ số điện thoại); bị từ chối thì không ghi", async () => {
  const m = moi();
  const dau = m.soNhatKy();
  const logs = () => m.hangs<{ user_id: string; action: string; entity_type: string; entity_id: string; detail: string; by_ai: number }>(
    "SELECT user_id, action, entity_type, entity_id, detail, by_ai FROM audit_logs ORDER BY created_at, rowid LIMIT -1 OFFSET ?", dau);

  const k = await m.goi<Lead>("POST", "/leads", khachMoi({ fullName: "Khách Nhật Ký", phone: "0955000111" }), "tv1");
  const v = await m.goi<Task>("POST", "/tasks", viecMoi(m.tv1, { title: "Việc nhật ký", leadId: k.data.id }), "tv1");
  await m.goi("PATCH", `/leads/${k.data.id}`, { fullName: "Khách Nhật Ký 2", phone: "0955000222", stage: "da_lien_he" }, "tv1");
  await m.goi("PATCH", `/leads/${k.data.id}`, { ownerId: m.tv2 }, "ts");
  await m.goi("PATCH", `/tasks/${v.data.id}`, { done: true }, "tv1");
  await m.goi("PATCH", `/tasks/${v.data.id}`, { done: false, title: "Việc nhật ký 2" }, "tv1");
  const doi = logs();
  assert.deepEqual(
    doi.map((l) => [l.action, l.user_id]),
    [
      ["tao_khach", m.tv1], ["tao_viec", m.tv1],
      ["doi_giai_doan", m.tv1], ["sua_khach", m.tv1],
      ["giao_khach", m.ts],
      ["hoan_thanh_viec", m.tv1], ["mo_lai_viec", m.tv1], ["sua_viec", m.tv1],
    ] as [string, string][],
    "đúng thứ tự, đúng người làm" + JSON.stringify(doi.map((l) => l.action)),
  );
  assert.ok(doi.every((l) => l.by_ai === 0));
  assert.ok(doi.every((l) => l.detail.length > 5 && !/09\d{8}/.test(l.detail)), "mô tả tiếng Việt, không chứa số điện thoại");
  assert.ok(doi.some((l) => l.entity_type === "leads" && l.entity_id === k.data.id));
  assert.ok(doi.some((l) => l.entity_type === "tasks" && l.entity_id === v.data.id));

  // Gửi lại đúng dữ liệu cũ: không có gì đổi thì không ghi nhật ký
  const n = m.soNhatKy();
  await m.goi("PATCH", `/leads/${k.data.id}`, { fullName: "Khách Nhật Ký 2" }, "ts");
  assert.equal(m.soNhatKy(), n);

  // Thao tác bị từ chối không ghi gì và không đổi gì
  const truoc = m.dauVan();
  await m.goi("POST", "/leads", khachMoi(), "ql1");
  await m.goi("PATCH", `/leads/${m.khachCua(m.tv2).id}`, { fullName: "x y" }, "tv1");
  await m.goi("PATCH", `/leads/${m.khachCua(m.tv1).id}`, { ownerId: m.tv2 }, "tv1");
  await m.goi("POST", "/tasks", viecMoi(m.tv2), "tv1");
  await m.goi("POST", "/leads", khachMoi(), null);
  await m.goi("POST", "/leads", { fullName: "" }, "admin"); // dữ liệu sai
  assert.equal(m.soNhatKy(), n, "thao tác bị từ chối không ghi nhật ký");
  assert.equal(m.dauVan(), truoc);
});

test("[V25] ghi dữ liệu và nhật ký cùng một giao dịch: lỗi giữa chừng thì không còn dòng nhật ký mồ côi", async () => {
  const m = moi();
  const n = m.soNhatKy();
  // Làm hỏng bảng nhật ký để việc ghi nhật ký lỗi: thay đổi dữ liệu cũng phải hoàn tác
  m.db.exec("DROP TABLE audit_logs; CREATE TABLE audit_logs (id TEXT PRIMARY KEY, x INTEGER NOT NULL);");
  const k = m.khachCua(m.tv1);
  const truoc = m.hang<{ full_name: string }>("SELECT full_name FROM leads WHERE id = ?", k.id).full_name;
  const r = await m.goi("PATCH", `/leads/${k.id}`, { fullName: "Không được lưu" }, "tv1");
  assert.equal(r.status, 500);
  assert.equal(m.hang<{ full_name: string }>("SELECT full_name FROM leads WHERE id = ?", k.id).full_name, truoc, "thay đổi bị hoàn tác");
  assert.ok(n >= 0);
});

test("[V26] mỗi vai trò chỉ lấy được đúng phần của mình khi gọi tuần tự nhiều tài khoản trong cùng lúc", async () => {
  const m = moi();
  const [a, b, c] = await Promise.all([
    m.goi<Page<Lead>>("GET", "/leads", undefined, "tv1"),
    m.goi<Page<Lead>>("GET", "/leads", undefined, "tv2"),
    m.goi<Page<Lead>>("GET", "/leads", undefined, "ql1"),
  ]);
  assert.ok(a.data.items.every((l) => l.ownerId === m.tv1));
  assert.ok(b.data.items.every((l) => l.ownerId === m.tv2));
  assert.ok(c.data.items.every((l) => l.stage === "dang_ky"));
  const ids = new Set(a.data.items.map((l) => l.id));
  assert.ok(!b.data.items.some((l) => ids.has(l.id)), "hai tư vấn viên không có khách chung");
});
