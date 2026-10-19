import { test } from "node:test";
import assert from "node:assert/strict";
import type { Activity, Lead } from "@ces/shared";
import { KHOA_DICH_VU_THU, khoiTao } from "../test-helpers.ts";

/** Khóa dịch vụ AI (P10): chỉ để GẮN NHÃN "do AI làm", không cấp thêm quyền, không thay cookie. */

const CO_KHOA = { "x-ai-service-key": KHOA_DICH_VU_THU };

function moi() {
  const t = khoiTao();
  const khachCuaTv1 = (t.db.prepare("SELECT id FROM leads WHERE full_name = 'Lê Quang Huy'").get() as { id: string }).id;
  const nhatKyCuoi = () => ({ ...(t.db.prepare("SELECT action, by_ai FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1").get() as { action: string; by_ai: number }) });
  return { ...t, khachCuaTv1, nhatKyCuoi };
}

test("có khóa dịch vụ đúng: nhật ký và ghi chú mang nhãn do AI; không khóa hoặc sai khóa: không nhãn", async () => {
  const { goi, khachCuaTv1, nhatKyCuoi } = moi();
  const ghi = (headers?: Record<string, string>) => goi<Activity>("POST", `/leads/${khachCuaTv1}/activities`, { type: "ghi_chu", content: "Ghi chú thử" }, "tv1", headers);

  const ai = await ghi(CO_KHOA);
  assert.equal(ai.status, 201);
  assert.equal(ai.data.byAi, true);
  assert.deepEqual(nhatKyCuoi(), { action: "them_hoat_dong", by_ai: 1 });

  for (const h of [undefined, { "x-ai-service-key": "sai-khoa-sai-khoa-sai" }, { "x-ai-service-key": "" }]) {
    const r = await ghi(h);
    assert.equal(r.data.byAi, false);
    assert.equal(nhatKyCuoi().by_ai, 0);
  }

  // Sửa khách qua dịch vụ AI cũng gắn nhãn
  const doi = await goi<Lead>("PATCH", `/leads/${khachCuaTv1}`, { stage: "hen_tu_van" }, "tv1", CO_KHOA);
  assert.equal(doi.status, 200);
  assert.deepEqual(nhatKyCuoi(), { action: "doi_giai_doan", by_ai: 1 });
});

test("khóa dịch vụ KHÔNG thay cookie: không cookie thì 401 dù có khóa", async () => {
  const { goi } = moi();
  assert.equal((await goi("GET", "/leads", undefined, null, CO_KHOA)).status, 401);
  assert.equal((await goi("POST", "/leads", {}, null, CO_KHOA)).status, 401);
});

test("khóa dịch vụ KHÔNG cấp thêm quyền: tư vấn viên vẫn không đổi người phụ trách, không xem lớp, không nạp tài liệu", async () => {
  const { goi, khachCuaTv1 } = moi();
  const tv2 = (await goi("GET", "/lookups", undefined, "ts")).data.users.find((u: any) => u.fullName === "Phạm Thị Lan").id;
  assert.equal((await goi("PATCH", `/leads/${khachCuaTv1}`, { ownerId: tv2 }, "tv1", CO_KHOA)).status, 403);
  assert.equal((await goi("GET", "/classes", undefined, "tv1", CO_KHOA)).status, 403);
  assert.equal((await goi("POST", "/documents", { fileName: "a.md", content: "x" }, "tv1", CO_KHOA)).status, 403);
  // và vẫn không thấy khách của người khác
  const khachTv2 = (await goi("GET", "/leads?q=Mai Anh", undefined, "ts")).data.items[0].id;
  assert.equal((await goi("GET", `/leads/${khachTv2}`, undefined, "tv1", CO_KHOA)).status, 404);
});

test("API không bật khóa dịch vụ (cấu hình trống): không bao giờ gắn nhãn", async () => {
  const t = moi();
  t.config.aiServiceKey = null;
  const r = await t.goi<Activity>("POST", `/leads/${t.khachCuaTv1}/activities`, { type: "ghi_chu", content: "x" }, "tv1", CO_KHOA);
  assert.equal(r.data.byAi, false);
});
