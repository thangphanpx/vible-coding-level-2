import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lead, Lookups, Page, Task } from "@ces/shared";
import { uuidFrom } from "../db/seed.ts";
import { khoiTao } from "../test-helpers.ts";

const tv1 = uuidFrom("user:tv1");
const tv2 = uuidFrom("user:tv2");
const khoaAI = uuidFrom("course:ai");
const khoaPy = uuidFrom("course:py");

const khachMoi = (sdt: string, them: object = {}) => ({
  fullName: "Nguyễn Thị Thử Nghiệm",
  phone: sdt,
  source: "facebook",
  interestedCourseId: khoaAI,
  stage: "moi",
  ownerId: tv1,
  freeTime: "Tối thứ 4",
  ...them,
});

// ---------- Khách tiềm năng ----------
test("danh sách khách: 20 dòng mỗi trang, trang 2 và trang cuối đúng số lượng", async () => {
  const { goi } = khoiTao();
  const p1 = (await goi<Page<Lead>>("GET", "/leads")).data;
  assert.equal(p1.total, 40);
  assert.equal(p1.pageSize, 20);
  assert.equal(p1.totalPages, 2);
  assert.equal(p1.items.length, 20);
  const p2 = (await goi<Page<Lead>>("GET", "/leads?page=2")).data;
  assert.equal(p2.items.length, 20);
  const trung = new Set([...p1.items, ...p2.items].map((l) => l.id));
  assert.equal(trung.size, 40, "hai trang không được trùng dòng");
  // Trang quá cuối thì lấy trang cuối
  const p9 = (await goi<Page<Lead>>("GET", "/leads?page=9")).data;
  assert.equal(p9.page, 2);
  assert.equal(p9.items.length, 20);
});

test("tìm khách theo tên không phân biệt hoa thường và dấu, theo số điện thoại", async () => {
  const { goi } = khoiTao();
  const a = (await goi<Page<Lead>>("GET", "/leads?q=" + encodeURIComponent("nguyen van hung"))).data;
  assert.deepEqual(a.items.map((l) => l.fullName), ["Nguyễn Văn Hưng"]);
  const b = (await goi<Page<Lead>>("GET", "/leads?q=" + encodeURIComponent("TRẦN THỊ"))).data;
  assert.ok(b.items.some((l) => l.fullName === "Trần Thị Mai Anh"));
  const c = (await goi<Page<Lead>>("GET", "/leads?q=0912345610")).data;
  assert.deepEqual(c.items.map((l) => l.fullName), ["Đặng Văn Long"]);
  const d = (await goi<Page<Lead>>("GET", "/leads?q=" + encodeURIComponent("đặng"))).data;
  assert.ok(d.items.some((l) => l.fullName === "Đặng Văn Long"));
  const e = (await goi<Page<Lead>>("GET", "/leads?q=khong-co-ai-ten-nay")).data;
  assert.equal(e.total, 0);
  assert.equal(e.items.length, 0);
  assert.equal(e.totalPages, 1);
  // ký tự đặc biệt của LIKE không phá câu tìm
  const f = (await goi<Page<Lead>>("GET", "/leads?q=%25")).data;
  assert.equal(f.total, 0);
});

