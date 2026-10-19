import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeText } from "@tanstack/ai/testing";
import { khoiTao } from "../../api/src/test-helpers.ts";
import { createAiApp } from "./server.ts";
import { loadSkills, skillIndexPrompt } from "./skills.ts";

/** P11: AGENT.md vào mọi lượt; kỹ năng chỉ nạp nội dung khi AI gọi load_skill. */

function thuMucKyNang(): string {
  const dir = mkdtempSync(join(tmpdir(), "skills-"));
  const them = (ten: string, noiDung: string) => {
    mkdirSync(join(dir, ten));
    writeFileSync(join(dir, ten, "SKILL.md"), noiDung);
  };
  them("tu-van-chon-khoa", "---\nname: tu-van-chon-khoa\ndescription: Dùng khi khách chưa biết chọn khóa nào.\n---\n# Các bước\n1. Hỏi 3 câu.\n2. Gọi list_courses.\nBÍ-MẬT-NỘI-DUNG-KỸ-NĂNG");
  them("hong-thieu-mo-ta", "---\nname: hong-thieu-mo-ta\n---\nkhông có mô tả");
  them("sai-ten", "---\nname: ten-khac\ndescription: tên không khớp thư mục\n---\nx");
  mkdirSync(join(dir, "thu-muc-trong"));
  return dir;
}

test("nạp kỹ năng: chỉ lấy skill hợp lệ; skill hỏng bị bỏ qua, thư mục chưa có thì rỗng", () => {
  const dir = thuMucKyNang();
  const ds = loadSkills(dir);
  assert.deepEqual(ds.map((s) => s.name), ["tu-van-chon-khoa"]);
  assert.match(ds[0].description, /chưa biết chọn khóa/);
  assert.deepEqual(loadSkills(join(dir, "khong-co-thu-muc-nay")), []);
});

test("danh sách kỹ năng trong prompt chỉ có tên và mô tả, KHÔNG có nội dung đầy đủ", () => {
  const p = skillIndexPrompt(loadSkills(thuMucKyNang()));
  assert.match(p, /tu-van-chon-khoa: Dùng khi khách chưa biết chọn khóa nào/);
  assert.ok(!p.includes("BÍ-MẬT-NỘI-DUNG-KỸ-NĂNG"));
  assert.equal(skillIndexPrompt([]), "");
});

function moi(skills = loadSkills(thuMucKyNang())) {
  const api = khoiTao();
  const fake = fakeText();
  const ai = createAiApp({
    apiUrl: "http://api", adapter: () => fake, asksPerHour: 100,
    agentMd: "# Tôi là ai\nTRỢ-LÝ-THỬ-AGENT-MD", skills,
    fetch: async (u, i) => api.app.fetch(new Request(u, i)),
  });
  const hoi = async (text: string) => {
    const res = await ai.request("/chat", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: api.cookieCho("tv1") },
      body: JSON.stringify({ threadId: "t", runId: crypto.randomUUID(), tools: [], context: [], state: {}, forwardedProps: {}, messages: [{ id: "m1", role: "user", content: text }] }),
    });
    return (await res.text()).split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)) as Record<string, any>);
  };
  return { fake, hoi };
}

test("AGENT.md và danh sách kỹ năng vào system prompt mỗi lượt, nội dung kỹ năng thì chưa", async () => {
  const { fake, hoi } = moi();
  const thay: string[] = [];
  fake.setResponses([({ request }) => { thay.push(JSON.stringify(request.systemPrompts)); return { text: "a" }; }, ({ request }) => { thay.push(JSON.stringify(request.systemPrompts)); return { text: "b" }; }]);
  await hoi("lượt 1");
  await hoi("lượt 2");
  for (const sp of thay) {
    assert.match(sp, /TRỢ-LÝ-THỬ-AGENT-MD/);
    assert.match(sp, /tu-van-chon-khoa: Dùng khi khách chưa biết chọn khóa nào/);
    assert.ok(!sp.includes("BÍ-MẬT-NỘI-DUNG-KỸ-NĂNG"));
  }
});

test("AI gọi load_skill: nhận nội dung kỹ năng ở lượt kế tiếp (và chỉ khi đó)", async () => {
  const { fake, hoi } = moi();
  let lanHai = "";
  fake.setResponses([
    { toolCalls: [{ name: "load_skill", input: { name: "tu-van-chon-khoa" } }] },
    ({ request }) => { lanHai = JSON.stringify(request.messages); return { text: "Em hỏi anh 3 câu nhé." }; },
  ]);
  const ev = await hoi("Em chưa biết nên học khóa nào");
  const kq = JSON.parse(ev.find((e) => e.type === "TOOL_CALL_RESULT")!.content);
  assert.equal(kq.found, true);
  assert.match(kq.huong_dan, /BÍ-MẬT-NỘI-DUNG-KỸ-NĂNG/);
  assert.match(lanHai, /BÍ-MẬT-NỘI-DUNG-KỸ-NĂNG/);
});

test("load_skill với tên không có: báo lỗi kèm danh sách kỹ năng hiện có, không sập", async () => {
  const { fake, hoi } = moi();
  fake.setResponses([{ toolCalls: [{ name: "load_skill", input: { name: "khong-co" } }] }, { text: "ok" }]);
  const ev = await hoi("x");
  const kq = JSON.parse(ev.find((e) => e.type === "TOOL_CALL_RESULT")!.content);
  assert.equal(kq.found, false);
  assert.match(kq.message, /tu-van-chon-khoa/);
});

test("chưa có kỹ năng nào: vẫn chạy, prompt không có mục kỹ năng", async () => {
  const { fake, hoi } = moi([]);
  let sp = "";
  fake.setResponses([({ request }) => { sp = JSON.stringify(request.systemPrompts); return { text: "a" }; }]);
  await hoi("xin chào");
  assert.match(sp, /TRỢ-LÝ-THỬ-AGENT-MD/);
  assert.ok(!sp.includes("Các kỹ năng có sẵn"));
});
