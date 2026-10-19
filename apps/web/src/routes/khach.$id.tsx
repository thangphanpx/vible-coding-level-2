import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ACTIVITY_LABELS, ACTIVITY_TYPES, SOURCE_LABELS, STAGE_LABELS, activityInputSchema, fieldErrors,
  type Activity, type Lead,
} from "@ces/shared";
import { Badge, Field, formatDate, inputClass, primaryButton } from "../components/ui";
import { ApiRequestError, api, useFetch } from "../lib/api";

export const Route = createFileRoute("/khach/$id")({
  component: LeadDetailPage,
});

/** Hồ sơ một khách: thông tin, lịch sử hoạt động, ô thêm ghi chú / cuộc gọi / tin nhắn. */
function LeadDetailPage() {
  const { id } = Route.useParams();
  const lead = useFetch<Lead>(`/leads/${id}`);
  const acts = useFetch<Activity[]>(`/leads/${id}/activities`);
  const [type, setType] = useState("ghi_chu");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = activityInputSchema.safeParse({ type, content });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    try {
      await api<Activity>("POST", `/leads/${id}/activities`, parsed.data);
      setContent("");
      acts.reload();
      lead.reload();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError("Có lỗi xảy ra, vui lòng thử lại");
    }
  }

  if (lead.error) {
    return (
      <div role="alert">
        <h1 className="text-2xl font-semibold text-slate-900">Không tìm thấy khách</h1>
        <p className="mt-2 text-slate-600">{lead.error}</p>
        <Link to="/khach-tiem-nang" search={{ page: 1 }} className="mt-4 inline-block underline">Về danh sách khách</Link>
      </div>
    );
  }
  const l = lead.data;
  return (
    <div>
      <Link to="/khach-tiem-nang" search={{ page: 1 }} className="text-sm text-slate-500 underline">← Danh sách khách</Link>
      {!l && <p className="mt-4 text-slate-500">Đang tải...</p>}
      {l && (
        <>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{l.fullName}</h1>
            <Badge color={l.stage === "dang_ky" ? "green" : "blue"}>{STAGE_LABELS[l.stage]}</Badge>
          </div>
          <dl className="mt-4 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <Item label="Số điện thoại" value={l.phone} />
            <Item label="Nguồn" value={SOURCE_LABELS[l.source]} />
            <Item label="Khóa quan tâm" value={l.interestedCourseName ?? "Chưa rõ"} />
            <Item label="Người phụ trách" value={l.ownerName ?? "Chưa giao"} />
            <Item label="Thời gian rảnh" value={l.freeTime ?? "Chưa rõ"} />
            <Item label="Liên hệ gần nhất" value={l.lastContactedAt ? formatDate(l.lastContactedAt) : "Chưa liên hệ"} />
          </dl>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Hoạt động</h2>
          <form onSubmit={submit} noValidate className="mt-3 max-w-3xl space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex gap-3">
              <select aria-label="Loại hoạt động" className={`${inputClass} max-w-40`} value={type} onChange={(e) => setType(e.target.value)}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}
              </select>
              <div className="flex-1">
                <Field label="Nội dung" htmlFor="act-content" error={errors.content}>
                  <textarea id="act-content" rows={2} className={inputClass} value={content} onChange={(e) => setContent(e.target.value)} />
                </Field>
              </div>
            </div>
            {formError && !errors.content && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <button type="submit" className={primaryButton}>Thêm hoạt động</button>
          </form>

          <ul className="mt-4 max-w-3xl space-y-3">
            {acts.data?.length === 0 && <li className="text-sm text-slate-500">Chưa có hoạt động nào.</li>}
            {acts.data?.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Badge color="slate">{ACTIVITY_LABELS[a.type]}</Badge>
                  {a.byAi && <Badge color="amber">Do AI ghi</Badge>}
                  <span>{a.userName ?? "Hệ thống"} · {formatDate(a.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-800">{a.content}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
