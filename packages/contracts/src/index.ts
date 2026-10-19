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

// ── Công cụ GHI ──

const sources = ["facebook", "zalo", "website", "gioi_thieu", "su_kien", "khac"] as const;
const taskTypes = ["goi_lai", "gui_tai_lieu", "nhac_hoc_phi", "nhac_buoi_hoc", "danh_gia_cuoi_khoa"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày dạng năm-tháng-ngày").describe("Ngày dạng năm-tháng-ngày, ví dụ 2026-10-26");

/** Ghi chú nhẹ, không cần xác nhận: tự thêm vào hồ sơ và gắn nhãn "do AI ghi". */
export const addNoteDef = toolDefinition({
  name: "add_note",
  description: "Thêm một ghi chú vào hồ sơ khách (tự động gắn nhãn do AI ghi). Dùng khi người dùng nhờ ghi lại nội dung cuộc trao đổi.",
  inputSchema: z.object({ lead_id: leadId, content: z.string().min(1).max(2000).describe("Nội dung ghi chú") }),
});

/** Các công cụ dưới đây GHI dữ liệu quan trọng: needsApproval = true, người dùng phải bấm Duyệt thì mới chạy. */
export const createTaskDef = toolDefinition({
  name: "create_task",
  description: "Tạo việc cần làm cho chính người đang hỏi (ví dụ gọi lại, nhắc học phí). Cần người dùng duyệt.",
  inputSchema: z.object({
    title: z.string().min(3).max(200).describe("Tiêu đề việc, ngắn gọn"),
    due_date: date,
    type: z.enum(taskTypes).describe("goi_lai, gui_tai_lieu, nhac_hoc_phi, nhac_buoi_hoc, danh_gia_cuoi_khoa"),
    lead_id: leadId.optional().describe("Khách liên quan (nếu có)"),
  }),
  needsApproval: true,
});

export const updateLeadStageDef = toolDefinition({
  name: "update_lead_stage",
  description: "Đổi giai đoạn của một khách. Cần người dùng duyệt.",
  inputSchema: z.object({ lead_id: leadId, stage: z.enum(STAGES) }),
  needsApproval: true,
});

export const createLeadDef = toolDefinition({
  name: "create_lead",
  description: "Thêm một khách tiềm năng mới. Cần người dùng duyệt. Số điện thoại gồm 10 chữ số bắt đầu bằng 0.",
  inputSchema: z.object({
    full_name: z.string().min(2).max(100),
    phone: z.string().describe("10 chữ số, bắt đầu bằng 0"),
    source: z.enum(sources).default("khac"),
    interested_course_id: z.uuid().optional().describe("Mã khóa học (uuid) lấy từ list_courses"),
    free_time: z.string().max(200).optional(),
  }),
  needsApproval: true,
});

export const updateLeadDef = toolDefinition({
  name: "update_lead",
  description: "Sửa thông tin một khách (họ tên, số điện thoại, nguồn, khóa quan tâm, thời gian rảnh). Không đổi giai đoạn hay người phụ trách. Cần người dùng duyệt.",
  inputSchema: z.object({
    lead_id: leadId,
    full_name: z.string().min(2).max(100).optional(),
    phone: z.string().optional(),
    source: z.enum(sources).optional(),
    interested_course_id: z.uuid().optional(),
    free_time: z.string().max(200).optional(),
  }),
  needsApproval: true,
});

export const enrollLeadDef = toolDefinition({
  name: "enroll_lead",
  description: "Xếp một khách đã đăng ký vào một lớp (học phí lấy theo khóa của lớp). Cần người dùng duyệt.",
  inputSchema: z.object({
    lead_id: leadId,
    class_id: classId,
    payment_plan: z.enum(["mot_lan", "tra_gop"]),
    second_due_date: date.optional().describe("Hạn đóng đợt 2, chỉ khi trả góp"),
  }),
  needsApproval: true,
});

export const recordPaymentDef = toolDefinition({
  name: "record_payment",
  description: "Ghi nhận một lần học viên đóng học phí (số nguyên đồng). Cần người dùng duyệt.",
  inputSchema: z.object({
    enrollment_id: z.uuid().describe("Mã ghi danh (uuid) lấy từ get_class. KHÔNG tự đặt."),
    amount_vnd: z.number().int().min(1).describe("Số tiền đóng, đơn vị đồng"),
  }),
  needsApproval: true,
});

/** Mọi công cụ cần duyệt: web dùng danh sách này để dựng thẻ xác nhận. */
export const approvalTools = [createTaskDef, updateLeadStageDef, createLeadDef, updateLeadDef, enrollLeadDef, recordPaymentDef] as const;

Object.assign(TOOL_LABELS, {
  add_note: "Ghi chú vào hồ sơ",
  create_task: "Tạo việc",
  update_lead_stage: "Đổi giai đoạn khách",
  create_lead: "Thêm khách",
  update_lead: "Sửa thông tin khách",
  enroll_lead: "Xếp khách vào lớp",
  record_payment: "Ghi nhận học phí",
});

/** Kỹ năng (skills/<tên>/SKILL.md): AI chỉ thấy tên và mô tả; gọi load_skill mới đọc nội dung đầy đủ. */
export const loadSkillDef = toolDefinition({
  name: "load_skill",
  description: "Đọc nội dung đầy đủ của một kỹ năng (quy trình làm việc) khi việc người dùng nhờ khớp với mô tả của kỹ năng đó. Sau khi đọc, làm theo các bước trong kỹ năng.",
  inputSchema: z.object({ name: z.string().min(1).describe("Tên kỹ năng, đúng như trong danh sách kỹ năng có sẵn") }),
});
TOOL_LABELS.load_skill = "Nạp kỹ năng";
