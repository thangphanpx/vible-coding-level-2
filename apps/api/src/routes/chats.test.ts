import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChatMessage } from "@ces/shared";
import { khoiTao } from "../test-helpers.ts";

/** Lịch sử chat với trợ lý AI (P7): riêng từng người, gắn với khách nếu có, tôn trọng phạm vi khách. */

const cap = (content: string) => [{ role: "user", content }, { role: "assistant", content: `Trả lời: ${content}` }];

test("lưu rồi đọc lại đúng thứ tự; chưa đăng nhập 401", async () => {
  const { goi } = khoiTao();
  assert.equal((await goi("GET", "/chats", undefined, null)).status, 401);
  assert.equal((await goi("POST", "/chats", { messages: cap("một") }, "tv1")).status, 201);
  await goi("POST", "/chats", { messages: cap("hai") }, "tv1");
  const r = await goi<ChatMessage[]>("GET", "/chats", undefined, "tv1");
  assert.deepEqual(r.data.map((m) => m.content), ["một", "Trả lời: một", "hai", "Trả lời: hai"]);
});

test("lịch sử riêng từng người: người khác không đọc, không xóa được", async () => {
  const { goi } = khoiTao();
  await goi("POST", "/chats", { messages: cap("bí mật của tv1") }, "tv1");
  assert.equal((await goi<ChatMessage[]>("GET", "/chats", undefined, "tv2")).data.length, 0);
  assert.equal((await goi<ChatMessage[]>("GET", "/chats", undefined, "admin")).data.length, 0);
  await goi("DELETE", "/chats", undefined, "tv2");
  assert.equal((await goi<ChatMessage[]>("GET", "/chats", undefined, "tv1")).data.length, 2);
  assert.equal((await goi("DELETE", "/chats", undefined, "tv1")).status, 204);
  assert.equal((await goi<ChatMessage[]>("GET", "/chats", undefined, "tv1")).data.length, 0);
});

test("chat gắn với khách: tách khỏi chat chung; khách ngoài phạm vi thì 404", async () => {
  const { goi, db } = khoiTao();
  const khachCuaTv1 = (db.prepare("SELECT id FROM leads WHERE full_name = 'Lê Quang Huy'").get() as { id: string }).id;
  await goi("POST", "/chats", { leadId: khachCuaTv1, messages: cap("về khách") }, "tv1");
  await goi("POST", "/chats", { messages: cap("chat chung") }, "tv1");
  const rieng = await goi<ChatMessage[]>("GET", `/chats?leadId=${khachCuaTv1}`, undefined, "tv1");
  assert.deepEqual(rieng.data.map((m) => m.content), ["về khách", "Trả lời: về khách"]);
  assert.equal((await goi<ChatMessage[]>("GET", "/chats", undefined, "tv1")).data.length, 2);
  // tv2 không được thấy khách này: không đọc, không ghi được
  assert.equal((await goi("GET", `/chats?leadId=${khachCuaTv1}`, undefined, "tv2")).status, 404);
  assert.equal((await goi("POST", "/chats", { leadId: khachCuaTv1, messages: cap("x") }, "tv2")).status, 404);
});

test("dữ liệu sai: 400; chỉ trả 60 tin gần nhất", async () => {
  const { goi } = khoiTao();
  assert.equal((await goi("POST", "/chats", { messages: [{ role: "system", content: "x" }] }, "tv1")).status, 400);
  assert.equal((await goi("POST", "/chats", { messages: [{ role: "user", content: "   " }] }, "tv1")).status, 400);
  assert.equal((await goi("POST", "/chats", { messages: [] }, "tv1")).status, 400);
  for (let i = 0; i < 8; i++) await goi("POST", "/chats", { messages: Array.from({ length: 10 }, (_, j) => ({ role: "user", content: `m${i * 10 + j}` })) }, "tv1");
  const r = await goi<ChatMessage[]>("GET", "/chats", undefined, "tv1");
  assert.equal(r.data.length, 60);
  assert.equal(r.data.at(-1)!.content, "m79");
  assert.equal(r.data[0].content, "m20");
});
