import type { DatabaseSync } from "node:sqlite";
import {
  CLASS_STATUS_LABELS, canManageClasses, canViewClasses,
  type ClassDetail, type ClassStatus, type ClassSummary, type Enrollment, type EnrollmentInput, type PaymentInput, type PaymentPlan,
} from "@ces/shared";
import { inTransaction, writeAudit } from "./audit.ts";
import { ServiceError, forbidden, notFound } from "./errors.ts";
import { leadScope, type Actor } from "./scope.ts";

type ClassRow = {
  id: string; name: string; course_id: string; course_name: string; intake_id: string; start_date: string;
  instructor: string; max_size: number; status: ClassStatus; enrolled: number;
};

const CLASS_SELECT = `SELECT cl.id, cl.name, co.id AS course_id, co.name AS course_name, ci.id AS intake_id, ci.start_date,
    cl.instructor, cl.max_size, cl.status,
    (SELECT count(*) FROM enrollments e WHERE e.class_id = cl.id) AS enrolled
  FROM classes cl
  JOIN course_intakes ci ON ci.id = cl.intake_id
  JOIN courses co ON co.id = ci.course_id`;

const toClass = (r: ClassRow): ClassSummary => ({
  id: r.id, name: r.name, courseId: r.course_id, courseName: r.course_name, intakeId: r.intake_id, startDate: r.start_date,
  instructor: r.instructor, maxSize: r.max_size, status: r.status, enrolledCount: r.enrolled,
});

function requireView(actor: Actor): void {
  if (!canViewClasses(actor.role)) throw forbidden("Vai trò của bạn không được xem lớp học");
}

export function listClasses(db: DatabaseSync, actor: Actor): ClassSummary[] {
  requireView(actor);
  const rows = db.prepare(`${CLASS_SELECT} ORDER BY ci.start_date, cl.name`).all() as ClassRow[];
  return rows.map(toClass);
}

type EnrollmentRow = {
  id: string; lead_id: string; lead_name: string; class_id: string; payment_plan: PaymentPlan;
  total_tuition_vnd: number; paid_vnd: number; second_due_date: string | null; created_at: string;
};

const toEnrollment = (r: EnrollmentRow): Enrollment => ({
  id: r.id, leadId: r.lead_id, leadName: r.lead_name, classId: r.class_id, paymentPlan: r.payment_plan,
  totalTuitionVnd: r.total_tuition_vnd, paidVnd: r.paid_vnd, secondDueDate: r.second_due_date, createdAt: r.created_at,
});

/** Ghi danh của một lớp, chỉ những khách mà người dùng được phép thấy (không lộ khách ngoài phạm vi). */
function listEnrollments(db: DatabaseSync, actor: Actor, classId: string): Enrollment[] {
  const scope = leadScope(actor, "l");
  const rows = db
    .prepare(
      `SELECT e.id, e.lead_id, l.full_name AS lead_name, e.class_id, e.payment_plan, e.total_tuition_vnd, e.paid_vnd,
              e.second_due_date, e.created_at
       FROM enrollments e JOIN leads l ON l.id = e.lead_id
       WHERE e.class_id = ? AND ${scope.sql}
       ORDER BY l.full_name`,
    )
    .all(classId, ...scope.params) as EnrollmentRow[];
  return rows.map(toEnrollment);
}

export function getClass(db: DatabaseSync, actor: Actor, id: string): ClassDetail {
  requireView(actor);
  const row = db.prepare(`${CLASS_SELECT} WHERE cl.id = ?`).get(id) as ClassRow | undefined;
  if (!row) throw notFound("lớp học");
  return { ...toClass(row), enrollments: listEnrollments(db, actor, id) };
}