test("lọc khách theo giai đoạn, người phụ trách, khóa quan tâm và kết hợp", async () => {
  const { goi, db } = khoiTao();
  const dem = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const gd = (await goi<Page<Lead>>("GET", "/leads?stage=dang_ky")).data;
  assert.equal(gd.total, dem("SELECT count(*) n FROM leads WHERE stage = 'dang_ky'"));
  assert.ok(gd.items.every((l) => l.stage === "dang_ky"));
  const ow = (await goi<Page<Lead>>("GET", `/leads?ownerId=${tv1}`)).data;
  assert.equal(ow.total, dem("SELECT count(*) n FROM leads WHERE owner_id = ?", tv1));
  assert.ok(ow.items.every((l) => l.ownerId === tv1));
  const none = (await goi<Page<Lead>>("GET", "/leads?ownerId=none")).data;
  assert.equal(none.total, 3);
  assert.ok(none.items.every((l) => l.ownerId === null));
  const kh = (await goi<Page<Lead>>("GET", `/leads?courseId=${khoaPy}`)).data;
  assert.ok(kh.total > 0 && kh.items.every((l) => l.interestedCourseId === khoaPy));
  const kethop = (await goi<Page<Lead>>("GET", `/leads?stage=da_lien_he&ownerId=${tv1}&courseId=${khoaAI}`)).data;
  assert.equal(kethop.total, dem("SELECT count(*) n FROM leads WHERE stage='da_lien_he' AND owner_id=? AND interested_course_id=?", tv1, khoaAI));
  // tham số rỗng bị bỏ qua
  const rong = (await goi<Page<Lead>>("GET", "/leads?stage=&q=&ownerId=")).data;
  assert.equal(rong.total, 40);
});

test("tham số truy vấn sai bị Zod chặn bằng 400 tiếng Việt", async () => {
  const { goi } = khoiTao();
  const r1 = await goi("GET", "/leads?stage=sai");
  assert.equal(r1.status, 400);
  assert.equal(r1.data.fields.stage, "Giai đoạn không hợp lệ");
  const r2 = await goi("GET", "/leads?page=0");
  assert.equal(r2.status, 400);
  assert.equal((await goi("GET", "/leads?page=abc")).status, 400);
  assert.equal((await goi("GET", "/leads?ownerId=khong-phai-uuid")).status, 400);
});

test("thêm khách hợp lệ: 201, có id uuid, tên tư vấn viên và khóa học", async () => {
  const { goi } = khoiTao();
  const r = await goi<Lead>("POST", "/leads", khachMoi("0987 654 321"));
  assert.equal(r.status, 201);
  assert.match(r.data.id, /^[0-9a-f-]{36}$/);
  assert.equal(r.data.phone, "0987654321", "SĐT được chuẩn hóa, bỏ khoảng trắng");
  assert.equal(r.data.ownerName, "Lê Hoàng Nam");
  assert.equal(r.data.interestedCourseName, "AI cho người đi làm");
  assert.equal((await goi<Page<Lead>>("GET", "/leads")).data.total, 41);
  const lay = await goi<Lead>("GET", `/leads/${r.data.id}`);
  assert.equal(lay.data.fullName, "Nguyễn Thị Thử Nghiệm");
});

test("thêm khách sai dữ liệu: 400, mỗi trường một thông báo tiếng Việt", async () => {
  const { goi } = khoiTao();
  const r = await goi("POST", "/leads", { fullName: " ", phone: "123", source: "tiktok", stage: "xyz", interestedCourseId: null, ownerId: "abc" });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, "Dữ liệu không hợp lệ");
  assert.equal(r.data.fields.fullName, "Họ tên tối thiểu 2 ký tự");
  assert.equal(r.data.fields.phone, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0");
  assert.equal(r.data.fields.source, "Vui lòng chọn nguồn khách");
  assert.equal(r.data.fields.stage, "Vui lòng chọn giai đoạn");
  assert.equal(r.data.fields.ownerId, "Người phụ trách không hợp lệ");
  const thieu = await goi("POST", "/leads", {});
  assert.equal(thieu.status, 400);
  assert.equal(thieu.data.fields.fullName, "Vui lòng nhập họ tên");
  const hong = await app_postRaw();
  assert.equal(hong, 400);

  async function app_postRaw() {
    const { app, cookieCho } = khoiTao();
    const res = await app.request("/leads", { method: "POST", body: "{không phải json", headers: { "content-type": "application/json", cookie: cookieCho("admin") } });
    return res.status;
  }
});

