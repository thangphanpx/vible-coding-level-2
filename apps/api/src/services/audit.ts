import type { DatabaseSync } from "node:sqlite";
import type { Actor } from "./scope.ts";

export type AuditEntry = {
  action: string;
  entityType: "leads" | "tasks";
  entityId: string;
  /** Mô tả tiếng Việt. Không ghi số điện thoại, mật khẩu hay bí mật vào đây. */
  detail: string;
};

/** Ghi một dòng nhật ký: ai (từ phiên đăng nhập) làm gì, với đối tượng nào. Gọi trong cùng giao dịch với thay đổi dữ liệu. */
export function writeAudit(db: DatabaseSync, actor: Actor, e: AuditEntry): void {
  db.prepare(
    "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail, by_ai) VALUES (?, ?, ?, ?, ?, 0)",
  ).run(actor.id, e.action, e.entityType, e.entityId, e.detail);
}

/** Chạy trong một giao dịch: lỗi giữa chừng thì hoàn tác cả thay đổi lẫn dòng nhật ký. */
export function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
