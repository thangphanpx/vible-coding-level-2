import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

/**
 * KHAI BÁO CÔNG CỤ một lần, dùng chung cho dịch vụ AI (phần chạy) và web (nhãn, thẻ xác nhận).
 * - Tên, mô tả (để AI biết khi nào dùng) và khuôn tham số (Zod) nằm ở đây.
 * - Mã bản ghi (lead_id, class_id...) BẮT BUỘC là uuid: mã bịa sai định dạng bị chặn trước khi chạy.
 */

const leadId = z.uuid().describe("Mã khách (uuid) lấy từ kết quả search_leads hoặc từ hồ sơ khách đang mở. KHÔNG tự đặt.");
const classId = z.uuid().describe("Mã lớp (uuid) lấy từ kết quả list_classes. KHÔNG tự đặt.");
const STAGES = ["moi", "da_lien_he", "hen_tu_van", "dang_ky", "khong_theo"] as const;

// ── Công cụ ĐỌC: chạy ngay, không cần xác nhận ──

export const searchLeadsDef = toolDefinition({
  name: "search_leads",
  description:
    "Tìm khách hàng tiềm năng theo tên hoặc số điện thoại (có hoặc không dấu), có thể lọc theo giai đoạn. " +
    "Luôn dùng công cụ này để lấy lead_id trước khi xem hồ sơ hay ghi bất cứ thứ gì lên một khách. Chỉ thấy khách mà người đang hỏi được phép thấy.",
  inputSchema: z.object({
    query: z.string().optional().describe("Tên hoặc số điện thoại cần tìm"),
    stage: z.enum(STAGES).optional().describe("moi, da_lien_he, hen_tu_van, dang_ky, khong_theo"),
  }),
});

export const getLeadDef = toolDefinition({
  name: "get_lead",
  description: "Xem hồ sơ một khách: thông tin, các hoạt động gần nhất và việc cần làm đang mở. Dùng để tóm tắt khách hoặc đề xuất bước tiếp theo.",
  inputSchema: z.object({ lead_id: leadId }),
});

export const listStaleLeadsDef = toolDefinition({
  name: "list_stale_leads",
  description: "Liệt kê khách đang theo (mới, đã liên hệ, hẹn tư vấn) mà đã lâu chưa liên hệ hoặc chưa từng liên hệ.",
  inputSchema: z.object({ days: z.number().int().min(1).max(365).default(7).describe("Số ngày chưa liên hệ, mặc định 7") }),
});

export const listTasksDef = toolDefinition({
  name: "list_tasks",
  description: "Liệt kê việc cần làm (trong phạm vi người hỏi được thấy), có thể lọc theo trạng thái hoặc theo một khách.",
  inputSchema: z.object({
    status: z.enum(["open", "done"]).optional().describe("open = chưa xong, done = đã xong"),
    lead_id: leadId.optional(),
  }),
});

export const listCoursesDef = toolDefinition({
  name: "list_courses",
  description: "Liệt kê khóa học với học phí và lịch khai giảng.",
  inputSchema: z.object({}),
});

export const listClassesDef = toolDefinition({
  name: "list_classes",
  description: "Liệt kê các lớp học: khóa, ngày khai giảng, giảng viên, sĩ số hiện tại và tối đa, trạng thái.",
  inputSchema: z.object({}),
});

export const getClassDef = toolDefinition({
  name: "get_class",
  description: "Xem một lớp kèm danh sách học viên, hình thức đóng và số tiền đã đóng / còn thiếu.",
  inputSchema: z.object({ class_id: classId }),
});

export const searchDocsDef = toolDefinition({
  name: "search_docs",
  description:
    "Tìm trong kho tài liệu của công ty (học phí, ưu đãi, hoàn phí, bảo lưu, giới thiệu khóa học, quy trình chăm sóc). " +
    "Dùng MỖI KHI người dùng hỏi về chính sách hay thông tin có thể nằm trong tài liệu. Trả tối đa 5 đoạn kèm tên nguồn.",
  inputSchema: z.object({ query: z.string().min(1).describe("Câu hỏi hoặc từ khóa cần tìm, tiếng Việt") }),
});

/** Nhãn tiếng Việt hiện trong khung chat khi AI đang dùng công cụ. */
export const TOOL_LABELS: Record<string, string> = {
  search_leads: "Tìm khách",
  get_lead: "Xem hồ sơ khách",
  list_stale_leads: "Tìm khách lâu chưa liên hệ",
  list_tasks: "Xem việc cần làm",
  list_courses: "Xem khóa học",
  list_classes: "Xem lớp học",
  get_class: "Xem chi tiết lớp",
  search_docs: "Tra tài liệu",
};
