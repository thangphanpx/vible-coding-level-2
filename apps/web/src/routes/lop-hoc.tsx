import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CLASS_STATUS_LABELS, PAYMENT_PLANS, PAYMENT_PLAN_LABELS, canManageClasses, enrollmentInputSchema, fieldErrors, paymentInputSchema,
  type ClassDetail, type ClassSummary, type ClassStatus, type Enrollment,
} from "@ces/shared";
import { Modal } from "../components/Modal";
import { Badge, Field, formatDate, formatVnd, inputClass, primaryButton, secondaryButton } from "../components/ui";
import { ApiRequestError, api, useFetch, useLookups } from "../lib/api";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/lop-hoc")({
  component: ClassesPage,
});

const statusColor: Record<ClassStatus, "blue" | "green" | "slate"> = { sap_mo: "blue", dang_hoc: "green", ket_thuc: "slate" };

function ClassesPage() {
  const { user } = useAuth();
  const canManage = canManageClasses(user!.role);
  const list = useFetch<ClassSummary[]>("/classes");
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Lớp học</h1>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Lớp</th>
              <th className="px-4 py-3 font-medium">Khóa học</th>
              <th className="px-4 py-3 font-medium">Khai giảng</th>
              <th className="px-4 py-3 font-medium">Giảng viên</th>
              <th className="px-4 py-3 font-medium">Sĩ số</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.error && <tr><td colSpan={7} className="px-4 py-6 text-center text-red-600">{list.error}</td></tr>}
            {!list.error && !list.data && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Đang tải...</td></tr>}
            {list.data?.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3">{c.courseName}</td>
                <td className="px-4 py-3">{formatDate(c.startDate)}</td>
                <td className="px-4 py-3">{c.instructor}</td>
                <td className="px-4 py-3">{c.enrolledCount} / {c.maxSize}</td>
                <td className="px-4 py-3"><Badge color={statusColor[c.status]}>{CLASS_STATUS_LABELS[c.status]}</Badge></td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-sm font-medium text-slate-700 underline hover:text-slate-900" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    {openId === c.id ? "Ẩn học viên" : "Xem học viên"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && <ClassPanel key={openId} id={openId} canManage={canManage} onChanged={list.reload} />}
    </div>
  );
}

function ClassPanel({ id, canManage, onChanged }: { id: string; canManage: boolean; onChanged: () => void }) {
  const detail = useFetch<ClassDetail>(`/classes/${id}`);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Enrollment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const d = detail.data;
  const saved = (msg: string) => {
    setAdding(false);
    setPaying(null);
    setNotice(msg);
    detail.reload();
    onChanged();
  };
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      {detail.error && <p className="text-red-600">{detail.error}</p>}
      {!detail.error && !d && <p className="text-slate-500">Đang tải...</p>}
      {d && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Học viên lớp {d.name}</h2>
            {canManage && d.status !== "ket_thuc" && (
              <button type="button" className={primaryButton} onClick={() => setAdding(true)}>Xếp khách vào lớp</button>
            )}
          </div>
          {notice && <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 font-medium">Học viên</th>
                <th className="py-2 font-medium">Hình thức</th>
                <th className="py-2 font-medium">Đã đóng / Tổng</th>
                <th className="py-2 font-medium">Hạn đợt 2</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {d.enrollments.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Lớp chưa có học viên.</td></tr>}
              {d.enrollments.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-medium text-slate-900">{e.leadName}</td>
                  <td className="py-2">{PAYMENT_PLAN_LABELS[e.paymentPlan]}</td>
                  <td className="py-2">
                    {formatVnd(e.paidVnd)} / {formatVnd(e.totalTuitionVnd)}{" "}
                    {e.paidVnd >= e.totalTuitionVnd ? <Badge color="green">Đủ</Badge> : <Badge color="amber">Còn {formatVnd(e.totalTuitionVnd - e.paidVnd)}</Badge>}
                  </td>
                  <td className="py-2">{e.secondDueDate ? formatDate(e.secondDueDate) : <span className="text-slate-400">Không</span>}</td>
                  <td className="py-2 text-right">
                    {canManage && e.paidVnd < e.totalTuitionVnd && (
                      <button type="button" className="text-sm font-medium text-slate-700 underline hover:text-slate-900" onClick={() => setPaying(e)}>
                        Ghi đóng học phí
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {adding && <EnrollDialog classId={d.id} onClose={() => setAdding(false)} onSaved={(n) => saved(`Đã xếp ${n} vào lớp ${d.name}.`)} />}
          {paying && <PaymentDialog enrollment={paying} onClose={() => setPaying(null)} onSaved={() => saved(`Đã ghi nhận học phí của ${paying.leadName}.`)} />}
        </>
      )}
    </section>
  );
}

function EnrollDialog({ classId, onClose, onSaved }: { classId: string; onClose: () => void; onSaved: (leadName: string) => void }) {
  const lookups = useLookups();
  const [leadId, setLeadId] = useState("");
  const [paymentPlan, setPlan] = useState<string>("");
  const [secondDueDate, setDue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = enrollmentInputSchema.safeParse({ leadId, classId, paymentPlan, secondDueDate: secondDueDate || null });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    try {
      const r = await api<Enrollment>("POST", "/enrollments", parsed.data);
      onSaved(r.leadName);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError("Có lỗi xảy ra, vui lòng thử lại");
    }
  }
  return (
    <Modal title="Xếp khách vào lớp" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Khách đã đăng ký" htmlFor="en-lead" required error={errors.leadId}>
          <select id="en-lead" className={inputClass} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">-- Chọn khách --</option>
            {lookups.data?.leads.map((l) => <option key={l.id} value={l.id}>{l.fullName}</option>)}
          </select>
        </Field>
        <Field label="Hình thức đóng" htmlFor="en-plan" required error={errors.paymentPlan}>
          <select id="en-plan" className={inputClass} value={paymentPlan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">-- Chọn --</option>
            {PAYMENT_PLANS.map((p) => <option key={p} value={p}>{PAYMENT_PLAN_LABELS[p]}</option>)}
          </select>
        </Field>
        {paymentPlan === "tra_gop" && (
          <Field label="Hạn đóng đợt 2" htmlFor="en-due" error={errors.secondDueDate}>
            <input id="en-due" type="date" className={inputClass} value={secondDueDate} onChange={(e) => setDue(e.target.value)} />
          </Field>
        )}
        {errors.classId && <p role="alert" className="text-sm text-red-600">{errors.classId}</p>}
        {formError && !Object.keys(errors).length && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={onClose}>Hủy</button>
          <button type="submit" className={primaryButton}>Xếp lớp</button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentDialog({ enrollment, onClose, onSaved }: { enrollment: Enrollment; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = paymentInputSchema.safeParse({ amountVnd: amount === "" ? undefined : Number(amount) });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    try {
      await api<Enrollment>("POST", `/enrollments/${enrollment.id}/payments`, parsed.data);
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError("Có lỗi xảy ra, vui lòng thử lại");
    }
  }
  return (
    <Modal title={`Ghi đóng học phí: ${enrollment.leadName}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-slate-600">Còn lại {formatVnd(enrollment.totalTuitionVnd - enrollment.paidVnd)}.</p>
        <Field label="Số tiền đóng (đồng)" htmlFor="pay-amount" required error={errors.amountVnd}>
          <input id="pay-amount" inputMode="numeric" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        {formError && !Object.keys(errors).length && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={onClose}>Hủy</button>
          <button type="submit" className={primaryButton}>Ghi nhận</button>
        </div>
      </form>
    </Modal>
  );
}
