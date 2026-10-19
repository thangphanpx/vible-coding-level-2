import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeText } from "@tanstack/ai/testing";
import { KHOA_DICH_VU_THU, khoiTao } from "../../api/src/test-helpers.ts";
import { readFileSync } from "node:fs";
import { createAiApp } from "./server.ts";

/**
 * P10: công cụ GHI cần người duyệt. Chạy thật với API thật (SQLite bộ nhớ) và mô hình GIẢ.
 * Giao thức: lượt 1 dừng ở thẻ xác nhận (interrupt); lượt 2 gửi lại "đã duyệt" hoặc "từ chối" kèm mã lượt cũ.
 */

function moi() {
  const api = khoiTao();
  const fake = fakeText();
  const ai = createAiApp({
    apiUrl: "http://api", adapter: () => fake, agentMd: readFileSync(new URL("../AGENT.md", import.meta.url), "utf8"), skills: [],
    asksPerHour: 1000, serviceKey: KHOA_DICH_VU_THU,
    fetch: async (u, i) => api.app.fetch(new Request(u, i)),
  });
  const dem = (sql: string, ...p: any[]) => (api.db.prepare(sql).get(...p) as { n: number }).n;
  const id = (sql: string) => (api.db.prepare(sql).get() as { id: string }).id;
  return { api, fake, ai, dem, id };
}
type M = ReturnType<typeof moi>;
type Cuoc = { events: Record<string, any>[]; snapshot: any[]; interrupts: any[]; interruptedRunId?: string };

function phanTich(events: Record<string, any>[]): Cuoc {
  // Một lượt nhiều bước có nhiều RUN_FINISHED: thẻ xác nhận nằm ở cái CUỐI.
  const fin = events.findLast((e) => e.type === "RUN_FINISHED");
  const interrupts = fin?.outcome?.type === "interrupt" ? fin.outcome.interrupts : [];
  return {
    events, interrupts,
    snapshot: events.findLast((e) => e.type === "MESSAGES_SNAPSHOT")?.messages ?? [],
    interruptedRunId: interrupts[0]?.metadata?.["tanstack:interruptBinding"]?.interruptedRunId,
  };
}

async function gui(m: M, who: string, body: Record<string, unknown>): Promise<Cuoc> {
  const res = await m.ai.request("/chat", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: m.api.cookieCho(who) },
    body: JSON.stringify({ threadId: `t-${who}`, runId: crypto.randomUUID(), tools: [], context: [], state: {}, forwardedProps: {}, ...body }),
  });
  const text = await res.text();
  return phanTich(text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5))));
}
const hoi = (m: M, who: string, text: string) => gui(m, who, { messages: [{ id: crypto.randomUUID(), role: "user", content: text }] });
const traLoi = (m: M, who: string, c: Cuoc, approved: boolean) =>
  gui(m, who, {
    parentRunId: c.interruptedRunId, messages: c.snapshot,
    resume: c.interrupts.map((i) => ({ interruptId: i.id, status: "resolved", payload: { approved } })),
  });
const ketQuaCongCu = (c: Cuoc) => c.events.find((e) => e.type === "TOOL_CALL_RESULT")!.content as string;

const SQL_VIEC = "SELECT count(*) AS n FROM tasks WHERE title = 'Gọi lại chị Lan'";
const hoiTaoViec = (m: M) =>
  m.fake.setResponses([
    { toolCalls: [{ name: "create_task", input: { title: "Gọi lại chị Lan", due_date: "2026-10-26", type: "goi_lai" } }] },
    { text: "Đã tạo việc." },
  ]);

test("tạo việc: dừng lại chờ duyệt, CHƯA ghi gì; Từ chối thì không ghi", async () => {
  const m = moi();
  hoiTaoViec(m);
  const c = await hoi(m, "tv1", "Hẹn gọi lại chị Lan 9h thứ Hai");
  assert.equal(c.interrupts.length, 1);
  assert.equal(c.interrupts[0].metadata.toolName, "create_task");
  assert.equal(m.dem(SQL_VIEC), 0);
  m.fake.setResponses([{ text: "Dạ em không tạo việc." }]);
  await traLoi(m, "tv1", c, false);
  assert.equal(m.dem(SQL_VIEC), 0);
});

test("tạo việc: Duyệt thì ghi đúng một việc của đúng người hỏi, nhật ký ghi do AI làm", async () => {
  const m = moi();
  hoiTaoViec(m);
  const c = await hoi(m, "tv1", "Hẹn gọi lại chị Lan 9h thứ Hai");
  const r = await traLoi(m, "tv1", c, true);
  assert.equal(m.dem(SQL_VIEC), 1);
  assert.equal(JSON.parse(ketQuaCongCu(r)).ok, true);
  const viec = m.api.db.prepare("SELECT u.email FROM tasks t JOIN users u ON u.id = t.assignee_id WHERE t.title = 'Gọi lại chị Lan'").get() as { email: string };
  assert.equal(viec.email, "nam.le@cesglobal.vn");
  assert.equal(m.dem("SELECT by_ai AS n FROM audit_logs WHERE action = 'tao_viec' ORDER BY created_at DESC, rowid DESC LIMIT 1"), 1);
});

test("gửi lại cùng một lệnh Duyệt hai lần: vẫn chỉ một việc", async () => {
  const m = moi();
  hoiTaoViec(m);
  const c = await hoi(m, "tv1", "Hẹn gọi lại chị Lan");
  m.fake.appendResponses([{ text: "lần hai" }]);
  await traLoi(m, "tv1", c, true);
  await traLoi(m, "tv1", c, true).catch(() => undefined);
  assert.equal(m.dem(SQL_VIEC), 1);
});

