import type { DatabaseSync } from "node:sqlite";
import { ACTIVITY_LABELS, type Activity, type ActivityInput } from "@ces/shared";
import { inTransaction, writeAudit } from "./audit.ts";
import { notFound } from "./errors.ts";
import { leadScope, type Actor } from "./scope.ts";

type ActivityRow = {
  id: string; lead_id: string; user_id: string | null; user_name: string | null; type: Activity["type"];
  content: string; by_ai: number; created_at: string;
};

const SELECT = `SELECT a.id, a.lead_id, a.user_id, u.full_name AS user_name, a.type, a.content, a.by_ai, a.created_at
  FROM activities a LEFT JOIN users u ON u.id = a.user_id`;

const toActivity = (r: ActivityRow): Activity => ({
  id: r.id, leadId: r.lead_id, userId: r.user_id, userName: r.user_name, type: r.type, content: r.content,
  byAi: r.by_ai === 1, createdAt: r.created_at,
});

/** Khách phải nằm trong phạm vi của người dùng, nếu không thì 404 (như không tồn tại). */
function requireVisibleLead(db: DatabaseSync, actor: Actor, leadId: string): { full_name: string } {
  const scope = leadScope(actor, "l");
  const lead = db.prepare(`SELECT l.full_name FROM leads l WHERE l.id = ? AND ${scope.sql}`).get(leadId, ...scope.params) as
    | { full_name: string }
    | undefined;
  if (!lead) throw notFound("khách hàng");
  return lead;
}

export function listActivities(db: DatabaseSync, actor: Actor, leadId: string): Activity[] {
  requireVisibleLead(db, actor, leadId);
  const rows = db.prepare(`${SELECT} WHERE a.lead_id = ? ORDER BY a.created_at DESC, a.id`).all(leadId) as ActivityRow[];
  return rows.map(toActivity);
}

/**
 * Ghi một hoạt động (ghi chú, cuộc gọi, tin nhắn) vào hồ sơ khách.
 * `byAi` = true khi thao tác do trợ lý AI làm (hiện nhãn "do AI ghi").
 */
export function addActivity(db: DatabaseSync, actor: Actor, leadId: string, data: ActivityInput, opts: { byAi?: boolean } = {}): Activity {
  const lead = requireVisibleLead(db, actor, leadId);
  const byAi = opts.byAi ? 1 : 0;
  return inTransaction(db, () => {
    const { id } = db
      .prepare("INSERT INTO activities (lead_id, user_id, type, content, by_ai) VALUES (?, ?, ?, ?, ?) RETURNING id")
      .get(leadId, actor.id, data.type, data.content, byAi) as { id: string };
    // Gọi hoặc nhắn tin cho khách thì cập nhật "liên hệ gần nhất".
    if (data.type !== "ghi_chu") db.prepare("UPDATE leads SET last_contacted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(leadId);
    writeAudit(db, actor, {
      action: "them_hoat_dong", entityType: "activities", entityId: id,
      detail: `${ACTIVITY_LABELS[data.type]} cho khách ${lead.full_name}`,
      byAi: !!byAi,
    });
    return toActivity(db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as ActivityRow);
  });
}
