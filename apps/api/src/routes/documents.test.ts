import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import type { Doc, DocHit } from "@ces/shared";
import { chunkText } from "../services/documents.ts";
import { khoiTao } from "../test-helpers.ts";

/** Kho tri thức (P8): nạp tài liệu thật trong tai-lieu-mau/, cắt đoạn, tìm không dấu, phân quyền, nhật ký. */

const THU_MUC = new URL("../../../../../tai-lieu-mau/", import.meta.url);
const tep = readdirSync(THU_MUC).filter((f) => f.endsWith(".md")).sort();

async function napTatCa() {
  const t = khoiTao();
  for (const f of tep) {
    const r = await t.goi("POST", "/documents", { fileName: f, title: f.replace(/^\d+-|\.md$/g, "").replace(/-/g, " "), content: readFileSync(new URL(f, THU_MUC), "utf8") }, "admin");
    assert.equal(r.status, 201, f);
  }
  return t;
}
const tim = async (t: Awaited<ReturnType<typeof napTatCa>>, q: string, who = "tv1") =>
  (await t.goi<DocHit[]>("GET", `/documents/search?q=${encodeURIComponent(q)}`, undefined, who)).data;

test("cắt đoạn theo tiêu đề, giữ tiêu đề cho từng đoạn; mục dài được cắt tiếp", () => {
  const c = chunkText("Mở đầu\n\n# Học phí\nAI: 12 triệu.\n\n# Hoàn phí\nBáo trước 3 ngày.");
  assert.deepEqual(c.map((x) => x.heading), [null, "Học phí", "Hoàn phí"]);
  const dai = chunkText(`# Dài\n${Array.from({ length: 30 }, (_, i) => `Đoạn số ${i} ${"x".repeat(100)}`).join("\n\n")}`);
  assert.ok(dai.length > 1);
  assert.ok(dai.every((x) => x.heading === "Dài" && x.content.length <= 1300));
});

test("nạp 4 tài liệu mẫu: có đoạn, ghi nhật ký; chỉ Admin nạp và xóa", async () => {
  const t = await napTatCa();
  const ds = (await t.goi<Doc[]>("GET", "/documents", undefined, "tv1")).data;
  assert.equal(ds.length, 4);
  assert.ok(ds.every((d) => d.chunkCount >= 2));
  const body = { fileName: "x.md", content: "# A\nnội dung" };
  for (const who of ["ts", "tv1", "ql1"]) assert.equal((await t.goi("POST", "/documents", body, who)).status, 403, who);
  assert.equal((await t.goi("DELETE", `/documents/${ds[0].id}`, undefined, "ql1")).status, 403);
  assert.equal(t.db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'nap_tai_lieu'").get()!.n, 4);
});

test("tệp sai định dạng, trống hoặc quá dài bị từ chối", async () => {
  const t = khoiTao();
  for (const body of [{ fileName: "a.exe", content: "x" }, { fileName: "a.md", content: "   " }, { fileName: "a.md", content: "x".repeat(300_001) }]) {
    assert.equal((await t.goi("POST", "/documents", body, "admin")).status, 400);
  }
});

test("tìm có dấu và không dấu ra cùng kết quả, kể cả chữ đ; có nguồn để trích dẫn", async () => {
  const t = await napTatCa();
  const a = await tim(t, "học phí trả góp");
  const b = await tim(t, "hoc phi tra gop");
  assert.ok(a.length > 0);
  assert.deepEqual(a.map((h) => h.content), b.map((h) => h.content));
  assert.match(a[0].content, /đợt|đóng/i);
  assert.ok(a[0].source.length > 0);
  const c = await tim(t, "đánh giá cuối khóa");
  const d = await tim(t, "danh gia cuoi khoa");
  assert.ok(c.length > 0 && c.map((h) => h.content).join() === d.map((h) => h.content).join());
  assert.match(c[0].content, /phiếu đánh giá/i);
});

test("xếp hạng: câu hỏi hoàn phí ra đoạn hoàn phí trước; câu không liên quan thì không có kết quả", async () => {
  const t = await napTatCa();
  const r = await tim(t, "hoan phi truoc khai giang");
  assert.match(r[0].content, /Hoàn 100%/);
  assert.deepEqual(await tim(t, "zzzqqq"), []);
  assert.deepEqual(await tim(t, "???"), []);
});

test("câu có ký tự đặc biệt của FTS không làm lỗi (dấu ngoặc, dấu nháy, AND/OR/NOT)", async () => {
  const t = await napTatCa();
  for (const q of ['"học phí"', "học phí OR (", "học* NOT phí", "a'b", "học phí -- ;", "NEAR(học phí)"]) {
    const r = await t.goi("GET", `/documents/search?q=${encodeURIComponent(q)}`, undefined, "tv1");
    assert.equal(r.status, 200, q);
  }
});

test("xóa tài liệu xóa luôn các đoạn và chỉ mục tìm kiếm", async () => {
  const t = await napTatCa();
  const ds = (await t.goi<Doc[]>("GET", "/documents", undefined, "admin")).data;
  const hoanPhi = ds.find((d) => /hoan phi/i.test(d.title))!;
  assert.equal((await t.goi("DELETE", `/documents/${hoanPhi.id}`, undefined, "admin")).status, 204);
  assert.equal((await tim(t, "hoan phi truoc khai giang")).filter((h) => h.documentId === hoanPhi.id).length, 0);
  assert.equal(t.db.prepare("SELECT count(*) AS n FROM chunk_fts").get()!.n, t.db.prepare("SELECT count(*) AS n FROM document_chunks").get()!.n);
  assert.equal((await t.goi("DELETE", `/documents/${hoanPhi.id}`, undefined, "admin")).status, 404);
});

test("chưa đăng nhập: 401", async () => {
  const t = khoiTao();
  assert.equal((await t.goi("GET", "/documents", undefined, null)).status, 401);
  assert.equal((await t.goi("GET", "/documents/search?q=hoc", undefined, null)).status, 401);
});