test("công cụ ghi vẫn dùng quyền của người hỏi: quản lý lớp học tạo khách bị từ chối, không ghi gì", async () => {
  const m = moi();
  m.fake.setResponses([
    { toolCalls: [{ name: "create_lead", input: { full_name: "Khách Thử Quyền", phone: "0988000111" } }] },
    { text: "Em không làm được." },
  ]);
  const c = await hoi(m, "ql1", "Thêm khách Khách Thử Quyền 0988000111");
  const r = await traLoi(m, "ql1", c, true);
  assert.match(ketQuaCongCu(r), /không được thêm khách/);
  assert.equal(m.dem("SELECT count(*) AS n FROM leads WHERE full_name = 'Khách Thử Quyền'"), 0);
});

test("mã khách bịa sai định dạng: bị chặn TRƯỚC khi hỏi duyệt (không có thẻ xác nhận)", async () => {
  const m = moi();
  m.fake.setResponses([
    { toolCalls: [{ name: "update_lead_stage", input: { lead_id: "lead-123", stage: "dang_ky" } }] },
    { text: "Em cần tìm khách trước." },
  ]);
  const c = await hoi(m, "tv1", "Chuyển anh Hưng sang đăng ký");
  assert.equal(c.interrupts.length, 0);
});

test("đổi giai đoạn: Duyệt thì đổi và ghi do AI; khách ngoài phạm vi thì công cụ báo không tìm thấy, dữ liệu giữ nguyên", async () => {
  const m = moi();
  const hung = m.id("SELECT id FROM leads WHERE full_name = 'Nguyễn Văn Hưng'");
  const maiAnh = m.id("SELECT id FROM leads WHERE full_name = 'Trần Thị Mai Anh'");
  m.fake.setResponses([{ toolCalls: [{ name: "update_lead_stage", input: { lead_id: hung, stage: "khong_theo" } }] }, { text: "ok" }]);
  await traLoi(m, "tv1", await hoi(m, "tv1", "Đánh dấu anh Hưng không theo"), true);
  assert.equal((m.api.db.prepare("SELECT stage FROM leads WHERE id = ?").get(hung) as any).stage, "khong_theo");
  assert.equal(m.dem("SELECT by_ai AS n FROM audit_logs WHERE action = 'doi_giai_doan' ORDER BY created_at DESC, rowid DESC LIMIT 1"), 1);

  m.fake.setResponses([{ toolCalls: [{ name: "update_lead_stage", input: { lead_id: maiAnh, stage: "khong_theo" } }] }, { text: "x" }]);
  const r = await traLoi(m, "tv1", await hoi(m, "tv1", "Đánh dấu chị Mai Anh không theo"), true);
  assert.match(ketQuaCongCu(r), /Không tìm thấy/);
  assert.equal((m.api.db.prepare("SELECT stage FROM leads WHERE id = ?").get(maiAnh) as any).stage, "dang_ky");
});

test("xếp lớp rồi ghi học phí: quản lý lớp học duyệt thì ghi; số tiền vượt phần còn lại thì báo lỗi", async () => {
  const m = moi();
  const lead = m.id("SELECT id FROM leads WHERE full_name = 'Nguyễn Văn Hưng'");
  const lop = m.id("SELECT id FROM classes WHERE name = 'AI-2611'");
  m.fake.setResponses([{ toolCalls: [{ name: "enroll_lead", input: { lead_id: lead, class_id: lop, payment_plan: "mot_lan" } }] }, { text: "đã xếp" }]);
  await traLoi(m, "ql1", await hoi(m, "ql1", "Xếp anh Hưng vào lớp AI-2611"), true);
  const gd = m.api.db.prepare("SELECT id, total_tuition_vnd FROM enrollments WHERE lead_id = ? AND class_id = ?").get(lead, lop) as { id: string; total_tuition_vnd: number };
  assert.equal(gd.total_tuition_vnd, 12_000_000);

  m.fake.setResponses([{ toolCalls: [{ name: "record_payment", input: { enrollment_id: gd.id, amount_vnd: 99_000_000 } }] }, { text: "lỗi" }]);
  const r = await traLoi(m, "ql1", await hoi(m, "ql1", "Anh Hưng đóng 99 triệu"), true);
  assert.match(ketQuaCongCu(r), /vượt quá/);
  assert.equal(m.dem("SELECT paid_vnd AS n FROM enrollments WHERE id = ?", gd.id), 0);
});

test("ghi chú không cần duyệt và gắn nhãn do AI ghi", async () => {
  const m = moi();
  const id = m.id("SELECT id FROM leads WHERE full_name = 'Lê Quang Huy'");
  m.fake.setResponses([{ toolCalls: [{ name: "add_note", input: { lead_id: id, content: "Khách hẹn gọi lại thứ Hai." } }] }, { text: "Đã ghi chú." }]);
  const c = await hoi(m, "tv1", "Ghi chú: khách hẹn gọi lại thứ Hai");
  assert.equal(c.interrupts.length, 0);
  const a = m.api.db.prepare("SELECT by_ai, content FROM activities WHERE lead_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(id) as { by_ai: number; content: string };
  assert.equal(a.by_ai, 1);
  assert.equal(a.content, "Khách hẹn gọi lại thứ Hai.");
});
