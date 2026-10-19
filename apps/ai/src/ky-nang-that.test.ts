import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_LABELS } from "@ces/contracts";
import { loadSkills } from "./skills.ts";

/** Kiểm các kỹ năng THẬT trong apps/ai/skills/ (P12): đúng khuôn, và chỉ nhắc công cụ đang có. */

const skills = loadSkills(new URL("../skills/", import.meta.url));
const congCu = Object.keys(TOOL_LABELS);

test("có ít nhất 2 kỹ năng hợp lệ, tên không dấu, mô tả nói rõ khi nào dùng", () => {
  assert.ok(skills.length >= 2);
  for (const s of skills) {
    assert.match(s.name, /^[a-z0-9-]+$/);
    assert.match(s.description, /^Dùng khi/);
  }
});

test("mỗi kỹ năng có đủ các mục của mẫu skill", () => {
  for (const s of skills) {
    for (const muc of ["# Mục tiêu", "# Các bước", "# Mẫu câu nên dùng", "# Lưu ý", "# Ví dụ tốt", "# Ví dụ không tốt"]) {
      assert.ok(s.body.includes(muc), `${s.name} thiếu mục ${muc}`);
    }
  }
});

test("kỹ năng chỉ nhắc tới công cụ đang có (không bịa tên công cụ)", () => {
  for (const s of skills) {
    const nhac = [...s.body.matchAll(/`([a-z]+_[a-z_]+)`/g)].map((m) => m[1]);
    assert.ok(nhac.length > 0, `${s.name} không nhắc công cụ nào`);
    for (const t of nhac) {
      // loại giá trị liệt kê (ví dụ loại việc nhac_hoc_phi) khỏi tên công cụ
      if (["nhac_hoc_phi", "nhac_buoi_hoc", "danh_gia_cuoi_khoa"].includes(t)) continue;
      assert.ok(congCu.includes(t), `${s.name} nhắc công cụ không có: ${t}`);
    }
  }
});
