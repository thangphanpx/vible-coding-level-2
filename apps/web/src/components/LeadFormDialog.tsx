import { useState, type FormEvent } from "react";
import {
  SOURCES, SOURCE_LABELS, STAGES, STAGE_LABELS, fieldErrors, leadInputSchema,
  type Lead, type Lookups,
} from "@ces/shared";
import { ApiRequestError, api } from "../lib/api";
import { Modal } from "./Modal";
import { Field, inputClass, primaryButton, secondaryButton } from "./ui";

/** Hộp thoại thêm khách (lead = undefined) hoặc sửa khách. */
export function LeadFormDialog({
  lead,
  lookups,
  onClose,
  onSaved,
}: {
  lead?: Lead;
  lookups: Lookups | null;
  onClose: () => void;
  onSaved: (saved: Lead) => void;
}) {
  const [values, setValues] = useState({
    fullName: lead?.fullName ?? "",
    phone: lead?.phone ?? "",
    source: lead?.source ?? "",
    interestedCourseId: lead?.interestedCourseId ?? "",
    stage: lead?.stage ?? "moi",
    ownerId: lead?.ownerId ?? "",
    freeTime: lead?.freeTime ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    // Kiểm bằng Zod ở web (cùng lược đồ với API) trước khi gửi.
    const parsed = leadInputSchema.safeParse({
      ...values,
      interestedCourseId: values.interestedCourseId || null,
      ownerId: values.ownerId || null,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = lead
        ? await api<Lead>("PATCH", `/leads/${lead.id}`, parsed.data)
        : await api<Lead>("POST", "/leads", parsed.data);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields);
        if (Object.keys(err.fields).length === 0) setFormError(err.message);
      } else setFormError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={lead ? "Sửa thông tin khách" : "Thêm khách tiềm năng"} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Họ tên" htmlFor="lead-fullName" required error={errors.fullName}>
          <input id="lead-fullName" className={inputClass} value={values.fullName} onChange={set("fullName")} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Số điện thoại" htmlFor="lead-phone" required error={errors.phone}>
            <input id="lead-phone" className={inputClass} value={values.phone} onChange={set("phone")} inputMode="tel" placeholder="0912345678" />
          </Field>
          <Field label="Nguồn khách" htmlFor="lead-source" required error={errors.source}>
            <select id="lead-source" className={inputClass} value={values.source} onChange={set("source")}>
              <option value="">-- Chọn nguồn --</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Khóa quan tâm" htmlFor="lead-course" error={errors.interestedCourseId}>
            <select id="lead-course" className={inputClass} value={values.interestedCourseId} onChange={set("interestedCourseId")}>
              <option value="">-- Chưa rõ --</option>
              {lookups?.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Giai đoạn" htmlFor="lead-stage" required error={errors.stage}>
            <select id="lead-stage" className={inputClass} value={values.stage} onChange={set("stage")}>
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Người phụ trách" htmlFor="lead-owner" error={errors.ownerId}>
          <select id="lead-owner" className={inputClass} value={values.ownerId} onChange={set("ownerId")}>
            <option value="">-- Chưa giao --</option>
            {lookups?.users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </Field>
        <Field label="Thời gian rảnh" htmlFor="lead-free" error={errors.freeTime}>
          <input id="lead-free" className={inputClass} value={values.freeTime} onChange={set("freeTime")} placeholder="Ví dụ: tối thứ 2, 4, 6" />
        </Field>
        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryButton} onClick={onClose}>Hủy</button>
          <button type="submit" className={primaryButton} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </form>
    </Modal>
  );
}
