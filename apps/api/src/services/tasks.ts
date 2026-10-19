import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { CARE_TASK_TYPES, PAGE_SIZE, TASK_TYPE_LABELS, type Page, type Task, type TaskData, type TaskListQuery } from "@ces/shared";
import { inTransaction, writeAudit } from "./audit.ts";
import { ServiceError, forbidden, notFound } from "./errors.ts";
import { leadScope, taskScope, type Actor } from "./scope.ts";
import { WhereBuilder, clampPage, containsPattern, pageOf, unaccent } from "./sql.ts";

type TaskRow = {
  id: string; title: string; due_date: string; assignee_id: string | null; assignee_name: string | null;
  lead_id: string | null; lead_name: string | null; type: Task["type"]; done: number;
  created_at: string; updated_at: string;
};

/**
 * `vl` = khách liên quan CHỈ KHI người xem được phép thấy khách đó (theo phạm vi khách).
 * Việc gắn với khách ngoài phạm vi vẫn hiện (nếu việc nằm trong phạm vi) nhưng ẩn tên khách.
 */
function fromClause(actor: Actor): { sql: string; params: SQLInputValue[] } {
  const ls = leadScope(actor, "vl");
  return {
    sql: `FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN leads vl ON vl.id = t.lead_id AND ${ls.sql}`,
    params: ls.params,
  };
}

const COLS = `t.*, u.full_name AS assignee_name, vl.full_name AS lead_name`;

