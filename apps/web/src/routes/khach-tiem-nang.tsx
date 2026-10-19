import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  SOURCE_LABELS, STAGES, STAGE_LABELS, dropEmpty, leadListQuerySchema,
  type Lead, type LeadListQuery, type Page, type Stage,
} from "@ces/shared";
import { LeadFormDialog } from "../components/LeadFormDialog";
import { Badge, Pagination, filterClass, formatDate, inputClass, primaryButton, secondaryButton } from "../components/ui";
import { queryString, useFetch, useLookups } from "../lib/api";

export const Route = createFileRoute("/khach-tiem-nang")({
  // Bộ lọc nằm trên địa chỉ trang; tham số sai thì quay về mặc định.
  validateSearch: (raw: Record<string, unknown>): LeadListQuery => {
    const r = leadListQuerySchema.safeParse(dropEmpty(raw));
    return r.success ? r.data : leadListQuerySchema.parse({});
  },
  component: LeadsPage,
});

const stageColor: Record<Stage, "slate" | "blue" | "amber" | "green" | "red"> = {
  moi: "blue",
  da_lien_he: "slate",
  hen_tu_van: "amber",
  dang_ky: "green",
  khong_theo: "red",
};

function LeadsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const lookups = useLookups();
  const list = useFetch<Page<Lead>>(
    `/leads${queryString({ page: search.page, q: search.q, stage: search.stage, ownerId: search.ownerId, courseId: search.courseId })}`,
  );
  const [qInput, setQInput] = useState(search.q ?? "");
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (patch: Partial<LeadListQuery>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  // Gõ xong 0,3 giây mới tìm.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== qInput.trim()) go({ q: qInput.trim() || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const data = list.data;
  // Nếu xin trang quá cuối, API trả trang cuối: đồng bộ lại địa chỉ.
  useEffect(() => {
    if (data && data.page !== search.page) go({ page: data.page });
  }, [data?.page]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Khách tiềm năng</h1>
        <button type="button" className={primaryButton} onClick={() => setEditing("new")}>
          Thêm khách
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Tìm theo họ tên hoặc số điện thoại"
          aria-label="Tìm theo họ tên hoặc số điện thoại"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <select className={filterClass} aria-label="Lọc theo giai đoạn" value={search.stage ?? ""} onChange={(e) => go({ stage: (e.target.value || undefined) as Stage | undefined, page: 1 })}>
          <option value="">Mọi giai đoạn</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>
        <select className={filterClass} aria-label="Lọc theo người phụ trách" value={search.ownerId ?? ""} onChange={(e) => go({ ownerId: e.target.value || undefined, page: 1 })}>
          <option value="">Mọi người phụ trách</option>
          <option value="none">Chưa giao</option>
          {lookups.data?.users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
        <select className={filterClass} aria-label="Lọc theo khóa quan tâm" value={search.courseId ?? ""} onChange={(e) => go({ courseId: e.target.value || undefined, page: 1 })}>
          <option value="">Mọi khóa học</option>
          {lookups.data?.courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {(search.q || search.stage || search.ownerId || search.courseId) && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setQInput("");
              navigate({ search: () => ({ page: 1 }), replace: true });
            }}
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {notice && <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Số điện thoại</th>
              <th className="px-4 py-3 font-medium">Nguồn</th>
              <th className="px-4 py-3 font-medium">Khóa quan tâm</th>
              <th className="px-4 py-3 font-medium">Giai đoạn</th>
              <th className="px-4 py-3 font-medium">Người phụ trách</th>
              <th className="px-4 py-3 font-medium">Liên hệ gần nhất</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.error && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-red-600">
                {list.error}{" "}
                <button type="button" className="underline" onClick={list.reload}>Thử lại</button>
              </td></tr>
            )}
            {!list.error && !data && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Đang tải...</td></tr>
            )}
            {data && data.items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Không có khách nào phù hợp.</td></tr>
            )}
            {data?.items.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{l.fullName}</td>
                <td className="px-4 py-3">{l.phone}</td>
                <td className="px-4 py-3">{SOURCE_LABELS[l.source]}</td>
                <td className="px-4 py-3">{l.interestedCourseName ?? <span className="text-slate-400">Chưa rõ</span>}</td>
                <td className="px-4 py-3"><Badge color={stageColor[l.stage]}>{STAGE_LABELS[l.stage]}</Badge></td>
                <td className="px-4 py-3">{l.ownerName ?? <span className="text-slate-400">Chưa giao</span>}</td>
                <td className="px-4 py-3">{l.lastContactedAt ? formatDate(l.lastContactedAt) : <span className="text-slate-400">Chưa liên hệ</span>}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-sm font-medium text-slate-700 underline hover:text-slate-900" onClick={() => setEditing(l)}>
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={(p) => go({ page: p })} />
      )}

      {editing && (
        <LeadFormDialog
          key={editing === "new" ? "new" : editing.id}
          lead={editing === "new" ? undefined : editing}
          lookups={lookups.data}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setNotice(editing === "new" ? `Đã thêm khách ${saved.fullName}.` : `Đã lưu thông tin khách ${saved.fullName}.`);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
