import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getDbPath, openDatabase } from "./database.ts";

type Row = Record<string, SQLInputValue>;

/** Ngày "hôm nay" cố định của dữ liệu mẫu (để chạy lại cho kết quả giống nhau). */
const HOM_NAY = new Date("2026-10-19T02:00:00Z");

/** uuid cố định sinh từ tên: chạy seed lại nhiều lần vẫn ra cùng id, không tạo trùng. */
export function uuidFrom(name: string): string {
  const h = createHash("sha1").update(`ces-crm-ai:${name}`).digest("hex");
  const variant = "89ab"[parseInt(h[16], 16) % 4];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function ngayTruoc(soNgay: number, gio = 2): string {
  const d = new Date(HOM_NAY.getTime() - soNgay * 86_400_000);
  d.setUTCHours(gio, (soNgay * 7) % 60, 0, 0);
  return d.toISOString();
}

function ngay(soNgayTuHomNay: number): string {
  return new Date(HOM_NAY.getTime() + soNgayTuHomNay * 86_400_000).toISOString().slice(0, 10);
}

/** Thêm hoặc cập nhật theo id (không đụng created_at của dòng đã có). */
function upsert(db: DatabaseSync, table: string, rows: Row[]): void {
  for (const row of rows) {
    const cols = Object.keys(row);
    const updates = cols.filter((c) => c !== "id" && c !== "created_at").map((c) => `${c} = excluded.${c}`);
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
      ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
    db.prepare(sql).run(...Object.values(row));
  }
}

// ---------- Dữ liệu ----------
const NGUOI_DUNG = [
  ["admin", "quan.nguyen@cesglobal.vn", "Nguyễn Minh Quân", "admin"],
  ["ts", "ha.tran@cesglobal.vn", "Trần Thu Hà", "quan_ly_tuyen_sinh"],
  ["tv1", "nam.le@cesglobal.vn", "Lê Hoàng Nam", "tu_van_vien"],
  ["tv2", "lan.pham@cesglobal.vn", "Phạm Thị Lan", "tu_van_vien"],
  ["tv3", "anh.vu@cesglobal.vn", "Vũ Đức Anh", "tu_van_vien"],
  ["tv4", "phuong.dang@cesglobal.vn", "Đặng Mai Phương", "tu_van_vien"],
  ["tv5", "khoa.bui@cesglobal.vn", "Bùi Anh Khoa", "tu_van_vien"],
  ["tv6", "thao.do@cesglobal.vn", "Đỗ Phương Thảo", "tu_van_vien"],
  ["ql1", "tung.hoang@cesglobal.vn", "Hoàng Thanh Tùng", "quan_ly_lop_hoc"],
  ["ql2", "chau.ngo@cesglobal.vn", "Ngô Bảo Châu", "quan_ly_lop_hoc"],
] as const;

const KHOA_HOC = [
  ["ai", "AI cho người đi làm", 12_000_000, 12, "Dành cho nhân viên văn phòng muốn dùng AI viết email, làm báo cáo, tóm tắt tài liệu. Không cần biết lập trình. Mỗi buổi 2,5 giờ."],
  ["py", "Python cơ bản", 9_000_000, 16, "Dành cho người mới bắt đầu: biến, vòng lặp, hàm, đọc ghi file."],
  ["da", "Phân tích dữ liệu", 10_500_000, 14, "Excel nâng cao, bảng tổng hợp, SQL cơ bản và vẽ biểu đồ; phù hợp nhân viên kinh doanh, kế toán."],
] as const;

const LICH_KHAI_GIANG = [
  ["ai-0803", "ai", "2026-08-03", 25],
  ["ai-0914", "ai", "2026-09-14", 25],
  ["ai-1102", "ai", "2026-11-02", 25],
  ["ai-1214", "ai", "2026-12-14", 25],
  ["py-1116", "py", "2026-11-16", 25],
  ["py-0111", "py", "2027-01-11", 25],
  ["da-1207", "da", "2026-12-07", 25],
] as const;

const LOP_HOC = [
  ["AI-2608", "ai-0803", "Nguyễn Thanh Sơn", "ket_thuc"],
  ["AI-2609", "ai-0914", "Lê Thu Trang", "dang_hoc"],
  ["AI-2611", "ai-1102", "Nguyễn Thanh Sơn", "sap_mo"],
  ["PY-2611", "py-1116", "Phạm Quốc Việt", "sap_mo"],
  ["DA-2612", "da-1207", "Trần Hải Yến", "sap_mo"],
] as const;

type Giai = "moi" | "da_lien_he" | "hen_tu_van" | "dang_ky" | "khong_theo";
type Nguon = "facebook" | "zalo" | "website" | "gioi_thieu" | "su_kien";
// [tên, SĐT, nguồn, khóa quan tâm, giai đoạn, người phụ trách, thời gian rảnh, liên hệ cách đây (ngày; null = chưa), tạo cách đây (ngày)]
const KHACH: [string, string, Nguon, string, Giai, string | null, string, number | null, number][] = [
  ["Nguyễn Văn Hưng", "0912345601", "facebook", "ai", "dang_ky", "tv1", "Tối thứ 2, 4, 6", 85, 100],
  ["Trần Thị Mai Anh", "0912345602", "zalo", "ai", "dang_ky", "tv2", "Cuối tuần", 80, 98],
  ["Lê Quang Huy", "0912345603", "gioi_thieu", "ai", "dang_ky", "tv1", "Sau 19h các ngày trong tuần", 30, 58],
  ["Phạm Ngọc Diệp", "0912345604", "website", "ai", "dang_ky", "tv3", "Tối thứ 3, 5", 25, 55],
  ["Hoàng Minh Tuấn", "0912345605", "facebook", "ai", "dang_ky", "tv4", "Cuối tuần", 22, 48],
  ["Vũ Thị Hồng Nhung", "0912345606", "su_kien", "ai", "dang_ky", "tv2", "Tối thứ 2, 4", 6, 28],
  ["Đỗ Thanh Bình", "0912345607", "zalo", "ai", "dang_ky", "tv5", "Cuối tuần", 4, 25],
  ["Bùi Quốc Khánh", "0912345608", "gioi_thieu", "py", "dang_ky", "tv3", "Tối thứ 3, 5, 7", 5, 30],
  ["Ngô Thị Thu Hiền", "0912345609", "website", "da", "dang_ky", "tv6", "Sau 18h30", 3, 21],
  ["Đặng Văn Long", "0912345610", "facebook", "ai", "hen_tu_van", "tv1", "Chiều thứ 7", 2, 12],
  ["Phan Thị Kim Ngân", "0912345611", "zalo", "da", "hen_tu_van", "tv2", "Tối thứ 2, 3", 1, 9],
  ["Lý Hoàng Phúc", "0912345612", "website", "py", "hen_tu_van", "tv3", "Tối các ngày trong tuần", 3, 14],
  ["Trịnh Thị Bích Ngọc", "0912345613", "facebook", "ai", "hen_tu_van", "tv4", "Cuối tuần", 2, 11],
  ["Dương Minh Châu", "0912345614", "gioi_thieu", "da", "hen_tu_van", "tv5", "Trưa 12h-13h", 1, 8],
  ["Võ Thành Đạt", "0912345615", "su_kien", "ai", "da_lien_he", "tv1", "Sau 20h", 4, 10],
  ["Đinh Thị Hương Giang", "0912345616", "facebook", "ai", "da_lien_he", "tv2", "Tối thứ 4, 6", 6, 13],
  ["Lương Văn Sơn", "0912345617", "zalo", "py", "da_lien_he", "tv3", "Cuối tuần", 9, 16],
  ["Mai Thị Thanh Tâm", "0912345618", "website", "da", "da_lien_he", "tv4", "Tối thứ 2, 5", 5, 12],
  ["Cao Đức Thắng", "0912345619", "facebook", "ai", "da_lien_he", "tv5", "Sau 19h", 17, 30],
  ["Tạ Thị Phương Linh", "0912345620", "gioi_thieu", "ai", "da_lien_he", "tv6", "Chiều thứ 7, CN", 20, 33],
  ["Hồ Văn Quyết", "0912345621", "zalo", "py", "da_lien_he", "tv1", "Tối thứ 3, 5", 15, 26],
  ["Nguyễn Thị Ánh Tuyết", "0912345622", "su_kien", "da", "da_lien_he", "tv2", "Cuối tuần", 12, 24],
  ["Phùng Anh Dũng", "0912345623", "facebook", "ai", "da_lien_he", "tv6", "Tối thứ 2, 4, 6", 28, 45],
  ["Kiều Thị Lan Phương", "0912345624", "website", "ai", "moi", "tv3", "Sau 19h", null, 2],
  ["Châu Văn Tài", "0912345625", "facebook", "py", "moi", "tv4", "Cuối tuần", null, 1],
  ["Lâm Thị Diễm My", "0912345626", "zalo", "da", "moi", "tv5", "Tối thứ 3, 5", null, 3],
  ["Thái Quốc Bảo", "0912345627", "website", "ai", "moi", null, "Chưa rõ", null, 1],
  ["Quách Thị Hà Vy", "0912345628", "facebook", "ai", "moi", null, "Cuối tuần", null, 0],
  ["Từ Minh Hiếu", "0912345629", "su_kien", "py", "moi", null, "Tối các ngày trong tuần", null, 2],
  ["Tống Thị Yến Nhi", "0912345630", "zalo", "da", "moi", "tv6", "Tối thứ 2, 4", null, 4],
  ["Âu Dương Khải", "0912345631", "gioi_thieu", "ai", "da_lien_he", "tv3", "Sau 20h", 8, 19],
  ["La Thị Bảo Trân", "0912345632", "facebook", "ai", "hen_tu_van", "tv5", "Chiều thứ 6", 1, 7],
  ["Ông Văn Thịnh", "0912345633", "website", "py", "khong_theo", "tv1", "Chưa rõ", 35, 60],
  ["Triệu Thị Cẩm Tú", "0912345634", "zalo", "da", "khong_theo", "tv2", "Chưa rõ", 42, 70],
  ["Diệp Quốc Anh", "0912345635", "facebook", "ai", "khong_theo", "tv4", "Chưa rõ", 31, 52],
  ["Văn Thị Mỹ Duyên", "0912345636", "gioi_thieu", "ai", "da_lien_he", "tv4", "Tối thứ 3, 7", 11, 20],
  ["Quản Văn Thái", "0912345637", "website", "da", "da_lien_he", "tv5", "Cuối tuần", 14, 23],
  ["Bạch Thị Xuân Mai", "0912345638", "su_kien", "ai", "hen_tu_van", "tv6", "Tối thứ 5", 2, 10],
  ["Doãn Hữu Nghĩa", "0912345639", "zalo", "py", "da_lien_he", "tv2", "Tối thứ 2, 6", 7, 15],
  ["Khúc Thị Thùy Dương", "0912345640", "facebook", "ai", "moi", "tv1", "Sau 19h30", null, 1],
];

// Ghi danh: [tên khách (chỉ số trong KHACH), lớp, hình thức, tổng học phí, đã đóng, hạn đợt 2]
const GHI_DANH: [number, string, "mot_lan" | "tra_gop", number, number, string | null][] = [
  [0, "AI-2608", "mot_lan", 12_000_000, 12_000_000, null],
  [1, "AI-2608", "tra_gop", 12_000_000, 12_000_000, "2026-09-07"],
  [2, "AI-2609", "mot_lan", 10_800_000, 10_800_000, null],
  [3, "AI-2609", "tra_gop", 12_000_000, 7_200_000, "2026-10-22"],
  [4, "AI-2609", "tra_gop", 10_200_000, 6_120_000, "2026-10-22"],
  [5, "AI-2611", "tra_gop", 12_000_000, 7_200_000, "2026-12-07"],
  [6, "AI-2611", "mot_lan", 10_800_000, 10_800_000, null],
  [7, "PY-2611", "tra_gop", 9_000_000, 5_400_000, "2026-12-21"],
  [8, "DA-2612", "mot_lan", 10_500_000, 0, null],
];

const GHI_CHU_MAU: Record<Giai, [string, string][]> = {
  moi: [],
  da_lien_he: [
    ["cuoc_goi", "Gọi lần đầu, khách đang cân nhắc; hẹn gọi lại để tư vấn kỹ hơn."],
    ["tin_nhan", "Đã nhắn Zalo gửi giới thiệu khóa học và lịch khai giảng gần nhất."],
    ["ghi_chu", "Khách hỏi về học phí và hình thức trả góp."],
  ],
  hen_tu_van: [
    ["cuoc_goi", "Khách đồng ý hẹn tư vấn trực tiếp; đã chốt giờ."],
    ["ghi_chu", "Khách quan tâm ưu đãi đăng ký sớm. Cần chuẩn bị bảng so sánh các khóa."],
    ["tin_nhan", "Đã nhắn xác nhận lịch hẹn và địa chỉ lớp học."],
  ],
  dang_ky: [
    ["cuoc_goi", "Tư vấn xong, khách chốt đăng ký."],
    ["ghi_chu", "Đã chuyển hồ sơ sang quản lý lớp học để xếp lớp và thu học phí."],
    ["tin_nhan", "Đã nhắn xác nhận đăng ký và hướng dẫn đóng học phí."],
  ],
  khong_theo: [
    ["cuoc_goi", "Khách báo chưa có nhu cầu trong thời gian tới."],
    ["ghi_chu", "Đóng hồ sơ: khách chọn đơn vị khác. Có thể chăm sóc lại sau 3 tháng."],
  ],
};

function nap(db: DatabaseSync): Record<string, number> {
  const idNguoi = (k: string) => uuidFrom(`user:${k}`);
  const idKhoa = (k: string) => uuidFrom(`course:${k}`);
  const idLich = (k: string) => uuidFrom(`intake:${k}`);
  const idLop = (k: string) => uuidFrom(`class:${k}`);
  const idKhach = (i: number) => uuidFrom(`lead:${KHACH[i][1]}`);

  upsert(db, "users", NGUOI_DUNG.map(([k, email, full_name, role]) => ({
    id: idNguoi(k), email, full_name, role, active: 1, created_at: ngayTruoc(120),
  })));

  upsert(db, "courses", KHOA_HOC.map(([k, name, tuition_vnd, sessions, description]) => ({
    id: idKhoa(k), name, tuition_vnd, sessions, description, created_at: ngayTruoc(120),
  })));

  upsert(db, "course_intakes", LICH_KHAI_GIANG.map(([k, course, start_date, seats]) => ({
    id: idLich(k), course_id: idKhoa(course), start_date, seats, created_at: ngayTruoc(100),
  })));

  upsert(db, "classes", LOP_HOC.map(([name, intake, instructor, status]) => ({
    id: idLop(name), name, intake_id: idLich(intake), instructor, max_size: 25, status, created_at: ngayTruoc(90),
  })));

  upsert(db, "leads", KHACH.map(([full_name, phone, source, course, stage, owner, free_time, lienHe, tao], i) => ({
    id: idKhach(i), full_name, phone, source, interested_course_id: idKhoa(course), stage,
    owner_id: owner ? idNguoi(owner) : null, free_time,
    last_contacted_at: lienHe === null ? null : ngayTruoc(lienHe, 3),
    created_at: ngayTruoc(tao, 1),
  })));

  upsert(db, "enrollments", GHI_DANH.map(([i, lop, payment_plan, total_tuition_vnd, paid_vnd, second_due_date], k) => ({
    id: uuidFrom(`enrollment:${k}`), lead_id: idKhach(i), class_id: idLop(lop), payment_plan,
    total_tuition_vnd, paid_vnd, second_due_date, created_at: ngayTruoc(Math.max(KHACH[i][8] - 15, 1)),
  })));

  // Hoạt động: mỗi khách đã liên hệ có 1-3 ghi chú mẫu; vài dòng do AI ghi.
  const hoatDong: Row[] = [];
  KHACH.forEach(([, , , , stage, owner, , lienHe, tao], i) => {
    const mau = GHI_CHU_MAU[stage];
    const soDong = stage === "moi" ? 0 : 1 + (i % mau.length);
    for (let j = 0; j < soDong; j++) {
      const [type, content] = mau[j];
      const byAi = (i + j) % 7 === 0 ? 1 : 0;
      hoatDong.push({
        id: uuidFrom(`activity:${i}:${j}`), lead_id: idKhach(i),
        user_id: owner ? idNguoi(owner) : null, type, by_ai: byAi,
        content: byAi ? `${content} (AI tóm tắt từ cuộc trò chuyện)` : content,
        created_at: ngayTruoc(Math.min((lienHe ?? tao) + (soDong - 1 - j) * 3, tao), 4),
      });
    }
  });
  upsert(db, "activities", hoatDong);

  // Việc cần làm
  type Viec = [string, string, number, number | null, string, 0 | 1];
  const viec: Viec[] = [
    ["Gọi lại Đặng Văn Long để chốt lịch tư vấn", "tv1", 0, 9, "goi_lai", 0],
    ["Gửi tài liệu học phí và ưu đãi cho Phan Thị Kim Ngân", "tv2", 0, 10, "gui_tai_lieu", 0],
    ["Gọi lại Lý Hoàng Phúc sau buổi tư vấn", "tv3", 1, 11, "goi_lai", 0],
    ["Gửi lịch khai giảng Python cho Lương Văn Sơn", "tv3", -2, 16, "gui_tai_lieu", 0],
    ["Gọi lại Cao Đức Thắng (đã 17 ngày chưa liên hệ)", "tv5", -1, 18, "goi_lai", 0],
    ["Gọi lại Tạ Thị Phương Linh", "tv6", -3, 19, "goi_lai", 0],
    ["Gọi lại Trịnh Thị Bích Ngọc xác nhận buổi hẹn", "tv4", 2, 12, "goi_lai", 0],
    ["Gửi tài liệu giới thiệu khóa AI cho Võ Thành Đạt", "tv1", 3, 14, "gui_tai_lieu", 0],
    ["Gọi lại Dương Minh Châu", "tv5", 4, 13, "goi_lai", 0],
    ["Gọi lại Kiều Thị Lan Phương lần đầu", "tv3", 0, 23, "goi_lai", 0],
    ["Gọi lại Châu Văn Tài lần đầu", "tv4", 0, 24, "goi_lai", 0],
    ["Gọi lại Lâm Thị Diễm My lần đầu", "tv5", 1, 25, "goi_lai", 0],
    ["Gọi lại Hồ Văn Quyết", "tv1", -5, 20, "goi_lai", 1],
    ["Gửi bảng học phí cho Nguyễn Thị Ánh Tuyết", "tv2", -4, 21, "gui_tai_lieu", 1],
    ["Nhắc Phạm Ngọc Diệp đóng học phí đợt 2 (hạn 22/10)", "ql1", 0, 3, "nhac_hoc_phi", 0],
    ["Nhắc Hoàng Minh Tuấn đóng học phí đợt 2 (hạn 22/10)", "ql1", 0, 4, "nhac_hoc_phi", 0],
    ["Nhắc Vũ Thị Hồng Nhung đóng học phí đợt 2 (hạn 07/12)", "ql2", 46, 5, "nhac_hoc_phi", 0],
    ["Nhắc buổi học đầu tiên lớp AI-2611 cho Đỗ Thanh Bình", "ql2", 13, 6, "nhac_buoi_hoc", 0],
    ["Nhắc buổi học đầu tiên lớp PY-2611 cho Bùi Quốc Khánh", "ql2", 27, 7, "nhac_buoi_hoc", 0],
    ["Gửi phiếu đánh giá cuối khóa cho Nguyễn Văn Hưng", "ql1", -30, 0, "danh_gia_cuoi_khoa", 1],
    ["Gửi phiếu đánh giá cuối khóa cho Trần Thị Mai Anh", "ql1", -30, 1, "danh_gia_cuoi_khoa", 1],
  ];
  upsert(db, "tasks", viec.map(([title, who, hanTuHomNay, khach, type, done], k) => ({
    id: uuidFrom(`task:${k}`), title, due_date: ngay(hanTuHomNay), assignee_id: idNguoi(who),
    lead_id: khach === null ? null : idKhach(khach), type, done, created_at: ngayTruoc(5 + k % 6, 5),
  })));

  // Nhật ký mẫu
  upsert(db, "audit_logs", [
    ["ql1", "ghi_danh", "enrollments", uuidFrom("enrollment:3"), "Ghi danh Phạm Ngọc Diệp vào lớp AI-2609 (trả góp)", 0, 36],
    ["tv1", "doi_giai_doan", "leads", idKhach(9), "Đặng Văn Long: đã liên hệ -> hẹn tư vấn", 0, 9],
    ["tv2", "them_ghi_chu", "activities", uuidFrom("activity:10:0"), "Thêm ghi chú cho Phan Thị Kim Ngân", 1, 8],
    ["ts", "giao_khach", "leads", idKhach(37), "Giao Bạch Thị Xuân Mai cho Đỗ Phương Thảo", 0, 10],
    ["admin", "tao_nguoi_dung", "users", idNguoi("tv6"), "Tạo tài khoản Đỗ Phương Thảo (tư vấn viên)", 0, 100],
    ["tv3", "tao_viec", "tasks", uuidFrom("task:2"), "Tạo việc gọi lại Lý Hoàng Phúc", 1, 3],
    ["ql2", "ghi_nhan_hoc_phi", "enrollments", uuidFrom("enrollment:5"), "Ghi nhận Vũ Thị Hồng Nhung đóng đợt 1: 7.200.000 đồng", 0, 6],
  ].map(([who, action, entity_type, entity_id, detail, by_ai, truoc], k) => ({
    id: uuidFrom(`audit:${k}`), user_id: idNguoi(who as string), action, entity_type, entity_id, detail,
    by_ai, created_at: ngayTruoc(truoc as number, 6),
  } as Row)));

  // Lịch sử trò chuyện mẫu
  upsert(db, "chat_messages", [
    ["tv1", 9, "user", "Tóm tắt giúp tôi hồ sơ khách này.", 2],
    ["tv1", 9, "assistant", "Đặng Văn Long quan tâm khóa AI cho người đi làm, rảnh chiều thứ 7, đã hẹn tư vấn. Bước tiếp theo: gọi xác nhận lịch hẹn.", 2],
    ["ql1", null, "user", "Lớp AI-2609 còn mấy chỗ?", 1],
    ["ql1", null, "assistant", "Lớp AI-2609 có 3 học viên ghi danh, còn 22 chỗ (tối đa 25).", 1],
  ].map(([who, khach, role, content, truoc], k) => ({
    id: uuidFrom(`chat:${k}`), user_id: idNguoi(who as string),
    lead_id: khach === null ? null : idKhach(khach as number), role, content, created_at: ngayTruoc(truoc as number, 8),
  } as Row)));

  // Không nạp sẵn documents/document_chunks: phần kho tri thức sẽ nạp từ tai-lieu-mau/ ở bước sau.
  return demBang(db);
}

export function demBang(db: DatabaseSync): Record<string, number> {
  const bang = ["users", "courses", "course_intakes", "leads", "activities", "tasks", "classes", "enrollments", "documents", "document_chunks", "audit_logs", "chat_messages"];
  return Object.fromEntries(
    bang.map((b) => [b, (db.prepare(`SELECT count(*) AS n FROM ${b}`).get() as { n: number }).n]),
  );
}

/** Nạp dữ liệu mẫu trong một giao dịch; chạy lại nhiều lần không bị trùng. */
export function seed(db: DatabaseSync): Record<string, number> {
  db.exec("BEGIN");
  try {
    const ket = nap(db);
    db.exec("COMMIT");
    return ket;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Chạy trực tiếp: node src/db/seed.ts [--reset]
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  if (process.argv.includes("--reset")) {
    const p = resolve(getDbPath());
    for (const f of [p, `${p}-wal`, `${p}-shm`]) rmSync(f, { force: true });
    console.log("Đã xóa file DB cũ.");
  }
  const db = openDatabase();
  const ket = seed(db);
  console.log(`Đã nạp dữ liệu mẫu vào ${getDbPath()}:`);
  for (const [b, n] of Object.entries(ket)) console.log(`  ${b}: ${n} dòng`);
  db.close();
}
