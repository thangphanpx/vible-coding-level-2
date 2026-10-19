import { z } from "zod";

/** Số dòng mỗi trang ở mọi danh sách. */
export const PAGE_SIZE = 20;

export const ROLES = ["admin", "quan_ly_tuyen_sinh", "tu_van_vien", "quan_ly_lop_hoc"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  quan_ly_tuyen_sinh: "Quản lý tuyển sinh",
  tu_van_vien: "Tư vấn viên",
  quan_ly_lop_hoc: "Quản lý lớp học",
};

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

export type Lookups = {
  users: { id: string; fullName: string; role: Role }[];
  courses: { id: string; name: string }[];
  leads: { id: string; fullName: string }[];
};

/** Lỗi trả về khi dữ liệu sai: fields là tên trường -> thông báo tiếng Việt. */
export type ApiError = { error: string; fields?: Record<string, string> };

export const uuidField = (message: string) => z.uuid(message);

/** Số trang: nhận số hoặc chuỗi số, tối thiểu 1. */
export const pageField = z.coerce.number({ error: "Trang không hợp lệ" }).int("Trang không hợp lệ").min(1, "Trang không hợp lệ").default(1);

/** Ô tìm kiếm: nhận chuỗi hoặc số (địa chỉ trang có thể đọc "123" thành số). */
export const searchField = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().max(100, "Từ khóa tìm kiếm tối đa 100 ký tự"))
  .optional();

/** Bỏ các tham số rỗng ("" hoặc null) trước khi kiểm bằng Zod. */
export function dropEmpty(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== "" && v !== null && v !== undefined));
}

/** Gom lỗi Zod thành { tên_trường: thông báo đầu tiên }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export const dateField = (message: string) =>
  z
    .string({ error: message })
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, message);