function toTask(r: TaskRow): Task {
  return {
    id: r.id, title: r.title, dueDate: r.due_date, assigneeId: r.assignee_id, assigneeName: r.assignee_name,
    leadId: r.lead_id, leadName: r.lead_name, type: r.type, done: r.done === 1,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function listTasks(db: DatabaseSync, actor: Actor, query: TaskListQuery): Page<Task> {
  const from = fromClause(actor);
  const where = new WhereBuilder();
  const scope = taskScope(actor, "t", "vl");
  where.add(scope.sql, ...scope.params);
  const q = unaccent(query.q ?? "");
  if (q) where.add("unaccent(t.title) LIKE ? ESCAPE '\\'", containsPattern(q));
  if (query.type) where.add("t.type = ?", query.type);
  if (query.status) where.add("t.done = ?", query.status === "done" ? 1 : 0);
  if (query.assigneeId) where.add("t.assignee_id = ?", query.assigneeId);
  if (query.leadId) where.add("t.lead_id = ?", query.leadId);

  const { total } = db.prepare(`SELECT count(*) AS total ${from.sql} ${where.sql}`).get(...from.params, ...where.params) as { total: number };
  const page = clampPage(query.page, total);
  // Việc chưa xong lên trước, hạn gần nhất lên trước.
  const rows = db
    .prepare(`SELECT ${COLS} ${from.sql} ${where.sql} ORDER BY t.done ASC, t.due_date ASC, t.id LIMIT ? OFFSET ?`)
    .all(...from.params, ...where.params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as TaskRow[];
  return pageOf(rows.map(toTask), page, total);
}

/** Đọc một việc KHÔNG kiểm phạm vi (chỉ dùng nội bộ sau khi đã kiểm quyền). */
function loadTask(db: DatabaseSync, actor: Actor, id: string): TaskRow | undefined {
  const from = fromClause(actor);
  return db.prepare(`SELECT ${COLS} ${from.sql} WHERE t.id = ?`).get(...from.params, id) as TaskRow | undefined;
}

/** Đọc một việc trong phạm vi của người dùng; ngoài phạm vi thì 404. */
function loadVisibleTask(db: DatabaseSync, actor: Actor, id: string): TaskRow {
  const from = fromClause(actor);
  const scope = taskScope(actor, "t", "vl");
  const row = db
    .prepare(`SELECT ${COLS} ${from.sql} WHERE t.id = ? AND ${scope.sql}`)
    .get(...from.params, id, ...scope.params) as TaskRow | undefined;
  if (!row) throw notFound("việc cần làm");
  return row;
}

export function getTask(db: DatabaseSync, actor: Actor, id: string): Task {
  return toTask(loadVisibleTask(db, actor, id));
}

/** Kiểm các id tham chiếu. Khách ngoài phạm vi báo y như khách không tồn tại (không lộ khách có thật). */
function checkReferences(db: DatabaseSync, actor: Actor, data: Partial<TaskData>, currentLeadId?: string | null): void {
  const fields: Record<string, string> = {};
  if (data.assigneeId && !db.prepare("SELECT 1 FROM users WHERE id = ? AND active = 1").get(data.assigneeId)) {
    fields.assigneeId = "Người làm không tồn tại";
  }
  // Giữ nguyên khách đang gắn thì không kiểm lại (tránh chặn việc sửa tiêu đề chỉ vì khách đã chuyển phạm vi).
  if (data.leadId && data.leadId !== currentLeadId) {
    const scope = leadScope(actor, "l");
    if (!db.prepare(`SELECT 1 FROM leads l WHERE l.id = ? AND ${scope.sql}`).get(data.leadId, ...scope.params)) {
      fields.leadId = "Khách liên quan không tồn tại";
    }
  }
  if (Object.keys(fields).length) throw new ServiceError(400, "Dữ liệu không hợp lệ", fields);
}

const isCareType = (type: string) => (CARE_TASK_TYPES as readonly string[]).includes(type);
const LOP_HOC_CHI_CHAM_SOC = "Quản lý lớp học chỉ làm việc chăm sóc sau đăng ký (nhắc học phí, nhắc buổi học, đánh giá cuối khóa)";

export function createTask(db: DatabaseSync, actor: Actor, data: TaskData): Task {
  if (actor.role === "tu_van_vien" && data.assigneeId !== actor.id) {
    throw forbidden("Bạn chỉ được tạo việc cho chính mình");
  }
  if (actor.role === "quan_ly_lop_hoc") {
    if (!isCareType(data.type)) throw forbidden(LOP_HOC_CHI_CHAM_SOC);
    if (!data.leadId) {
      throw new ServiceError(400, "Dữ liệu không hợp lệ", { leadId: "Việc chăm sóc sau đăng ký phải gắn với một khách đã đăng ký" });
    }
  }
  checkReferences(db, actor, data);
  return inTransaction(db, () => {
    const row = db
      .prepare(`INSERT INTO tasks (title, due_date, assignee_id, lead_id, type, done) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`)
      .get(data.title, data.dueDate, data.assigneeId, data.leadId, data.type, data.done ? 1 : 0) as { id: string };
    const created = loadTask(db, actor, row.id)!;
    writeAudit(db, actor, {
      action: "tao_viec", entityType: "tasks", entityId: row.id,
      detail: `Tạo việc "${data.title}" (${TASK_TYPE_LABELS[data.type]}, hạn ${data.dueDate}) cho ${created.assignee_name ?? "chưa giao"}`,
    });
    return toTask(created);
  });
}

const COLUMNS: Record<keyof TaskData, string> = {
  title: "title", dueDate: "due_date", assigneeId: "assignee_id", leadId: "lead_id", type: "type", done: "done",
};
const FIELD_LABELS: Record<keyof TaskData, string> = {
  title: "tiêu đề", dueDate: "hạn làm", assigneeId: "người làm", leadId: "khách liên quan", type: "loại việc", done: "trạng thái",
};

export function updateTask(db: DatabaseSync, actor: Actor, id: string, data: Partial<TaskData>): Task {
  // 1) Phạm vi trước (404), 2) rồi quyền thao tác (403 / 400).
  const before = loadVisibleTask(db, actor, id);
  if (actor.role === "tu_van_vien" && data.assigneeId !== undefined && data.assigneeId !== actor.id) {
    throw forbidden("Bạn chỉ được giữ việc cho chính mình, không giao việc cho người khác");
  }
  if (actor.role === "quan_ly_lop_hoc") {
    if (data.type !== undefined && !isCareType(data.type)) throw forbidden(LOP_HOC_CHI_CHAM_SOC);
    if (data.leadId === null) {
      throw new ServiceError(400, "Dữ liệu không hợp lệ", { leadId: "Việc chăm sóc sau đăng ký phải gắn với một khách đã đăng ký" });
    }
  }
  checkReferences(db, actor, data, before.lead_id);

  const current: Record<keyof TaskData, unknown> = {
    title: before.title, dueDate: before.due_date, assigneeId: before.assignee_id, leadId: before.lead_id,
    type: before.type, done: before.done === 1,
  };
  const sets: string[] = [];
  const params: SQLInputValue[] = [];
  const changed: (keyof TaskData)[] = [];
  for (const [key, col] of Object.entries(COLUMNS) as [keyof TaskData, string][]) {
    if (data[key] === undefined) continue;
    const next = key === "done" ? (data.done ? 1 : 0) : data[key];
    sets.push(`${col} = ?`);
    params.push(next as SQLInputValue);
    if ((key === "done" ? Boolean(next) : next) !== current[key]) changed.push(key);
  }

  return inTransaction(db, () => {
    if (sets.length) db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
    if (changed.includes("done")) {
      const xong = data.done === true;
      writeAudit(db, actor, {
        action: xong ? "hoan_thanh_viec" : "mo_lai_viec", entityType: "tasks", entityId: id,
        detail: `${xong ? "Đánh dấu xong" : "Mở lại"} việc "${before.title}"`,
      });
    }
    const others = changed.filter((k) => k !== "done");
    if (others.length) {
      writeAudit(db, actor, {
        action: "sua_viec", entityType: "tasks", entityId: id,
        detail: `Sửa việc "${data.title ?? before.title}": ${others.map((k) => FIELD_LABELS[k]).join(", ")}`,
      });
    }
    return toTask(loadTask(db, actor, id)!);
  });
}
