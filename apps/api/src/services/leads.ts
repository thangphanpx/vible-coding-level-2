import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { PAGE_SIZE, STAGE_LABELS, canAssignLead, canCreateLead, canEditLead, type Lead, type LeadData, type LeadListQuery, type Page } from "@ces/shared";
import { inTransaction, writeAudit } from "./audit.ts";
import { ServiceError, forbidden, notFound } from "./errors.ts";
import { leadScope, type Actor } from "./scope.ts";
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

/** Đọc một khách KHÔNG kiểm phạm vi (chỉ dùng nội bộ sau khi đã kiểm quyền). */
function loadLead(db: DatabaseSync, id: string): LeadRow | undefined {
  return db.prepare(`${SELECT} WHERE l.id = ?`).get(id) as LeadRow | undefined;
}

/** Đọc một khách trong phạm vi của người dùng; ngoài phạm vi thì 404 (như không tồn tại). */
function loadVisibleLead(db: DatabaseSync, actor: Actor, id: string): LeadRow {
  const scope = leadScope(actor, "l");
  const row = db.prepare(`${SELECT} WHERE l.id = ? AND ${scope.sql}`).get(id, ...scope.params) as LeadRow | undefined;
  if (!row) throw notFound("khách hàng");
  return row;
}

export function listLeads(db: DatabaseSync, actor: Actor, query: LeadListQuery): Page<Lead> {
  const where = new WhereBuilder();
  // Phạm vi theo vai trò luôn được nối bằng AND với mọi bộ lọc người dùng chọn.
  const scope = leadScope(actor, "l");
  where.add(scope.sql, ...scope.params);
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

export function getLead(db: DatabaseSync, actor: Actor, id: string): Lead {
  return toLead(loadVisibleLead(db, actor, id));
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

/** Báo trùng số điện thoại. Chỉ nêu tên khách trùng khi người thêm được phép thấy khách đó (không lộ khách ngoài phạm vi). */
function checkPhoneUnique(db: DatabaseSync, actor: Actor, phone: string, exceptId?: string): void {
  const dup = db.prepare("SELECT id, full_name FROM leads WHERE phone = ? AND id IS NOT ?").get(phone, exceptId ?? null) as
    | { id: string; full_name: string }
    | undefined;
  if (!dup) return;
  const scope = leadScope(actor, "l");
  const seen = db.prepare(`SELECT 1 FROM leads l WHERE l.id = ? AND ${scope.sql}`).get(dup.id, ...scope.params);
  throw new ServiceError(409, "Số điện thoại này đã có trong danh sách khách", {
    phone: seen ? `Số điện thoại đã thuộc về khách "${dup.full_name}"` : "Số điện thoại này đã có trong danh sách khách",
  });
}

export function createLead(db: DatabaseSync, actor: Actor, data: LeadData): Lead {
  if (!canCreateLead(actor.role)) throw forbidden("Vai trò của bạn không được thêm khách tiềm năng");
  if (!canAssignLead(actor.role)) {
    // Tư vấn viên: khách thêm vào luôn do chính mình phụ trách (bỏ trống = chính mình).
    if (data.ownerId && data.ownerId !== actor.id) throw forbidden("Bạn chỉ được thêm khách do chính mình phụ trách");
    data = { ...data, ownerId: actor.id };
  }
  checkReferences(db, data);
  checkPhoneUnique(db, actor, data.phone);
  return inTransaction(db, () => {
    const row = db
      .prepare(
        `INSERT INTO leads (full_name, phone, source, interested_course_id, stage, owner_id, free_time)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(data.fullName, data.phone, data.source, data.interestedCourseId, data.stage, data.ownerId, data.freeTime || null) as { id: string };
    const created = loadLead(db, row.id)!;
    writeAudit(db, actor, {
      action: "tao_khach", entityType: "leads", entityId: created.id,
      detail: `Thêm khách ${created.full_name} (giai đoạn ${STAGE_LABELS[created.stage]}, phụ trách: ${created.owner_name ?? "chưa giao"})`,
    });
    return toLead(created);
  });
}

const COLUMNS: Record<keyof LeadData, string> = {
  fullName: "full_name", phone: "phone", source: "source", interestedCourseId: "interested_course_id",
  stage: "stage", ownerId: "owner_id", freeTime: "free_time",
};
const FIELD_LABELS: Record<keyof LeadData, string> = {
  fullName: "họ tên", phone: "số điện thoại", source: "nguồn", interestedCourseId: "khóa quan tâm",
  stage: "giai đoạn", ownerId: "người phụ trách", freeTime: "thời gian rảnh",
};

export function updateLead(db: DatabaseSync, actor: Actor, id: string, data: Partial<LeadData>): Lead {
  // 1) Phạm vi trước: khách ngoài phạm vi thì 404 (không lộ là có tồn tại hay không).
  const before = loadVisibleLead(db, actor, id);
  // 2) Rồi mới đến quyền thao tác.
  if (!canEditLead(actor.role)) throw forbidden("Vai trò của bạn không được sửa khách tiềm năng");
  if (data.ownerId !== undefined && data.ownerId !== before.owner_id && !canAssignLead(actor.role)) {
    throw forbidden("Bạn không có quyền đổi người phụ trách");
  }
  checkReferences(db, data);
  if (data.phone) checkPhoneUnique(db, actor, data.phone, id);

  const current: Record<keyof LeadData, unknown> = {
    fullName: before.full_name, phone: before.phone, source: before.source,
    interestedCourseId: before.interested_course_id, stage: before.stage, ownerId: before.owner_id, freeTime: before.free_time,
  };
  const sets: string[] = [];
  const params: SQLInputValue[] = [];
  const changed: (keyof LeadData)[] = [];
  for (const [key, col] of Object.entries(COLUMNS) as [keyof LeadData, string][]) {
    if (data[key] === undefined) continue;
    const next = key === "freeTime" ? (data.freeTime || null) : data[key];
    sets.push(`${col} = ?`);
    params.push(next as SQLInputValue);
    if (next !== current[key]) changed.push(key);
  }

  return inTransaction(db, () => {
    if (sets.length) db.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
    const after = loadLead(db, id)!;
    if (changed.includes("ownerId")) {
      writeAudit(db, actor, {
        action: "giao_khach", entityType: "leads", entityId: id,
        detail: `Giao ${after.full_name} từ ${before.owner_name ?? "chưa giao"} sang ${after.owner_name ?? "chưa giao"}`,
      });
    }
    if (changed.includes("stage")) {
      writeAudit(db, actor, {
        action: "doi_giai_doan", entityType: "leads", entityId: id,
        detail: `${after.full_name}: ${STAGE_LABELS[before.stage]} -> ${STAGE_LABELS[after.stage]}`,
      });
    }
    const others = changed.filter((k) => k !== "ownerId" && k !== "stage");
    if (others.length) {
      writeAudit(db, actor, {
        action: "sua_khach", entityType: "leads", entityId: id,
        detail: `Sửa thông tin khách ${after.full_name}: ${others.map((k) => FIELD_LABELS[k]).join(", ")}`,
      });
    }
    return toLead(after);
  });
}
