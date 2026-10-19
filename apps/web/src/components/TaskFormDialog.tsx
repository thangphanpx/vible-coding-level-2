import { useState, type FormEvent } from "react";
import { TASK_TYPES, TASK_TYPE_LABELS, fieldErrors, taskInputSchema, type Lookups, type Task } from "@ces/shared";
import { ApiRequestError, api } from "../lib/api";
import { Modal } from "./Modal";
import { Field, inputClass, primaryButton, secondaryButton } from "./ui";

/** Hộp thoại thêm việc (task = undefined) hoặc sửa việc. */
export function TaskFormDialog({
  task,
  lookups,
  onClose,
  onSaved,
}: {
  task?: Task;
  lookups: Lookups | null;
  onClose: () => void;
  onSaved: (saved: Task) => void;
}) {
  const [values, setValues] = useState({
    title: task?.title ?? "",
    type: task?.type ?? "",
    dueDate: task?.dueDate ?? "",
    assigneeId: task?.assigneeId ?? "",
    leadId: task?.leadId ?? "",
    done: task?.done ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = taskInputSchema.safeParse({
      ...values,
      assigneeId: values.assigneeId || null,
      leadId: values.leadId || null,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = task
        ? await api<Task>("PATCH", `/tasks/${task.id}`, parsed.data)
        : await api<Task>("POST", "/tasks", parsed.data);
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
    <Modal title={task ? "Sửa việc cần làm" : "Thêm việc cần làm"} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Tiêu đề" htmlFor="task-title" required error={errors.title}>
          <input id="task-title" className={inputClass} value={values.title} onChange={set("title")} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Loại việc" htmlFor="task-type" required error={errors.type}>
            <select id="task-type" className={inputClass} value={values.type} onChange={set("type")}>
              <option value="">-- Chọn loại --</option>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Hạn làm" htmlFor="task-due" required error={errors.dueDate}>
            <input id="task-due" type="date" className={inputClass} value={values.dueDate} onChange={set("dueDate")} />
          </Field>
        </div>
        <Field label="Người làm" htmlFor="task-assignee" required error={errors.assigneeId}>
          <select id="task-assignee" className={inputClass} value={values.assigneeId} onChange={set("assigneeId")}>
            <option value="">-- Chọn người làm --</option>
            {lookups?.users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </Field>
        <Field label="Khách liên quan" htmlFor="task-lead" error={errors.leadId}>
          <select id="task-lead" className={inputClass} value={values.leadId} onChange={set("leadId")}>
            <option value="">-- Không gắn khách --</option>
            {lookups?.leads.map((l) => (
              <option key={l.id} value={l.id}>{l.fullName}</option>
            ))}
          </select>
        </Field>
        {task && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={values.done} onChange={(e) => setValues((v) => ({ ...v, done: e.target.checked }))} />
            Đã xong
          </label>
        )}
        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryButton} onClick={onClose}>Hủy</button>
          <button type="submit" className={primaryButton} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </form>
    </Modal>
  );
}
