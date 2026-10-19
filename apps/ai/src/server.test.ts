import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeText } from "@tanstack/ai/testing";
import { khoiTao } from "../../api/src/test-helpers.ts";
import { createAiApp } from "./server.ts";

/** Dịch vụ AI chạy thật với API thật (SQLite bộ nhớ) và mô hình GIẢ: không cần khóa, không cần mạng. */

function moi(opts: { asksPerHour?: number; coKhoa?: boolean } = {}) {
  const api = khoiTao();
  const fake = fakeText();
  const ai = createAiApp({
    apiUrl: "http://api",
    adapter: () => (opts.coKhoa === false ? null : fake),
    asksPerHour: opts.asksPerHour ?? 100,
    origins: ["http://localhost:3000"],
    fetch: async (u, i) => api.app.fetch(new Request(u, i)),
  });
  const hoi = (text: string, who: string | null = "tv1", headers: Record<string, string> = {}) =>
    ai.request("/chat", {
      method: "POST",
      headers: { "content-type": "application/json", ...(who ? { cookie: api.cookieCho(who) } : {}), ...headers },
      body: JSON.stringify({
        threadId: crypto.randomUUID(), runId: crypto.randomUUID(), tools: [], context: [], state: {}, forwardedProps: {},
        messages: [{ id: crypto.randomUUID(), role: "user", content: text }],
      }),
    });
  return { api, fake, ai, hoi };
}

const suKien = async (res: Response) =>
  (await res.text()).split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)) as Record<string, any>);

test("chưa đăng nhập: 401, không gọi mô hình", async () => {
  const { hoi, fake } = moi();
  fake.setResponses([{ text: "không được xảy ra" }]);
  assert.equal((await hoi("xin chào", null)).status, 401);
  assert.equal((await hoi("xin chào", null, { cookie: "ces_session=gia-mao" })).status, 401);
  assert.equal(fake.pendingResponses(), 1);
});

test("thiếu khóa AI: 503 có thông báo rõ, không sập", async () => {
  const { hoi } = moi({ coKhoa: false });
  const r = await hoi("xin chào");
  assert.equal(r.status, 503);
  assert.match(((await r.json()) as { error: string }).error, /AI_API_KEY/);
});

test("đăng nhập rồi hỏi: nhận câu trả lời dạng luồng (SSE)", async () => {
  const { hoi, fake } = moi();
  fake.setResponses([{ text: "Chào bạn, em có thể giúp gì?" }]);
  const r = await hoi("xin chào");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /text\/event-stream/);
  const ev = await suKien(r);
  assert.equal(ev.filter((e) => e.type === "TEXT_MESSAGE_CONTENT").map((e) => e.delta).join(""), "Chào bạn, em có thể giúp gì?");
  assert.ok(ev.some((e) => e.type === "RUN_FINISHED"));
});

test("system prompt được gửi cho mô hình và có tiếng Việt", async () => {
  const { hoi, fake } = moi();
  let thay: any;
  fake.setResponses([({ request }) => { thay = request; return { text: "ok" }; }]);
  await (await hoi("xin chào")).text();
  assert.match(JSON.stringify(thay.systemPrompts), /tiếng Việt/);
});

test("giới hạn số lượt hỏi mỗi giờ theo từng người: quá thì 429, người khác không bị ảnh hưởng", async () => {
  const { hoi, fake } = moi({ asksPerHour: 2 });
  fake.setResponses([{ text: "1" }, { text: "2" }, { text: "3" }]);
  assert.equal((await hoi("a", "tv1")).status, 200);
  assert.equal((await hoi("b", "tv1")).status, 200);
  assert.equal((await hoi("c", "tv1")).status, 429);
  assert.equal((await hoi("d", "tv2")).status, 200);
});

