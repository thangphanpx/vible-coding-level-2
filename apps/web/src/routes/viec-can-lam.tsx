import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  TASK_STATUSES, TASK_STATUS_LABELS, TASK_TYPES, TASK_TYPE_LABELS, dropEmpty, taskListQuerySchema,
  type Page, type Task, type TaskListQuery, type TaskStatus, type TaskType,
} from "@ces/shared";
import { TaskFormDialog } from "../components/TaskFormDialog";
import { Badge, Pagination, filterClass, formatDate, inputClass, primaryButton, secondaryButton, todayISO } from "../components/ui";
import { api, queryString, useFetch, useLookups } from "../lib/api";

export const Route = createFileRoute("/viec-can-lam")({
  validateSearch: (raw: Record<string, unknown>): TaskListQuery => {
    const r = taskListQuerySchema.safeParse(dropEmpty(raw));
    return r.success ? r.data : taskListQuerySchema.parse({});
  },
  component: TasksPage,
});

function TasksPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const lookups = useLookups();
  const list = useFetch<Page<Task>>(
    `/tasks${queryString({ page: search.page, q: search.q, type: search.type, status: search.status, assigneeId: search.assigneeId })}`,
  );
  const [qInput, setQInput] = useState(search.q ?? "");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();

  const go = (patch: Partial<TaskListQuery>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== qInput.trim()) go({ q: qInput.trim() || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const data = list.data;
  useEffect(() => {
    if (data && data.page !== search.page) go({ page: data.page });
  }, [data?.page]);

  async function toggleDone(t: Task) {
    setError(null);
    try {
      await api<Task>("PATCH", `/tasks/${t.id}`, { done: !t.done });
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Việc cần làm</h1>
        <button type="button" className={primaryButton} onClick={() => setEditing("new")}>
          Thêm việc
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Tìm theo tiêu đề"
          aria-label="Tìm theo tiêu đề"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <select className={filterClass} aria-label="Lọc theo loại việc" value={search.type ?? ""} onChange={(e) => go({ type: (e.target.value || undefined) as TaskType | undefined, page: 1 })}>
          <option value="">Mọi loại việc</option>
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select className={filterClass} aria-label="Lọc theo trạng thái" value={search.status ?? ""} onChange={(e) => go({ status: (e.target.value || undefined) as TaskStatus | undefined, page: 1 })}>
          <option value="">Mọi trạng thái</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select className={filterClass} aria-label="Lọc theo người làm" value={search.assigneeId ?? ""} onChange={(e) => go({ assigneeId: e.target.value || undefined, page: 1 })}>
          <option value="">Mọi người làm</option>
          {lookups.data?.users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
        {(search.q || search.type || search.status || search.assigneeId) && (
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
      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="w-12 px-4 py-3 font-medium">Xong</th>
              <th className="px-4 py-3 font-medium">Tiêu đề</th>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Hạn</th>
              <th className="px-4 py-3 font-medium">Người làm</th>
              <th className="px-4 py-3 font-medium">Khách liên quan</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.error && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-red-600">
                {list.error}{" "}
                <button type="button" className="underline" onClick={list.reload}>Thử lại</button>
              </td></tr>
            )}
            {!list.error && !data && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Đang tải...</td></tr>
            )}
            {data && data.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Không có việc nào phù hợp.</td></tr>
            )}
            {data?.items.map((t) => {
              const overdue = !t.done && t.dueDate < today;
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} aria-label={`Đánh dấu xong: ${t.title}`} />
                  </td>
                  <td className={`px-4 py-3 font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</td>
                  <td className="px-4 py-3">{TASK_TYPE_LABELS[t.type]}</td>
                  <td className="px-4 py-3">
                    {formatDate(t.dueDate)} {overdue && <Badge color="red">Quá hạn</Badge>}
                  </td>
                  <td className="px-4 py-3">{t.assigneeName ?? <span className="text-slate-400">Chưa giao</span>}</td>
                  <td className="px-4 py-3">{t.leadName ?? <span className="text-slate-400">Không gắn khách</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-sm font-medium text-slate-700 underline hover:text-slate-900" onClick={() => setEditing(t)}>
                      Sửa
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={(p) => go({ page: p })} />
      )}

      {editing && (
        <TaskFormDialog
          key={editing === "new" ? "new" : editing.id}
          task={editing === "new" ? undefined : editing}
          lookups={lookups.data}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setNotice(editing === "new" ? `Đã thêm việc "${saved.title}".` : `Đã lưu việc "${saved.title}".`);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