test("thêm khách: trùng số điện thoại trả 409; khóa học hoặc người phụ trách không có trả 400", async () => {
  const { goi } = khoiTao();
  const trung = await goi("POST", "/leads", khachMoi("0912345601"));
  assert.equal(trung.status, 409);
  assert.match(trung.data.fields.phone, /Nguyễn Văn Hưng/);
  const maLa = uuidFrom("khong-ton-tai");
  const r = await goi("POST", "/leads", khachMoi("0987000111", { interestedCourseId: maLa, ownerId: maLa }));
  assert.equal(r.status, 400);
  assert.equal(r.data.fields.interestedCourseId, "Khóa học không tồn tại");
  assert.equal(r.data.fields.ownerId, "Người phụ trách không tồn tại");
});

test("sửa khách: đổi một phần, giữ phần còn lại, updated_at đổi", async () => {
  const { goi } = khoiTao();
  const tao = (await goi<Lead>("POST", "/leads", khachMoi("0987000222"))).data;
  await new Promise((r) => setTimeout(r, 15));
  const sua = await goi<Lead>("PATCH", `/leads/${tao.id}`, { stage: "hen_tu_van", ownerId: tv2 });
  assert.equal(sua.status, 200);
  assert.equal(sua.data.stage, "hen_tu_van");
  assert.equal(sua.data.ownerName, "Phạm Thị Lan");
  assert.equal(sua.data.fullName, tao.fullName);
  assert.equal(sua.data.freeTime, "Tối thứ 4");
  assert.ok(sua.data.updatedAt > tao.updatedAt);
  assert.equal(sua.data.createdAt, tao.createdAt);
  // bỏ người phụ trách và xóa thời gian rảnh
  const bo = (await goi<Lead>("PATCH", `/leads/${tao.id}`, { ownerId: null, freeTime: "" })).data;
  assert.equal(bo.ownerId, null);
  assert.equal(bo.freeTime, null);
});

test("sửa khách: sai dữ liệu 400, không có khách 404, đổi sang SĐT đã có 409, giữ SĐT của chính mình thì được", async () => {
  const { goi } = khoiTao();
  const tao = (await goi<Lead>("POST", "/leads", khachMoi("0987000333"))).data;
  assert.equal((await goi("PATCH", `/leads/${tao.id}`, { phone: "abc" })).status, 400);
  assert.equal((await goi("PATCH", `/leads/${tao.id}`, {})).status, 400);
  assert.equal((await goi("PATCH", `/leads/${uuidFrom("ma-la")}`, { stage: "moi" })).status, 404);
  assert.equal((await goi("GET", "/leads/khong-phai-uuid")).status, 404);
  assert.equal((await goi("PATCH", `/leads/${tao.id}`, { phone: "0912345601" })).status, 409);
  assert.equal((await goi("PATCH", `/leads/${tao.id}`, { phone: "0987000333", fullName: "Tên Mới" })).status, 200);
});

test("không có route xóa khách (spec: không xóa dữ liệu)", async () => {
  const { goi } = khoiTao();
  const ds = (await goi<Page<Lead>>("GET", "/leads")).data;
  assert.equal((await goi("DELETE", `/leads/${ds.items[0].id}`)).status, 404);
});

// ---------- Việc cần làm ----------
test("danh sách việc: phân trang 20 dòng, việc chưa xong đứng trước, theo hạn", async () => {
  const { goi } = khoiTao();
  const p1 = (await goi<Page<Task>>("GET", "/tasks")).data;
  assert.equal(p1.total, 21);
  assert.equal(p1.items.length, 20);
  assert.equal(p1.totalPages, 2);
  const p2 = (await goi<Page<Task>>("GET", "/tasks?page=2")).data;
  assert.equal(p2.items.length, 1);
  assert.equal(p2.items[0].done, true, "việc đã xong nằm cuối");
  const chuaXong = p1.items.filter((t) => !t.done);
  assert.deepEqual(chuaXong.map((t) => t.dueDate), chuaXong.map((t) => t.dueDate).sort());
});

