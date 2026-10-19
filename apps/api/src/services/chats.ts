import type { DatabaseSync } from "node:sqlite";
import type { ChatMessage, ChatMessageInput } from "@ces/shared";
import { notFound } from "./errors.ts";
import { leadScope, type Actor } from "./scope.ts";

/** Số tin gần nhất trả về khi mở lại khung chat. */
export const CHAT_HISTORY_LIMIT = 60;

/** Nếu chat gắn với một khách thì khách đó phải nằm trong phạm vi của người dùng (không thì 404). */
function checkLead(db: DatabaseSync, actor: Actor, leadId: string | null): void {
  if (!leadId) return;
  const scope = leadScope(actor, "l");
  if (!db.prepare(`SELECT 1 FROM leads l WHERE l.id = ? AND ${scope.sql}`).get(leadId, ...scope.params)) throw notFound("khách hàng");
}

/** Lịch sử chat CỦA CHÍNH NGƯỜI DÙNG này (không ai khác đọc được), theo từng khách hoặc chat chung (leadId = null). */
export function listChat(db: DatabaseSync, actor: Actor, leadId: string | null): ChatMessage[] {
  checkLead(db, actor, leadId);
  const rows = db
    .prepare(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = ? AND lead_id IS ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(actor.id, leadId, CHAT_HISTORY_LIMIT) as { id: string; role: ChatMessage["role"]; content: string; created_at: string }[];
  return rows.reverse().map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }));
}

export function addChatMessages(db: DatabaseSync, actor: Actor, leadId: string | null, messages: ChatMessageInput[]): ChatMessage[] {
  checkLead(db, actor, leadId);
  const insert = db.prepare("INSERT INTO chat_messages (user_id, lead_id, role, content) VALUES (?, ?, ?, ?)");
  db.exec("BEGIN");
  try {
    for (const m of messages) insert.run(actor.id, leadId, m.role, m.content);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return listChat(db, actor, leadId);
}

export function clearChat(db: DatabaseSync, actor: Actor, leadId: string | null): void {
  checkLead(db, actor, leadId);
  db.prepare("DELETE FROM chat_messages WHERE user_id = ? AND lead_id IS ?").run(actor.id, leadId);
}
