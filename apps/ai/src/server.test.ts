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
