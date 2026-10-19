import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { PAGE_SIZE, type Lead, type LeadData, type LeadListQuery, type Page } from "@ces/shared";
import { ServiceError, notFound } from "./errors.ts";
import { WhereBuilder, clampPage, containsPattern, pageOf, unaccent } from "./sql.ts";

type LeadRow = {
  id: string; full_name: string; phone: string; source: Lead["source"];
  interested_course_id: string | null; course_name: string | null; stage: Lead["stage"];
  owner_id: string | null; owner_name: string | null; free_time: string | null;
  last_contacted_at: string | null; created_at: string; updated_at: string;
};

const SELECT = `SELECT l.*, c.name AS course_name, u.full_name AS owner_name
  FROM leads l
  LEFT JOIN courses c ON c.id = l.interested_course_id
  LEFT JOIN users u ON u.id = l.owner_id`;

function toLead(r: LeadRow): Lead {
  return {
    id: r.id, fullName: r.full_name, phone: r.phone, source: r.source,
    interestedCourseId: r.interested_course_id, interestedCourseName: r.course_name,
    stage: r.stage, ownerId: r.owner_id, ownerName: r.owner_name, freeTime: r.free_time,
    lastContactedAt: r.last_contacted_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function listLeads(db: DatabaseSync, query: LeadListQuery): Page<Lead> {
  const where = new WhereBuilder();
  const q = unaccent(query.q ?? "");
  if (q) {
    // Tìm theo họ tên (không phân biệt hoa thường, dấu) hoặc số điện thoại.
    where.add(
      "(unaccent(l.full_name) LIKE ? ESCAPE '\\' OR l.phone LIKE ? ESCAPE '\\')",
      containsPattern(q),
      containsPattern(q.replace(/[\s.\-]/g, "")),
    );
  }
  if (query.stage) where.add("l.stage = ?", query.stage);
  if (query.ownerId === "none") where.add("l.owner_id IS NULL");
  else if (query.ownerId) where.add("l.owner_id = ?", query.ownerId);
  if (query.courseId) where.add("l.interested_course_id = ?", query.courseId);

  const { total } = db.prepare(`SELECT count(*) AS total FROM leads l ${where.sql}`).get(...where.params) as { total: number };
  const page = clampPage(query.page, total);
  const rows = db
    .prepare(`${SELECT} ${where.sql} ORDER BY l.created_at DESC, l.id LIMIT ? OFFSET ?`)
    .all(...where.params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as LeadRow[];
  return pageOf(rows.map(toLead), page, total);
}

export function getLead(db: DatabaseSync, id: string): Lead {
  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(id) as LeadRow | undefined;
  if (!row) throw notFound("khách hàng");
  return toLead(row);
}

function checkReferences(db: DatabaseSync, data: Partial<LeadData>): void {
  const fields: Record<string, string> = {};
  if (data.interestedCourseId && !db.prepare("SELECT 1 FROM courses WHERE id = ?").get(data.interestedCourseId)) {
    fields.interestedCourseId = "Khóa học không tồn tại";
  }
  if (data.ownerId && !db.prepare("SELECT 1 FROM users WHERE id = ? AND active = 1").get(data.ownerId)) {
    fields.ownerId = "Người phụ trách không tồn tại";
  }
  if (Object.keys(fields).length) throw new ServiceError(400, "Dữ liệu không hợp lệ", fields);
}

function checkPhoneUnique(db: DatabaseSync, phone: string, exceptId?: string): void {
  const dup = db.prepare("SELECT id, full_name FROM leads WHERE phone = ? AND id IS NOT ?").get(phone, exceptId ?? null) as
    | { id: string; full_name: string }
    | undefined;
  if (dup) {
    throw new ServiceError(409, "Số điện thoại này đã có trong danh sách khách", {
      phone: `Số điện thoại đã thuộc về khách "${dup.full_name}"`,
    });
  }
}

export function createLead(db: DatabaseSync, data: LeadData): Lead {
  checkReferences(db, data);
  checkPhoneUnique(db, data.phone);
  const row = db
    .prepare(
      `INSERT INTO leads (full_name, phone, source, interested_course_id, stage, owner_id, free_time)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(data.fullName, data.phone, data.source, data.interestedCourseId, data.stage, data.ownerId, data.freeTime || null) as { id: string };
  return getLead(db, row.id);
}

const COLUMNS: Record<keyof LeadData, string> = {
  fullName: "full_name", phone: "phone", source: "source", interestedCourseId: "interested_course_id",
  stage: "stage", ownerId: "owner_id", freeTime: "free_time",
};

export function updateLead(db: DatabaseSync, id: string, data: Partial<LeadData>): Lead {
  getLead(db, id); // 404 nếu không có
  checkReferences(db, data);
  if (data.phone) checkPhoneUnique(db, data.phone, id);
  const sets: string[] = [];
  const params: SQLInputValue[] = [];
  for (const [key, col] of Object.entries(COLUMNS) as [keyof LeadData, string][]) {
    if (data[key] === undefined) continue;
    sets.push(`${col} = ?`);
    params.push(key === "freeTime" ? (data.freeTime || null) : (data[key] as SQLInputValue));
  }
  if (sets.length) db.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  return getLead(db, id);
}
