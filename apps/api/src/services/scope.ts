import type { SQLInputValue } from "node:sqlite";
import { CARE_TASK_TYPES, type SessionUser } from "@ces/shared";

/** Người thực hiện thao tác (lấy từ phiên đăng nhập, không bao giờ lấy từ nội dung request). */
export type Actor = Pick<SessionUser, "id" | "role" | "fullName"> & { viaAi?: boolean };

/** Một điều kiện SQL (đã có dấu ?) kèm giá trị tham số. */
export type Cond = { sql: string; params: SQLInputValue[] };

/**
 * PHẠM VI KHÁCH được thấy:
 * - Admin, Quản lý tuyển sinh: tất cả.
 * - Tư vấn viên: chỉ khách mình phụ trách (khách chưa giao cho ai cũng KHÔNG thấy).
 * - Quản lý lớp học: chỉ khách đã đăng ký (giai đoạn Đăng ký).
 * `a` là bí danh của bảng leads trong câu SQL.
 */
export function leadScope(actor: Actor, a = "l"): Cond {
  switch (actor.role) {
    case "admin":
    case "quan_ly_tuyen_sinh":
      return { sql: "1 = 1", params: [] };
    case "tu_van_vien":
      return { sql: `${a}.owner_id = ?`, params: [actor.id] };
    case "quan_ly_lop_hoc":
      return { sql: `${a}.stage = 'dang_ky'`, params: [] };
    default:
      // Vai trò lạ (không có trong bảng quyền): không thấy gì.
      return { sql: "0 = 1", params: [] };
  }
}

/**
 * PHẠM VI VIỆC được thấy:
 * - Admin, Quản lý tuyển sinh: tất cả.
 * - Tư vấn viên: chỉ việc của mình (assignee_id).
 * - Quản lý lớp học: việc chăm sóc sau đăng ký = loại nhắc học phí / nhắc buổi học / đánh giá cuối khóa
 *   VÀ gắn với một khách mà họ được thấy (giai đoạn Đăng ký). `visibleLead` là bí danh của khách đã lọc theo leadScope.
 */
export function taskScope(actor: Actor, a = "t", visibleLead = "vl"): Cond {
  switch (actor.role) {
    case "admin":
    case "quan_ly_tuyen_sinh":
      return { sql: "1 = 1", params: [] };
    case "tu_van_vien":
      return { sql: `${a}.assignee_id = ?`, params: [actor.id] };
    case "quan_ly_lop_hoc":
      return {
        sql: `(${a}.type IN (${CARE_TASK_TYPES.map(() => "?").join(", ")}) AND ${visibleLead}.id IS NOT NULL)`,
        params: [...CARE_TASK_TYPES],
      };
    default:
      return { sql: "0 = 1", params: [] };
  }
}
