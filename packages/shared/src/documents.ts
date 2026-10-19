import { z } from "zod";
import type { Role } from "./common.ts";

/** Tài liệu nạp vào kho tri thức: văn bản thuần (.txt, .md). */
export const documentInputSchema = z.object({
  fileName: z
    .string({ error: "Thiếu tên file" })
    .trim()
    .min(1, "Thiếu tên file")
    .max(200, "Tên file tối đa 200 ký tự")
    .regex(/\.(txt|md)$/i, "Chỉ nhận file .txt hoặc .md"),
  title: z.string().trim().max(200, "Tiêu đề tối đa 200 ký tự").optional(),
  content: z
    .string({ error: "Tài liệu trống" })
    .trim()
    .min(1, "Tài liệu trống")
    .max(300_000, "Tài liệu quá dài (tối đa khoảng 300.000 ký tự)"),
});
export type DocumentInput = z.output<typeof documentInputSchema>;

export const docSearchSchema = z.object({
  q: z.string({ error: "Vui lòng nhập từ khóa" }).trim().min(1, "Vui lòng nhập từ khóa").max(200, "Từ khóa tối đa 200 ký tự"),
});

export type Doc = { id: string; title: string; fileName: string; chunkCount: number; uploadedByName: string | null; createdAt: string };

/** Một đoạn tài liệu tìm được, kèm nguồn để trích dẫn. */
export type DocHit = { documentId: string; source: string; heading: string | null; content: string };

/** Xem tài liệu và tìm kiếm: mọi vai trò. Nạp và xóa: chỉ Admin. */
export const canManageDocs = (role: Role) => role === "admin";
