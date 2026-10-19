import type { Role } from "./common.ts";
import type { TaskType } from "./tasks.ts";

/**
 * Bảng vai trò × quyền (nguồn duy nhất cho web và API).
 * API kiểm quyền thật ở apps/api/src/services/; web chỉ dùng bảng này để ẩn menu và nút cho gọn.
 * Phạm vi dữ liệu (khách nào, việc nào được thấy) nằm ở apps/api/src/services/scope.ts.
 */

const TAT_CA: readonly Role[] = ["admin", "quan_ly_tuyen_sinh", "tu_van_vien", "quan_ly_lop_hoc"];

/** Trang nào vai trò nào được xem (theo đường dẫn của web). */
export const PAGE_ROLES: Record<string, readonly Role[]> = {
  "/": TAT_CA,
  "/khach-tiem-nang": TAT_CA,
  "/viec-can-lam": TAT_CA,
  "/khoa-hoc": TAT_CA,
  "/lop-hoc": ["admin", "quan_ly_tuyen_sinh", "quan_ly_lop_hoc"],
  "/kho-tri-thuc": TAT_CA,
  "/tro-ly-ai": TAT_CA,
  "/nguoi-dung": ["admin"],
  "/nhat-ky": ["admin", "quan_ly_tuyen_sinh"],
  "/ho-so": TAT_CA,
  "/login": TAT_CA,
};

export function canViewPage(role: Role, path: string): boolean {
  const roles = PAGE_ROLES[path];
  // Đường dẫn chưa khai báo thì không chặn ở đây (trang không tồn tại sẽ hiện "không tìm thấy").
  return roles ? roles.includes(role) : true;
}

/** Thêm khách: Quản lý lớp học không được. (Tư vấn viên chỉ thêm khách do chính mình phụ trách.) */
export const canCreateLead = (role: Role) => role !== "quan_ly_lop_hoc";
/** Sửa khách và đổi giai đoạn: Quản lý lớp học không được. (Tư vấn viên chỉ với khách của mình.) */
export const canEditLead = (role: Role) => role !== "quan_ly_lop_hoc";
/** Đổi người phụ trách (giao khách): chỉ Admin và Quản lý tuyển sinh. */
export const canAssignLead = (role: Role) => role === "admin" || role === "quan_ly_tuyen_sinh";
/** Xem tất cả việc, chọn người làm khác: Admin và Quản lý tuyển sinh. */
export const canSeeAllTasks = (role: Role) => role === "admin" || role === "quan_ly_tuyen_sinh";

/** Các loại việc thuộc "chăm sóc sau đăng ký" (phạm vi việc của Quản lý lớp học). */
export const CARE_TASK_TYPES: readonly TaskType[] = ["nhac_hoc_phi", "nhac_buoi_hoc", "danh_gia_cuoi_khoa"];

/** Loại việc vai trò này được tạo/chọn. Quản lý lớp học chỉ loại chăm sóc sau đăng ký. */
export function allowedTaskTypes(role: Role, all: readonly TaskType[]): readonly TaskType[] {
  return role === "quan_ly_lop_hoc" ? all.filter((t) => CARE_TASK_TYPES.includes(t)) : all;
}

/** Xem danh sách lớp và ghi danh: Admin, Quản lý tuyển sinh, Quản lý lớp học. Tư vấn viên không. */
export const canViewClasses = (role: Role) => role !== "tu_van_vien";
/** Mở lớp, xếp khách vào lớp, ghi nhận đóng học phí: Admin và Quản lý lớp học. */
export const canManageClasses = (role: Role) => role === "admin" || role === "quan_ly_lop_hoc";
