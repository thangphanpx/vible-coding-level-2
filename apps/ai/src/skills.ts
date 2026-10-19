import { existsSync, readFileSync, readdirSync } from "node:fs";

export type Skill = { name: string; description: string; body: string };

/** Tách phần đầu (frontmatter) dạng "name: ..." và "description: ..." giữa hai dòng --- ra khỏi nội dung. */
function parseSkill(text: string, folder: string): Skill | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text.trim());
  if (!m) return null;
  const field = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(m[1])?.[1].trim();
  const name = field("name");
  const description = field("description");
  // Tên phải trùng tên thư mục: tránh nạp nhầm khi sao chép skill.
  if (!name || !description || name !== folder) return null;
  return { name, description, body: m[2].trim() };
}

/**
 * Đọc mọi skills/<tên>/SKILL.md. Skill hỏng (thiếu tên, mô tả, sai tên thư mục) bị bỏ qua và báo ra console,
 * không làm sập dịch vụ. Thư mục chưa có thì trả danh sách rỗng.
 */
export function loadSkills(dir: URL | string): Skill[] {
  if (!existsSync(dir)) return [];
  const out: Skill[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = new URL(`${entry.name}/SKILL.md`, dir instanceof URL ? dir : `file:///${String(dir).replace(/\\/g, "/")}/`);
    if (!existsSync(file)) continue;
    const skill = parseSkill(readFileSync(file, "utf8"), entry.name);
    if (skill) out.push(skill);
    else console.warn(`Bỏ qua kỹ năng "${entry.name}": SKILL.md thiếu name/description hoặc name khác tên thư mục.`);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Đoạn system prompt liệt kê các kỹ năng (chỉ tên và mô tả; nội dung đầy đủ chỉ nạp khi AI gọi load_skill). */
export function skillIndexPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";
  return [
    "Các kỹ năng có sẵn (chỉ nạp nội dung khi cần, bằng công cụ load_skill):",
    ...skills.map((s) => `- ${s.name}: ${s.description}`),
  ].join("\n");
}
