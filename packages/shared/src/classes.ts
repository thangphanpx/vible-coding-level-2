import { z } from "zod";
import { dateField, uuidField } from "./common.ts";

export const PAYMENT_PLANS = ["mot_lan", "tra_gop"] as const;
export type PaymentPlan = (typeof PAYMENT_PLANS)[number];
export const PAYMENT_PLAN_LABELS: Record<PaymentPlan, string> = { mot_lan: "Đóng một lần", tra_gop: "Trả góp 2 đợt" };

export const CLASS_STATUSES = ["sap_mo", "dang_hoc", "ket_thuc"] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];
export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = { sap_mo: "Sắp mở", dang_hoc: "Đang học", ket_thuc: "Kết thúc" };

export const ACTIVITY_TYPES = ["ghi_chu", "cuoc_goi", "tin_nhan"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABELS: Record<ActivityType, string> = { ghi_chu: "Ghi chú", cuoc_goi: "Cuộc gọi", tin_nhan: "Tin nhắn" };

/** Xếp một khách đã đăng ký vào một lớp. Học phí lấy từ khóa học của lớp, không do người dùng nhập. */
export const enrollmentInputSchema = z.object({
  leadId: uuidField("Vui lòng chọn khách"),
  classId: uuidField("Vui lòng chọn lớp"),
  paymentPlan: z.enum(PAYMENT_PLANS, { error: "Vui lòng chọn hình thức đóng" }),
  /** Hạn đóng đợt 2 (chỉ khi trả góp). */
  secondDueDate: dateField("Hạn đóng đợt 2 không hợp lệ").nullable().optional(),
});
export type EnrollmentInput = z.output<typeof enrollmentInputSchema>;

/** Ghi nhận một lần đóng học phí: số nguyên đồng, lớn hơn 0. */
export const paymentInputSchema = z.object({
  amountVnd: z
    .number({ error: "Vui lòng nhập số tiền" })
    .int("Số tiền phải là số nguyên (đồng)")
    .min(1, "Số tiền phải lớn hơn 0"),
});
export type PaymentInput = z.output<typeof paymentInputSchema>;

export const activityInputSchema = z.object({
  type: z.enum(ACTIVITY_TYPES, { error: "Vui lòng chọn loại hoạt động" }),
  content: z.string({ error: "Vui lòng nhập nội dung" }).trim().min(1, "Vui lòng nhập nội dung").max(2000, "Nội dung tối đa 2000 ký tự"),
});
export type ActivityInput = z.output<typeof activityInputSchema>;

export type Intake = { id: string; startDate: string; seats: number };
export type Course = { id: string; name: string; tuitionVnd: number; sessions: number; description: string | null; intakes: Intake[] };

export type ClassSummary = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  intakeId: string;
  startDate: string;
  instructor: string;
  maxSize: number;
  status: ClassStatus;
  enrolledCount: number;
};

export type Enrollment = {
  id: string;
  leadId: string;
  leadName: string;
  classId: string;
  paymentPlan: PaymentPlan;
  totalTuitionVnd: number;
  paidVnd: number;
  secondDueDate: string | null;
  createdAt: string;
};

export type ClassDetail = ClassSummary & { enrollments: Enrollment[] };

export type Activity = {
  id: string;
  leadId: string;
  userId: string | null;
  userName: string | null;
  type: ActivityType;
  content: string;
  byAi: boolean;
  createdAt: string;
};
