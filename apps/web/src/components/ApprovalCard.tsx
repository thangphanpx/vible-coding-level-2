import { useState } from "react";
import { TOOL_LABELS } from "@ces/contracts";
import { PAYMENT_PLAN_LABELS, STAGE_LABELS, TASK_TYPE_LABELS, type Lead, type PaymentPlan, type Stage, type TaskType } from "@ces/shared";
import { useFetch } from "../lib/api";
import { formatVnd, primaryButton, secondaryButton } from "./ui";

type Args = Record<string, any>;

/** Một câu tiếng Việt nói rõ AI sắp làm gì (người duyệt đọc câu này, không đọc JSON). */
export function describeApproval(tool: string, a: Args, leadName?: string): string {
  const khach = leadName ?? "khách (không rõ)";
  switch (tool) {
    case "create_task":
      return `Tạo việc "${a.title}" (${TASK_TYPE_LABELS[a.type as TaskType] ?? a.type}), hạn ${a.due_date}${a.lead_id ? `, liên quan ${khach}` : ""}.`;
    case "update_lead_stage":
      return `Đổi giai đoạn của ${khach} sang "${STAGE_LABELS[a.stage as Stage] ?? a.stage}".`;
    case "create_lead":
      return `Thêm khách mới: ${a.full_name}, số điện thoại ${a.phone}.`;
    case "update_lead": {
      const doi = Object.entries({ "họ tên": a.full_name, "số điện thoại": a.phone, "nguồn": a.source, "thời gian rảnh": a.free_time })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k} → ${v}`);
      return `Sửa thông tin của ${khach}: ${doi.join("; ") || "(không có thay đổi)"}.`;
    }
    case "enroll_lead":
      return `Xếp ${khach} vào lớp, ${PAYMENT_PLAN_LABELS[a.payment_plan as PaymentPlan] ?? a.payment_plan}${a.second_due_date ? `, hạn đợt 2 ${a.second_due_date}` : ""}.`;
    case "record_payment":
      return `Ghi nhận học viên đóng ${typeof a.amount_vnd === "number" ? formatVnd(a.amount_vnd) : a.amount_vnd} học phí.`;
    default:
      return TOOL_LABELS[tool] ?? tool;
  }
}

/**
 * Thẻ "AI xin phép": hiện việc AI sắp làm và hai nút. Chỉ khi bấm Duyệt thì dịch vụ AI mới gọi API.
 * Nếu AI nêu một khách không có thật (mã bịa) thì nút Duyệt bị khóa.
 */
export function ApprovalCard({
  toolName, args, onResolve,
}: {
  toolName: string;
  args: Args;
  onResolve: (approved: boolean) => void;
}) {
  const leadId = typeof args.lead_id === "string" ? args.lead_id : null;
  const lead = useFetch<Lead>(leadId ? `/leads/${leadId}` : null);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const missingLead = !!leadId && !lead.loading && !!lead.error;
  const resolve = (approved: boolean) => {
    if (chosen !== null) return; // bấm hai lần vẫn chỉ tính một lần
    setChosen(approved);
    onResolve(approved);
  };
  return (
    <div role="group" aria-label="AI xin phép" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">AI xin phép: {TOOL_LABELS[toolName] ?? toolName}</p>
      <p className="mt-1 text-slate-900">{describeApproval(toolName, args, leadId ? lead.data?.fullName : undefined)}</p>
      {missingLead && <p role="alert" className="mt-1 text-red-700">Không tìm thấy khách này trong danh sách của bạn. Hãy bấm Từ chối.</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className={primaryButton} disabled={chosen !== null || missingLead || (!!leadId && lead.loading)} onClick={() => resolve(true)}>Duyệt</button>
        <button type="button" className={secondaryButton} disabled={chosen !== null} onClick={() => resolve(false)}>Từ chối</button>
      </div>
      {chosen !== null && <p className="mt-2 text-slate-600">{chosen ? "Đã duyệt, đang thực hiện..." : "Đã từ chối."}</p>}
    </div>
  );
}
