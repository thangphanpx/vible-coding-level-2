import type { DatabaseSync } from "node:sqlite";
import type { Lookups, Role } from "@ces/shared";
import { leadScope, type Actor } from "./scope.ts";

/**
 * Danh sách rút gọn để đổ vào các ô chọn trên web, đã lọc theo vai trò:
 * - khách: chỉ khách trong phạm vi của người dùng (không lộ tên khách ngoài phạm vi);
 * - người dùng: Tư vấn viên chỉ thấy chính mình; vai trò khác thấy tên và vai trò của mọi người đang hoạt động (không có email).
 */
export function getLookups(db: DatabaseSync, actor: Actor): Lookups {
  const allUsers = db.prepare("SELECT id, full_name, role FROM users WHERE active = 1 ORDER BY full_name").all() as {
    id: string; full_name: string; role: Role;
  }[];
  const users = actor.role === "tu_van_vien" ? allUsers.filter((u) => u.id === actor.id) : allUsers;
  const courses = db.prepare("SELECT id, name FROM courses ORDER BY name").all() as { id: string; name: string }[];
  const scope = leadScope(actor, "l");
  const leads = db.prepare(`SELECT l.id, l.full_name FROM leads l WHERE ${scope.sql} ORDER BY l.full_name`).all(...scope.params) as {
    id: string; full_name: string;
  }[];
  return {
    users: users.map((u) => ({ id: u.id, fullName: u.full_name, role: u.role })),
    courses,
    leads: leads.map((l) => ({ id: l.id, fullName: l.full_name })),
  };
}
