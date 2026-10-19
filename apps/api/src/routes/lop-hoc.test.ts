import { test } from "node:test";
import assert from "node:assert/strict";
import type { Activity, ClassDetail, ClassSummary, Course, Enrollment } from "@ces/shared";
import { khoiTao } from "../test-helpers.ts";

/** Kiểm thử P4b: khóa học, lớp học, ghi danh, đóng học phí, hoạt động của khách (quy tắc nghiệp vụ và quyền). */

function moi() {
  const t = khoiTao();
  const hang = <T>(sql: string, ...p: any[]) => t.db.prepare(sql).get(...p) as T;
  const lop = (ten: string) => hang<{ id: string }>("SELECT id FROM classes WHERE name = ?", ten).id;
  const khach = (ten: string) => hang<{ id: string }>("SELECT id FROM leads WHERE full_name = ?", ten).id;
  return { ...t, hang, lop, khach };
}

test("khóa học: mọi vai trò xem được, kèm lịch khai giảng", async () => {
  const { goi } = moi();
  for (const ai of ["admin", "ts", "tv1", "ql1"]) {
    const r = await goi<Course[]>("GET", "/courses", undefined, ai);
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 3);
    assert.ok(r.data.every((c) => c.intakes.length >= 1 && Number.isInteger(c.tuitionVnd)));
  }
  assert.equal((await goi("GET", "/courses", undefined, null)).status, 401);
});

test("lớp học: tư vấn viên 403, vai trò khác xem được kèm sĩ số", async () => {
  const { goi } = moi();
  assert.equal((await goi("GET", "/classes", undefined, "tv1")).status, 403);
  const r = await goi<ClassSummary[]>("GET", "/classes", undefined, "ql1");
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 5);
  assert.equal(r.data.find((c) => c.name === "AI-2611")!.enrolledCount, 2);
  assert.equal((await goi("GET", "/classes", undefined, "ts")).status, 200);
});

test("chi tiết lớp: Quản lý lớp học chỉ thấy học viên là khách giai đoạn Đăng ký, lớp không có thì 404", async () => {
  const { goi, lop } = moi();
  const r = await goi<ClassDetail>("GET", `/classes/${lop("AI-2611")}`, undefined, "ql1");
  assert.equal(r.status, 200);
  assert.equal(r.data.enrollments.length, 2);
  assert.equal((await goi("GET", "/classes/00000000-0000-4000-8000-000000000000", undefined, "ql1")).status, 404);
});

test("xếp khách vào lớp: học phí lấy từ khóa học, ghi nhật ký; quyền: tư vấn viên và quản lý tuyển sinh 403", async () => {
  const { goi, lop, khach, db } = moi();
  const body = { leadId: khach("Nguyễn Văn Hưng"), classId: lop("AI-2611"), paymentPlan: "mot_lan" };
  assert.equal((await goi("POST", "/enrollments", body, "tv1")).status, 403);
  assert.equal((await goi("POST", "/enrollments", body, "ts")).status, 403);
  const r = await goi<Enrollment>("POST", "/enrollments", body, "ql1");
  assert.equal(r.status, 201);
  assert.equal(r.data.totalTuitionVnd, 12_000_000);
  assert.equal(r.data.paidVnd, 0);
  const log = db.prepare("SELECT action, user_id FROM audit_logs WHERE action = 'xep_lop'").all();
  assert.equal(log.length, 1);
  // Xếp lần hai: 409, không tạo trùng
  assert.equal((await goi("POST", "/enrollments", body, "ql1")).status, 409);
});

test("xếp khách vào lớp: chỉ khách giai đoạn Đăng ký; lớp đã kết thúc bị từ chối", async () => {
  const { goi, lop, khach } = moi();
  const chuaDangKy = await goi("POST", "/enrollments", { leadId: khach("Kiều Thị Lan Phương"), classId: lop("AI-2611"), paymentPlan: "mot_lan" }, "admin");
  assert.equal(chuaDangKy.status, 400);
  assert.ok(chuaDangKy.data.fields.leadId);
  const ketThuc = await goi("POST", "/enrollments", { leadId: khach("Phạm Ngọc Diệp"), classId: lop("AI-2608"), paymentPlan: "mot_lan" }, "admin");
  assert.equal(ketThuc.status, 400);
  assert.ok(ketThuc.data.fields.classId);
});

test("xếp khách vào lớp: lớp đủ sĩ số thì 409", async () => {
  const { goi, lop, khach, db } = moi();
  db.prepare("UPDATE classes SET max_size = 2 WHERE name = 'AI-2611'").run();
  const r = await goi("POST", "/enrollments", { leadId: khach("Nguyễn Văn Hưng"), classId: lop("AI-2611"), paymentPlan: "mot_lan" }, "ql1");
  assert.equal(r.status, 409);
  assert.match(r.data.error, /đủ 2 học viên/);
});