/** Xếp một khách đã đăng ký vào một lớp. Học phí lấy từ khóa học của lớp. */
export function createEnrollment(db: DatabaseSync, actor: Actor, data: EnrollmentInput): Enrollment {
  if (!canManageClasses(actor.role)) throw forbidden("Vai trò của bạn không được xếp khách vào lớp");
  const cls = db.prepare(`${CLASS_SELECT} WHERE cl.id = ?`).get(data.classId) as ClassRow | undefined;
  if (!cls) throw new ServiceError(400, "Dữ liệu không hợp lệ", { classId: "Lớp không tồn tại" });
  // Khách phải nằm trong phạm vi của người xếp lớp (ngoài phạm vi thì như không tồn tại).
  const scope = leadScope(actor, "l");
  const lead = db
    .prepare(`SELECT l.id, l.full_name, l.stage FROM leads l WHERE l.id = ? AND ${scope.sql}`)
    .get(data.leadId, ...scope.params) as { id: string; full_name: string; stage: string } | undefined;
  if (!lead) throw new ServiceError(400, "Dữ liệu không hợp lệ", { leadId: "Khách không tồn tại" });
  if (lead.stage !== "dang_ky") throw new ServiceError(400, "Chỉ khách ở giai đoạn Đăng ký mới được xếp vào lớp", { leadId: "Khách chưa ở giai đoạn Đăng ký" });
  if (cls.status === "ket_thuc") throw new ServiceError(400, "Lớp đã kết thúc, không xếp thêm học viên", { classId: "Lớp đã kết thúc" });
  if (db.prepare("SELECT 1 FROM enrollments WHERE lead_id = ? AND class_id = ?").get(data.leadId, data.classId)) {
    throw new ServiceError(409, "Khách này đã có trong lớp", { leadId: "Khách đã có trong lớp này" });
  }
  if (cls.enrolled >= cls.max_size) {
    throw new ServiceError(409, `Lớp đã đủ ${cls.max_size} học viên`, { classId: "Lớp đã đủ sĩ số" });
  }
  const tuition = (db.prepare("SELECT tuition_vnd FROM courses WHERE id = ?").get(cls.course_id) as { tuition_vnd: number }).tuition_vnd;
  const secondDue = data.paymentPlan === "tra_gop" ? (data.secondDueDate ?? null) : null;
  return inTransaction(db, () => {
    const { id } = db
      .prepare(
        `INSERT INTO enrollments (lead_id, class_id, payment_plan, total_tuition_vnd, paid_vnd, second_due_date)
         VALUES (?, ?, ?, ?, 0, ?) RETURNING id`,
      )
      .get(data.leadId, data.classId, data.paymentPlan, tuition, secondDue) as { id: string };
    writeAudit(db, actor, {
      action: "xep_lop", entityType: "enrollments", entityId: id,
      detail: `Xếp ${lead.full_name} vào lớp ${cls.name} (${data.paymentPlan === "tra_gop" ? "trả góp" : "đóng một lần"})`,
    });
    return listEnrollments(db, actor, data.classId).find((e) => e.id === id)!;
  });
}

/** Ghi nhận một lần đóng học phí. Tổng đã đóng không được vượt tổng học phí. */
export function recordPayment(db: DatabaseSync, actor: Actor, enrollmentId: string, data: PaymentInput): Enrollment {
  if (!canManageClasses(actor.role)) throw forbidden("Vai trò của bạn không được ghi nhận học phí");
  const scope = leadScope(actor, "l");
  const row = db
    .prepare(
      `SELECT e.id, e.lead_id, l.full_name AS lead_name, e.class_id, e.payment_plan, e.total_tuition_vnd, e.paid_vnd,
              e.second_due_date, e.created_at, cl.name AS class_name
       FROM enrollments e JOIN leads l ON l.id = e.lead_id JOIN classes cl ON cl.id = e.class_id
       WHERE e.id = ? AND ${scope.sql}`,
    )
    .get(enrollmentId, ...scope.params) as (EnrollmentRow & { class_name: string }) | undefined;
  if (!row) throw notFound("ghi danh");
  const remaining = row.total_tuition_vnd - row.paid_vnd;
  if (data.amountVnd > remaining) {
    throw new ServiceError(400, "Số tiền vượt quá học phí còn lại", { amountVnd: `Học phí còn lại là ${remaining.toLocaleString("vi-VN")}đ` });
  }
  return inTransaction(db, () => {
    db.prepare("UPDATE enrollments SET paid_vnd = paid_vnd + ? WHERE id = ?").run(data.amountVnd, enrollmentId);
    writeAudit(db, actor, {
      action: "dong_hoc_phi", entityType: "enrollments", entityId: enrollmentId,
      detail: `Ghi nhận ${row.lead_name} đóng ${data.amountVnd.toLocaleString("vi-VN")}đ cho lớp ${row.class_name}`,
    });
    return listEnrollments(db, actor, row.class_id).find((e) => e.id === enrollmentId)!;
  });
}

export const statusLabel = (s: ClassStatus) => CLASS_STATUS_LABELS[s];
