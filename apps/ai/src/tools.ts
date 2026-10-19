import {
  getClassDef, getLeadDef, listClassesDef, listCoursesDef, listStaleLeadsDef, listTasksDef, searchDocsDef, searchLeadsDef,
} from "@ces/contracts";
import type { Activity, ClassDetail, ClassSummary, Course, Doc, DocHit, Lead, Page, Task } from "@ces/shared";

export type ToolDeps = {
  apiUrl: string;
  /** Cookie đăng nhập của NGƯỜI ĐANG HỎI: mọi công cụ gọi API bằng đúng cookie này, nên chỉ làm được việc người đó làm được. */
  cookie: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
};

/** Gọi API thay mặt người dùng. Lỗi thì ném thông báo ngắn để mô hình đọc được và nói lại cho người dùng. */
export async function callApi<T>(deps: ToolDeps, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await deps.fetch(`${deps.apiUrl}${path}`, {
    method: init.method ?? "GET",
    headers: { cookie: deps.cookie, ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => null)) as { error?: string; fields?: Record<string, string> } | null;
    const detail = e?.fields ? ` (${Object.values(e.fields).join("; ")})` : "";
    throw new Error(`${e?.error ?? `Lỗi ${res.status}`}${detail}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const qs = (p: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

/** Rút gọn hồ sơ khách: chỉ những gì AI cần, luôn kèm lead_id. */
const leadBrief = (l: Lead) => ({
  lead_id: l.id, ho_ten: l.fullName, sdt: l.phone, giai_doan: l.stage, khoa_quan_tam: l.interestedCourseName,
  nguoi_phu_trach: l.ownerName, lien_he_gan_nhat: l.lastContactedAt?.slice(0, 10) ?? null,
});

/** Phần chạy của các công cụ ĐỌC. Khai báo (tên, mô tả, tham số) nằm ở packages/contracts. */
export function createReadTools(deps: ToolDeps) {
  return [
    searchLeadsDef.server(async ({ query, stage }) => {
      const page = await callApi<Page<Lead>>(deps, `/leads${qs({ q: query, stage })}`);
      return { tong: page.total, hien_thi: page.items.length, khach: page.items.map(leadBrief) };
    }),

    getLeadDef.server(async ({ lead_id }) => {
      const [lead, activities, tasks] = await Promise.all([
        callApi<Lead>(deps, `/leads/${lead_id}`),
        callApi<Activity[]>(deps, `/leads/${lead_id}/activities`),
        callApi<Page<Task>>(deps, `/tasks${qs({ leadId: lead_id, status: "open" })}`),
      ]);
      return {
        ...leadBrief(lead),
        nguon: lead.source, thoi_gian_ranh: lead.freeTime,
        hoat_dong_gan_day: activities.slice(0, 10).map((a) => ({ loai: a.type, noi_dung: a.content, do_ai: a.byAi, ngay: a.createdAt.slice(0, 10) })),
        viec_dang_mo: tasks.items.map((t) => ({ task_id: t.id, tieu_de: t.title, han: t.dueDate, loai: t.type })),
      };
    }),

    listStaleLeadsDef.server(async ({ days }) => {
      const page = await callApi<Page<Lead>>(deps, `/leads${qs({ staleDays: days })}`);
      return { tong: page.total, hien_thi: page.items.length, khach: page.items.map(leadBrief) };
    }),

    listTasksDef.server(async ({ status, lead_id }) => {
      const page = await callApi<Page<Task>>(deps, `/tasks${qs({ status, leadId: lead_id })}`);
      return {
        tong: page.total,
        viec: page.items.map((t) => ({ task_id: t.id, tieu_de: t.title, han: t.dueDate, loai: t.type, xong: t.done, nguoi_lam: t.assigneeName, khach: t.leadName })),
      };
    }),

    listCoursesDef.server(async () => {
      const courses = await callApi<Course[]>(deps, "/courses");
      return courses.map((c) => ({ course_id: c.id, ten: c.name, hoc_phi_dong: c.tuitionVnd, so_buoi: c.sessions, khai_giang: c.intakes.map((i) => i.startDate) }));
    }),

    listClassesDef.server(async () => {
      const classes = await callApi<ClassSummary[]>(deps, "/classes");
      return classes.map((c) => ({
        class_id: c.id, ten: c.name, khoa: c.courseName, khai_giang: c.startDate, giang_vien: c.instructor,
        si_so: c.enrolledCount, toi_da: c.maxSize, trang_thai: c.status,
      }));
    }),

    getClassDef.server(async ({ class_id }) => {
      const c = await callApi<ClassDetail>(deps, `/classes/${class_id}`);
      return {
        class_id: c.id, ten: c.name, si_so: c.enrolledCount, toi_da: c.maxSize, trang_thai: c.status,
        hoc_vien: c.enrollments.map((e) => ({
          enrollment_id: e.id, lead_id: e.leadId, ho_ten: e.leadName, hinh_thuc: e.paymentPlan, da_dong: e.paidVnd,
          tong_hoc_phi: e.totalTuitionVnd, con_thieu: e.totalTuitionVnd - e.paidVnd, han_dot_2: e.secondDueDate,
        })),
      };
    }),

    searchDocsDef.server(async ({ query }) => {
      const hits = await callApi<DocHit[]>(deps, `/documents/search?q=${encodeURIComponent(query)}`);
      if (hits.length === 0) return { found: false, message: "Không có đoạn tài liệu nào phù hợp." };
      return { found: true, hits: hits.map((h) => ({ source: h.source, heading: h.heading, text: h.content })) };
    }),
  ];
}

export type { Doc };
