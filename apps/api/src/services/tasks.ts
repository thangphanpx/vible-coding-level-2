import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { PAGE_SIZE, type Page, type Task, type TaskData, type TaskListQuery } from "@ces/shared";
import { ServiceError, notFound } from "./errors.ts";
import { WhereBuilder, clampPage, containsPattern, pageOf, unaccent } from "./sql.ts";

type TaskRow = {
  id: string; title: string; due_date: string; assignee_id: string | null; assignee_name: string | null;
  lead_id: string | null; lead_name: string | null; type: Task["type"]; done: number;
  created_at: string; updated_at: string;
};

const SELECT = `SELECT t.*, u.full_name AS assignee_name, l.full_name AS lead_name
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
  LEFT JOIN leads l ON l.id = t.lead_id`;

function toTask(r: TaskRow): Task {
  return {
    id: r.id, title: r.title, dueDate: r.due_date, assigneeId: r.assignee_id, assigneeName: r.assignee_name,
    leadId: r.lead_id, leadName: r.lead_name, type: r.type, done: r.done === 1,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function listTasks(db: DatabaseSync, query: TaskListQuery): Page<Task> {
  const where = new WhereBuilder();
  const q = unaccent(query.q ?? "");
  if (q) where.add("unaccent(t.title) LIKE ? ESCAPE '\\'", containsPattern(q));
  if (query.type) where.add("t.type = ?", query.type);
  if (query.status) where.add("t.done = ?", query.status === "done" ? 1 : 0);
  if (query.assigneeId) where.add("t.assignee_id = ?", query.assigneeId);

  const { total } = db.prepare(`SELECT count(*) AS total FROM tasks t ${where.sql}`).get(...where.params) as { total: number };
  const page = clampPage(query.page, total);
  // Việc chưa xong lên trước, hạn gần nhất lên trước.
  const rows = db
    .prepare(`${SELECT} ${where.sql} ORDER BY t.done ASC, t.due_date ASC, t.id LIMIT ? OFFSET ?`)
    .all(...where.params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as TaskRow[];
  return pageOf(rows.map(toTask), page, total);
}

export function getTask(db: DatabaseSync, id: string): Task {
  const row = db.prepare(`${SELECT} WHERE t.id = ?`).get(id) as TaskRow | undefined;
  if (!row) throw notFound("việc cần làm");
  return toTask(row);
}

function checkReferences(db: DatabaseSync, data: Partial<TaskData>): void {
  const fields: Record<string, string> = {};
  if (data.assigneeId && !db.prepare("SELECT 1 FROM users WHERE id = ? AND active = 1").get(data.assigneeId)) {
    fields.assigneeId = "Người làm không tồn tại";
  }
  if (data.leadId && !db.prepare("SELECT 1 FROM leads WHERE id = ?").get(data.leadId)) {
    fields.leadId = "Khách liên quan không tồn tại";
  }
  if (Object.keys(fields).length) throw new ServiceError(400, "Dữ liệu không hợp lệ", fields);
}

export function createTask(db: DatabaseSync, data: TaskData): Task {
  checkReferences(db, data);
  const row = db
    .prepare(`INSERT INTO tasks (title, due_date, assignee_id, lead_id, type, done) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`)
    .get(data.title, data.dueDate, data.assigneeId, data.leadId, data.type, data.done ? 1 : 0) as { id: string };
  return getTask(db, row.id);
}

const COLUMNS: Record<keyof TaskData, string> = {
  title: "title", dueDate: "due_date", assigneeId: "assignee_id", leadId: "lead_id", type: "type", done: "done",
};

export function updateTask(db: DatabaseSync, id: string, data: Partial<TaskData>): Task {
  getTask(db, id);
  checkReferences(db, data);
  const sets: string[] = [];
  const params: SQLInputValue[] = [];
  for (const [key, col] of Object.entries(COLUMNS) as [keyof TaskData, string][]) {
    if (data[key] === undefined) continue;
    sets.push(`${col} = ?`);
    params.push(key === "done" ? (data.done ? 1 : 0) : (data[key] as SQLInputValue));
  }
  if (sets.length) db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  return getTask(db, id);
}
