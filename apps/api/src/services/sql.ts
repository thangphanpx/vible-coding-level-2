import type { SQLInputValue } from "node:sqlite";
import { PAGE_SIZE, type Page } from "@ces/shared";

/** Chuẩn hóa để tìm không phân biệt hoa thường và dấu tiếng Việt. */
export function unaccent(text: unknown): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/** Mẫu LIKE "chứa chuỗi" (thoát các ký tự % _ \). Dùng kèm ESCAPE '\'. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Ghép điều kiện lọc: mỗi điều kiện thêm vào danh sách, nối bằng AND. */
export class WhereBuilder {
  private parts: string[] = [];
  params: SQLInputValue[] = [];
  add(sql: string, ...params: SQLInputValue[]): void {
    this.parts.push(sql);
    this.params.push(...params);
  }
  get sql(): string {
    return this.parts.length ? `WHERE ${this.parts.join(" AND ")}` : "";
  }
}

/** Nếu xin trang quá cuối thì lấy trang cuối. */
export function clampPage(page: number, total: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
}

export function pageOf<T>(items: T[], page: number, total: number): Page<T> {
  return { items, page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
