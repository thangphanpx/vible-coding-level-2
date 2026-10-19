import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { TOOL_LABELS } from "@ces/contracts";
import type { ChatMessage } from "@ces/shared";
import { api, useFetch } from "../lib/api";
import { inputClass, primaryButton, secondaryButton } from "./ui";

const connection = fetchServerSentEvents("/ai/chat");

type Shown = { id: string; role: "user" | "assistant"; text: string; tools: string[] };

/** Khung chat nổi ở góc mọi trang. Đang mở hồ sơ một khách thì chat gắn với khách đó (leadId). */
export function ChatPanel({ leadId }: { leadId: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open ? (
        <ChatBody key={leadId ?? "chung"} leadId={leadId} onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className={`${primaryButton} shadow-lg`} onClick={() => setOpen(true)}>
          Trợ lý AI
        </button>
      )}
    </div>
  );
}

function ChatBody({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const query = leadId ? `?leadId=${leadId}` : "";
  const history = useFetch<ChatMessage[]>(`/chats${query}`);
  // Chỉ dựng cuộc trò chuyện sau khi đã tải xong lịch sử (để khỏi mất tin cũ).
  if (history.error) return <Shell onClose={onClose}><p className="p-4 text-sm text-red-600">{history.error}</p></Shell>;
  if (!history.data) return <Shell onClose={onClose}><p className="p-4 text-sm text-slate-500">Đang tải...</p></Shell>;
  return <Conversation leadId={leadId} saved={history.data} onClose={onClose} />;
}

function Shell({ onClose, children, onClear }: { onClose: () => void; children: React.ReactNode; onClear?: () => void }) {
  return (
    <div className="flex h-[32rem] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-label="Trợ lý AI">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="font-semibold text-slate-900">Trợ lý AI</span>
        <div className="flex gap-3 text-sm">
          {onClear && <button type="button" className="text-slate-500 underline" onClick={onClear}>Xóa lịch sử</button>}
          <button type="button" className="text-slate-500 underline" onClick={onClose}>Thu gọn</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Conversation({ leadId, saved, onClose }: { leadId: string | null; saved: ChatMessage[]; onClose: () => void }) {
  const lastUser = useRef("");
  const { messages, sendMessage, isLoading, error, stop, setMessages } = useChat({
    connection,
    initialMessages: saved.map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text" as const, content: m.content }] })),
    // Gửi kèm khách đang mở để trợ lý biết đang nói về ai.
    body: { leadId },
    onFinish: (message) => {
      const text = message.parts.map((p) => (p.type === "text" ? p.content : "")).join("").trim();
      if (!lastUser.current || !text) return;
      const pair = [{ role: "user", content: lastUser.current }, { role: "assistant", content: text }];
      lastUser.current = "";
      void api("POST", "/chats", { leadId, messages: pair }).catch(() => undefined);
    },
  });
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, isLoading]);

  const shown: Shown[] = messages.map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    text: m.parts.map((p) => (p.type === "text" ? p.content : "")).join(""),
    // Các công cụ AI đã dùng ở lượt này, hiện bằng tên tiếng Việt.
    tools: m.parts.flatMap((p) => (p.type === "tool-call" ? [TOOL_LABELS[p.name] ?? p.name] : [])),
  }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isLoading) return;
    lastUser.current = text;
    setDraft("");
    void sendMessage(text);
  }

  async function clear() {
    await api("DELETE", `/chats${leadId ? `?leadId=${leadId}` : ""}`).catch(() => undefined);
    setMessages([]);
  }

  return (
    <Shell onClose={onClose} onClear={() => void clear()}>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {shown.length === 0 && <p className="text-slate-500">Xin chào! Bạn cần tra cứu hay nhờ tôi làm gì?</p>}
        {shown.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
            {m.tools.length > 0 && <p className="mb-1 text-xs text-slate-500">Đã dùng: {m.tools.join(", ")}</p>}
            <div className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left ${m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
              {m.text || (isLoading ? "…" : "")}
            </div>
          </div>
        ))}
        {error && <p role="alert" className="text-red-600">{error.message}</p>}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-3">
        <input aria-label="Nội dung cần hỏi" className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nhập câu hỏi..." />
        {isLoading ? (
          <button type="button" className={secondaryButton} onClick={stop}>Dừng</button>
        ) : (
          <button type="submit" className={primaryButton}>Gửi</button>
        )}
      </form>
    </Shell>
  );
}