test("ghi nhận đóng học phí: cộng dồn, không vượt tổng, chỉ số nguyên dương, ghi nhật ký", async () => {
  const { goi, lop, hang, db } = moi();
  const lopId = lop("AI-2609");
  const ghiDanh = hang<{ id: string; total_tuition_vnd: number; paid_vnd: number }>(
    "SELECT id, total_tuition_vnd, paid_vnd FROM enrollments WHERE class_id = ? AND paid_vnd < total_tuition_vnd LIMIT 1",
    lopId,
  );
  const conLai = ghiDanh.total_tuition_vnd - ghiDanh.paid_vnd;
  for (const amountVnd of [0, -5, 1.5]) {
    assert.equal((await goi("POST", `/enrollments/${ghiDanh.id}/payments`, { amountVnd }, "ql1")).status, 400, `số ${amountVnd}`);
  }
  assert.equal((await goi("POST", `/enrollments/${ghiDanh.id}/payments`, { amountVnd: "100" }, "ql1")).status, 400);
  const vuot = await goi("POST", `/enrollments/${ghiDanh.id}/payments`, { amountVnd: conLai + 1 }, "ql1");
  assert.equal(vuot.status, 400);
  assert.ok(vuot.data.fields.amountVnd);
  assert.equal((await goi("POST", `/enrollments/${ghiDanh.id}/payments`, { amountVnd: 1_000_000 }, "tv1")).status, 403);
  const ok = await goi<Enrollment>("POST", `/enrollments/${ghiDanh.id}/payments`, { amountVnd: conLai }, "ql1");
  assert.equal(ok.status, 200);
  assert.equal(ok.data.paidVnd, ghiDanh.total_tuition_vnd);
  assert.equal(db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'dong_hoc_phi'").get()!.n, 1);
  // Đã đóng đủ: đóng thêm bị chặn
  assert.equal((await goi("POST", `/enrollments/${ghiDanh.id}/payments`, { amountVnd: 1 }, "ql1")).status, 400);
});

test("hoạt động của khách: ghi và đọc theo phạm vi; khách ngoài phạm vi 404; có nhãn do AI ghi", async () => {
  const { goi, khach, db } = moi();
  const khachCuaTv1 = khach("Lê Quang Huy"); // tv1 phụ trách
  const ghi = await goi<Activity>("POST", `/leads/${khachCuaTv1}/activities`, { type: "cuoc_goi", content: "Đã gọi, hẹn chiều mai." }, "tv1");
  assert.equal(ghi.status, 201);
  assert.equal(ghi.data.byAi, false);
  const ds = await goi<Activity[]>("GET", `/leads/${khachCuaTv1}/activities`, undefined, "tv1");
  assert.equal(ds.data[0].content, "Đã gọi, hẹn chiều mai.");
  // Gọi điện cập nhật liên hệ gần nhất
  const lead = await goi("GET", `/leads/${khachCuaTv1}`, undefined, "tv1");
  assert.ok(Date.now() - new Date(lead.data.lastContactedAt).getTime() < 60_000);
  // Người khác (tư vấn viên khác) không thấy khách này
  assert.equal((await goi("GET", `/leads/${khachCuaTv1}/activities`, undefined, "tv2")).status, 404);
  assert.equal((await goi("POST", `/leads/${khachCuaTv1}/activities`, { type: "ghi_chu", content: "x" }, "tv2")).status, 404);
  // Nội dung trống hoặc loại sai
  assert.equal((await goi("POST", `/leads/${khachCuaTv1}/activities`, { type: "ghi_chu", content: "   " }, "tv1")).status, 400);
  assert.equal((await goi("POST", `/leads/${khachCuaTv1}/activities`, { type: "khac", content: "x" }, "tv1")).status, 400);
  // Quản lý lớp học chỉ ghi được cho khách đã đăng ký
  const chuaDangKy = khach("Kiều Thị Lan Phương");
  assert.equal((await goi("POST", `/leads/${chuaDangKy}/activities`, { type: "ghi_chu", content: "x" }, "ql1")).status, 404);
  assert.equal((await goi("POST", `/leads/${khach("Nguyễn Văn Hưng")}/activities`, { type: "ghi_chu", content: "Nhắc đóng học phí." }, "ql1")).status, 201);
  assert.equal(db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'them_hoat_dong'").get()!.n, 2);
});

test("chưa đăng nhập thì mọi route lớp học, ghi danh, khóa học đều 401", async () => {
  const { goi } = moi();
  for (const [method, path] of [["GET", "/courses"], ["GET", "/classes"], ["POST", "/enrollments"], ["POST", "/enrollments/x/payments"]] as const) {
    assert.equal((await goi(method, path, method === "POST" ? {} : undefined, null)).status, 401, path);
  }
});
