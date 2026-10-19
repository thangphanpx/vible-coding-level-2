import type { DatabaseSync } from "node:sqlite";
import type { Lookups, Role } from "@ces/shared";

/** Danh sách rút gọn để đổ vào các ô chọn trên web. */
export function getLookups(db: DatabaseSync): Lookups {
  const users = db.prepare("SELECT id, full_name, role FROM users WHERE active = 1 ORDER BY full_name").all() as {
    id: string; full_name: string; role: Role;
  }[];
  const courses = db.prepare("SELECT id, name FROM courses ORDER BY name").all() as { id: string; name: string }[];
  const leads = db.prepare("SELECT id, full_name FROM leads ORDER BY full_name").all() as { id: string; full_name: string }[];
  return {
    users: users.map((u) => ({ id: u.id, fullName: u.full_name, role: u.role })),
    courses,
    leads: leads.map((l) => ({ id: l.id, fullName: l.full_name })),
  };
}