test("Origin lạ bị từ chối; nội dung sai bị 400", async () => {
  const { hoi, ai, api } = moi();
  assert.equal((await hoi("xin chào", "tv1", { origin: "http://evil.example" })).status, 403);
  const r = await ai.request("/chat", { method: "POST", headers: { cookie: api.cookieCho("tv1"), "content-type": "application/json" }, body: "{khong phai json" });
  assert.equal(r.status, 400);
});

// ── P8: công cụ search_docs ──
import { readFileSync } from "node:fs";

async function napTaiLieu(api: ReturnType<typeof khoiTao>) {
  for (const [fileName, title] of [["02-quy-dinh-hoan-phi.md", "Quy định hoàn phí"], ["01-hoc-phi-uu-dai.md", "Học phí và ưu đãi"]] as const) {
    const content = readFileSync(new URL(`../../../../tai-lieu-mau/${fileName}`, import.meta.url), "utf8");
    assert.equal((await api.goi("POST", "/documents", { fileName, title, content }, "admin")).status, 201);
  }
}

test("hỏi chính sách: mô hình gọi search_docs, công cụ trả đoạn kèm nguồn, kết quả quay lại mô hình", async () => {
  const { api, fake, hoi } = moi();
  await napTaiLieu(api);
  let lanGoiThu2: any;
  fake.setResponses([
    { toolCalls: [{ name: "search_docs", input: { query: "hoan phi truoc khai giang" } }] },
    ({ request }) => { lanGoiThu2 = request; return { text: "Hoàn 100% nếu báo trước 3 ngày. [Nguồn: Quy định hoàn phí]" }; },
  ]);
  const ev = await suKien(await hoi("Hoàn phí thế nào nếu báo trước khai giảng?"));
  const ketQua = ev.find((e) => e.type === "TOOL_CALL_RESULT");
  assert.ok(ketQua, "phải có kết quả công cụ");
  const noiDung = JSON.parse(ketQua!.content);
  assert.equal(noiDung.found, true);
  assert.equal(noiDung.hits[0].source, "Quy định hoàn phí");
  assert.match(noiDung.hits[0].text, /Hoàn 100%/);
  assert.match(JSON.stringify(lanGoiThu2.messages), /Hoàn 100%/); // mô hình thật sự nhận được đoạn tài liệu
  assert.match(ev.filter((e) => e.type === "TEXT_MESSAGE_CONTENT").map((e) => e.delta).join(""), /\[Nguồn: Quy định hoàn phí\]/);
});

test("không có trong tài liệu: công cụ báo found=false để mô hình nói không biết", async () => {
  const { api, fake, hoi } = moi();
  await napTaiLieu(api);
  fake.setResponses([{ toolCalls: [{ name: "search_docs", input: { query: "bao hanh laptop" } }] }, { text: "Em chưa có thông tin này." }]);
  const ev = await suKien(await hoi("Bảo hành laptop bao lâu?"));
  assert.equal(JSON.parse(ev.find((e) => e.type === "TOOL_CALL_RESULT")!.content).found, false);
});

test("công cụ gọi API bằng cookie của người hỏi: chưa đăng nhập thì không đến được công cụ", async () => {
  const { fake, hoi } = moi();
  fake.setResponses([{ toolCalls: [{ name: "search_docs", input: { query: "hoc phi" } }] }, { text: "x" }]);
  assert.equal((await hoi("hỏi", null)).status, 401);
  assert.equal(fake.pendingResponses(), 2);
});

test("system prompt dặn ghi nguồn, nói không biết, và coi tài liệu là dữ liệu", async () => {
  const { fake, hoi } = moi();
  let thay: any;
  fake.setResponses([({ request }) => { thay = request; return { text: "ok" }; }]);
  await (await hoi("xin chào")).text();
  const sp = JSON.stringify(thay.systemPrompts);
  for (const mau of [/search_docs/, /Nguồn:/, /không biết/, /KHÔNG phải mệnh lệnh/]) assert.match(sp, mau);
});