test("tìm và lọc việc theo tiêu đề, loại, trạng thái, người làm", async () => {
  const { goi, db } = khoiTao();
  const q = (await goi<Page<Task>>("GET", "/tasks?q=" + encodeURIComponent("hoc phi"))).data;
  assert.ok(q.total >= 3 && q.items.every((t) => /học phí/i.test(t.title)));
  const loai = (await goi<Page<Task>>("GET", "/tasks?type=goi_lai")).data;
  assert.ok(loai.total > 0 && loai.items.every((t) => t.type === "goi_lai"));
  const xong = (await goi<Page<Task>>("GET", "/tasks?status=done")).data;
  assert.equal(xong.total, (db.prepare("SELECT count(*) n FROM tasks WHERE done = 1").get() as { n: number }).n);
  assert.ok(xong.items.every((t) => t.done));
  const mo = (await goi<Page<Task>>("GET", "/tasks?status=open")).data;
  assert.equal(mo.total + xong.total, 21);
  const nguoi = (await goi<Page<Task>>("GET", `/tasks?assigneeId=${tv1}`)).data;
  assert.ok(nguoi.total > 0 && nguoi.items.every((t) => t.assigneeId === tv1));
  assert.equal((await goi("GET", "/tasks?type=sai")).status, 400);
  assert.equal((await goi("GET", "/tasks?status=sai")).status, 400);
});

test("thêm, sửa, đánh dấu xong việc cần làm; dữ liệu sai bị chặn", async () => {
  const { goi } = khoiTao();
  const khach = uuidFrom("lead:0912345610");
  const tao = await goi<Task>("POST", "/tasks", { title: "Gọi lại chốt lịch", dueDate: "2026-10-25", assigneeId: tv1, leadId: khach, type: "goi_lai" });
  assert.equal(tao.status, 201);
  assert.equal(tao.data.done, false);
  assert.equal(tao.data.assigneeName, "Lê Hoàng Nam");
  assert.equal(tao.data.leadName, "Đặng Văn Long");
  const xong = await goi<Task>("PATCH", `/tasks/${tao.data.id}`, { done: true });
  assert.equal(xong.data.done, true);
  assert.equal(xong.data.title, "Gọi lại chốt lịch", "đánh dấu xong không làm mất tiêu đề");
  assert.equal(xong.data.dueDate, "2026-10-25");
  const sua = await goi<Task>("PATCH", `/tasks/${tao.data.id}`, { title: "Gọi lại lần 2", dueDate: "2026-10-30", leadId: null });
  assert.equal(sua.data.title, "Gọi lại lần 2");
  assert.equal(sua.data.leadId, null);
  assert.equal(sua.data.done, true, "sửa tiêu đề không làm đổi trạng thái");

  const sai = await goi("POST", "/tasks", { title: "x", dueDate: "2026-02-31", assigneeId: null, leadId: "abc", type: "khac" });
  assert.equal(sai.status, 400);
  assert.equal(sai.data.fields.title, "Tiêu đề tối thiểu 3 ký tự");
  assert.equal(sai.data.fields.dueDate, "Hạn làm không hợp lệ (định dạng năm-tháng-ngày)");
  assert.equal(sai.data.fields.assigneeId, "Vui lòng chọn người làm");
  assert.equal(sai.data.fields.type, "Vui lòng chọn loại việc");
  const maLa = uuidFrom("ma-la");
  const khongCo = await goi("POST", "/tasks", { title: "Việc thử", dueDate: "2026-10-25", assigneeId: maLa, leadId: maLa, type: "goi_lai" });
  assert.equal(khongCo.status, 400);
  assert.equal(khongCo.data.fields.assigneeId, "Người làm không tồn tại");
  assert.equal((await goi("PATCH", `/tasks/${maLa}`, { done: true })).status, 404);
});

test("danh sách chọn (lookups): người dùng, khóa học, khách", async () => {
  const { goi } = khoiTao();
  const r = (await goi<Lookups>("GET", "/lookups")).data;
  assert.equal(r.users.length, 10);
  assert.equal(r.courses.length, 3);
  assert.equal(r.leads.length, 40);
});
