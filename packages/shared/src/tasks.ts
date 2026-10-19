import { z } from "zod";
import { dateField, pageField, searchField, uuidField } from "./common.ts";

export const TASK_TYPES = ["goi_lai", "gui_tai_lieu", "nhac_hoc_phi", "nhac_buoi_hoc", "danh_gia_cuoi_khoa"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  goi_lai: "Gọi lại",
  gui_tai_lieu: "Gửi tài liệu",
  nhac_hoc_phi: "Nhắc học phí",
  nhac_buoi_hoc: "Nhắc buổi học",
  danh_gia_cuoi_khoa: "Đánh giá cuối khóa",
};

export const TASK_STATUSES = ["open", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { open: "Chưa xong", done: "Đã xong" };

export const taskInputSchema = z.object({
  title: z
    .string({ error: "Vui lòng nhập tiêu đề" })
    .trim()
    .min(3, "Tiêu đề tối thiểu 3 ký tự")
    .max(200, "Tiêu đề tối đa 200 ký tự"),
  dueDate: dateField("Hạn làm không hợp lệ (định dạng năm-tháng-ngày)"),
  assigneeId: uuidField("Vui lòng chọn người làm"),
  leadId: uuidField("Khách liên quan không hợp lệ").nullable(),
  type: z.enum(TASK_TYPES, { error: "Vui lòng chọn loại việc" }),
  /** Không gửi = chưa xong (service đặt mặc định khi tạo). */
  done: z.boolean({ error: "Trạng thái không hợp lệ" }).optional(),
});
export type TaskInput = z.input<typeof taskInputSchema>;
export type TaskData = z.output<typeof taskInputSchema>;

export const taskUpdateSchema = taskInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Không có thông tin nào để cập nhật");

export const taskListQuerySchema = z.object({
  page: pageField,
  q: searchField,
  type: z.enum(TASK_TYPES, { error: "Loại việc không hợp lệ" }).optional(),
  status: z.enum(TASK_STATUSES, { error: "Trạng thái không hợp lệ" }).optional(),
  assigneeId: uuidField("Người làm không hợp lệ").optional(),
});
export type TaskListQuery = z.output<typeof taskListQuerySchema>;

export type Task = {
  id: string;
  title: string;
  dueDate: string;
  assigneeId: string | null;
  assigneeName: string | null;
  leadId: string | null;
  leadName: string | null;
  type: TaskType;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};
