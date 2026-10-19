import { Hono } from "hono";
import { chat, chatParamsFromRequestBody, maxIterations, toServerSentEventsResponse } from "@tanstack/ai";
import type { AnyTextAdapter } from "@tanstack/ai/adapters";
import type { SessionUser } from "@ces/shared";

export type AiAppOptions = {
  /** Địa chỉ API CRM, ví dụ http://127.0.0.1:8787 */
  apiUrl: string;
  /** Trả về bộ nối với mô hình AI; null khi chưa cấu hình AI_API_KEY (dịch vụ trả 503, không sập). */
  adapter: () => AnyTextAdapter | null;
  /** Mỗi người được hỏi tối đa bấy nhiêu lượt mỗi giờ (tránh tốn tiền). */
  asksPerHour: number;
  /** Thay được trong kiểm thử để gọi thẳng vào API, khỏi mở cổng mạng. */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Địa chỉ web được phép gọi dịch vụ này từ trình duyệt (kiểm Origin). */
  origins?: string[];
};

const SYSTEM_PROMPT =
  "Bạn là trợ lý của CES CRM AI. Luôn trả lời bằng tiếng Việt, ngắn gọn, rõ ràng. Không biết thì nói không biết.";

/**
 * Dịch vụ AI: KHÔNG có database riêng. Mỗi lượt chat nó hỏi API xem cookie đăng nhập là của ai,
 * rồi mới gọi mô hình. Khóa AI chỉ nằm ở đây, không bao giờ xuống trình duyệt.
 */
export function createAiApp(opts: AiAppOptions) {
  const doFetch = opts.fetch ?? fetch;
  const asks = new Map<string, number[]>();

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

    const stream = chat({
      adapter,
      messages: params.messages,
      systemPrompts: [SYSTEM_PROMPT],
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
