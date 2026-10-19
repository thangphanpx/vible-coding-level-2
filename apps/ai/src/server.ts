import { Hono } from "hono";
import { chat, chatParamsFromRequestBody, maxIterations, toServerSentEventsResponse } from "@tanstack/ai";
import type { AnyTextAdapter } from "@tanstack/ai/adapters";
import type { Lead, SessionUser } from "@ces/shared";
import { skillIndexPrompt, type Skill } from "./skills.ts";
import { callApi, createReadTools, createSkillTool, createWriteTools, type ToolDeps } from "./tools.ts";

export type AiAppOptions = {
  /** Địa chỉ API CRM, ví dụ http://127.0.0.1:8787 */
  apiUrl: string;
  /** Trả về bộ nối với mô hình AI; null khi chưa cấu hình AI_API_KEY (dịch vụ trả 503, không sập). */
  adapter: () => AnyTextAdapter | null;
  /** Mỗi người được hỏi tối đa bấy nhiêu lượt mỗi giờ (tránh tốn tiền). */
  asksPerHour: number;
  /** Thay được trong kiểm thử để gọi thẳng vào API, khỏi mở cổng mạng. */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Nội dung AGENT.md: tính cách, luật của trợ lý. Nạp vào MỌI lượt. */
  agentMd: string;
  /** Các kỹ năng đã đọc từ thư mục skills/ (chỉ tên và mô tả vào prompt; nội dung nạp khi AI gọi load_skill). */
  skills: Skill[];
  /** Khóa dịch vụ gửi kèm khi gọi API để nhật ký ghi "do AI làm". Có thể bỏ trống. */
  serviceKey?: string;
  /** Địa chỉ web được phép gọi dịch vụ này từ trình duyệt (kiểm Origin). */
  origins?: string[];
};


/**
 * Ngữ cảnh của lượt này: ngày giờ, người đang hỏi, và khách đang mở trên màn hình (nếu có).
 * Khách đang mở được kiểm bằng chính cookie của người hỏi: ngoài phạm vi thì coi như không có.
 */
async function contextPrompt(deps: ToolDeps, user: SessionUser, forwarded: Record<string, unknown>): Promise<string> {
  const lines = [`Hôm nay: ${new Date().toISOString().slice(0, 10)}. Người đang hỏi: ${user.fullName} (vai trò ${user.role}).`];
  const id = typeof forwarded?.leadId === "string" ? forwarded.leadId : null;
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    try {
      const lead = await callApi<Lead>(deps, `/leads/${id}`);
      lines.push(`Đang mở hồ sơ khách: ${lead.fullName} (lead_id: ${lead.id}). "Khách này", "anh/chị ấy" là khách này.`);
    } catch {
      // Khách không tồn tại hoặc ngoài phạm vi: bỏ qua, không tiết lộ gì.
    }
  }
  return lines.join("\n");
}

/**
 * Dịch vụ AI: KHÔNG có database riêng. Mỗi lượt chat nó hỏi API xem cookie đăng nhập là của ai,
 * rồi mới gọi mô hình. Khóa AI chỉ nằm ở đây, không bao giờ xuống trình duyệt.
 */
export function createAiApp(opts: AiAppOptions) {
  const doFetch = opts.fetch ?? fetch;
  const asks = new Map<string, number[]>();
  /** Các lệnh ghi đã chạy (theo mã lệnh gọi công cụ): chạy lần hai trả lại kết quả cũ thay vì ghi trùng. */
  const done = new Map<string, Promise<unknown>>();
  const once = <T>(key: string, run: () => Promise<T>): Promise<T> => {
    if (!done.has(key)) {
      done.set(key, run());
      if (done.size > 2000) done.delete(done.keys().next().value!);
    }
    return done.get(key) as Promise<T>;
  };

  /** Hỏi API: cookie này là ai? (API vẫn là nơi duy nhất quyết định đăng nhập). */
  async function whoAmI(cookie: string | undefined): Promise<SessionUser | null> {
    if (!cookie) return null;
    try {
      const res = await doFetch(`${opts.apiUrl}/auth/me`, { headers: { cookie } });
      return res.ok ? ((await res.json()) as { user: SessionUser }).user : null;
    } catch {
      return null;
    }
  }

  function allowed(userId: string): boolean {
    const since = Date.now() - 3_600_000;
    const recent = (asks.get(userId) ?? []).filter((t) => t > since);
    if (recent.length >= opts.asksPerHour) {
      asks.set(userId, recent);
      return false;
    }
    asks.set(userId, [...recent, Date.now()]);
    return true;
  }

  const app = new Hono();
  app.get("/health", (c) => c.text("ok"));

  app.post("/chat", async (c) => {
    // Chặn trang lạ gọi thay người dùng: có Origin thì phải nằm trong danh sách cho phép.
    const origin = c.req.header("origin");
    if (opts.origins && origin !== undefined && !opts.origins.includes(origin)) {
      return c.json({ error: "Yêu cầu bị từ chối vì nguồn gửi không hợp lệ" }, 403);
    }
    const user = await whoAmI(c.req.header("cookie"));
    if (!user) return c.json({ error: "Vui lòng đăng nhập" }, 401);

    const adapter = opts.adapter();
    if (!adapter) return c.json({ error: "Chưa cấu hình AI_API_KEY cho dịch vụ AI" }, 503);

    let params;
    try {
      params = await chatParamsFromRequestBody(await c.req.json());
    } catch {
      return c.json({ error: "Nội dung yêu cầu không hợp lệ" }, 400);
    }
    if (!allowed(user.id)) return c.json({ error: "Bạn đã hỏi quá nhiều lượt trong một giờ, vui lòng thử lại sau" }, 429);

    const deps: ToolDeps = { apiUrl: opts.apiUrl, cookie: c.req.header("cookie")!, fetch: doFetch, userId: user.id, serviceKey: opts.serviceKey, once };
    const stream = chat({
      adapter,
      messages: params.messages,
      systemPrompts: [opts.agentMd, skillIndexPrompt(opts.skills), await contextPrompt(deps, user, params.forwardedProps)].filter(Boolean),
      tools: [...createReadTools(deps), ...createWriteTools(deps), ...createSkillTool(opts.skills)],
      agentLoopStrategy: maxIterations(8),
      // Các mã này nối các lượt của cùng một cuộc trò chuyện (bắt buộc truyền lại, nếu không thẻ xác nhận sẽ hỏng).
      threadId: params.threadId,
      runId: params.runId,
      parentRunId: params.parentRunId,
      resume: params.resume,
    });
    return toServerSentEventsResponse(stream);
  });

  return app;
}
