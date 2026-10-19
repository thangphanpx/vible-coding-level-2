import { z } from "zod";
import { pageField, searchField, uuidField } from "./common.ts";

export const STAGES = ["moi", "da_lien_he", "hen_tu_van", "dang_ky", "khong_theo"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  moi: "Mới",
  da_lien_he: "Đã liên hệ",
  hen_tu_van: "Hẹn tư vấn",
  dang_ky: "Đăng ký",
  khong_theo: "Không theo",
};

export const SOURCES = ["facebook", "zalo", "website", "gioi_thieu", "su_kien", "khac"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<Source, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  website: "Website",
  gioi_thieu: "Người quen giới thiệu",
  su_kien: "Sự kiện",
  khac: "Khác",
};

export const leadInputSchema = z.object({
  fullName: z
    .string({ error: "Vui lòng nhập họ tên" })
    .trim()
    .min(2, "Họ tên tối thiểu 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
  phone: z
    .string({ error: "Vui lòng nhập số điện thoại" })
    .transform((s) => s.replace(/[\s.\-]/g, ""))
    .pipe(z.string().regex(/^0\d{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0")),
  source: z.enum(SOURCES, { error: "Vui lòng chọn nguồn khách" }),
  interestedCourseId: uuidField("Khóa quan tâm không hợp lệ").nullable(),
  stage: z.enum(STAGES, { error: "Vui lòng chọn giai đoạn" }),
  ownerId: uuidField("Người phụ trách không hợp lệ").nullable(),
  /** Chuỗi rỗng hoặc null = chưa có (service lưu NULL). */
  freeTime: z.string().trim().max(200, "Thời gian rảnh tối đa 200 ký tự").nullable().optional(),
});
export type LeadInput = z.input<typeof leadInputSchema>;
export type LeadData = z.output<typeof leadInputSchema>;

/** Sửa khách: chỉ gửi các trường cần đổi. */
export const leadUpdateSchema = leadInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Không có thông tin nào để cập nhật");

export const leadListQuerySchema = z.object({
  page: pageField,
  q: searchField,
  stage: z.enum(STAGES, { error: "Giai đoạn không hợp lệ" }).optional(),
  /** id người phụ trách, hoặc "none" = chưa giao ai */
  ownerId: z.union([uuidField("Người phụ trách không hợp lệ"), z.literal("none")]).optional(),
  courseId: uuidField("Khóa học không hợp lệ").optional(),
  /** Khách đang theo (chưa đăng ký, chưa bỏ) mà CHƯA liên hệ quá số ngày này (hoặc chưa từng liên hệ). */
  staleDays: z.coerce.number({ error: "Số ngày không hợp lệ" }).int("Số ngày không hợp lệ").min(1, "Số ngày không hợp lệ").max(365, "Số ngày không hợp lệ").optional(),
});
export type LeadListQuery = z.output<typeof leadListQuerySchema>;

export type Lead = {
  id: string;
  fullName: string;
  phone: string;
  source: Source;
  interestedCourseId: string | null;
  interestedCourseName: string | null;
  stage: Stage;
  ownerId: string | null;
  ownerName: string | null;
  freeTime: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
