import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { DocHit } from "@ces/shared";

export type ToolDeps = {
  apiUrl: string;
  /** Cookie đăng nhập của NGƯỜI ĐANG HỎI: mọi công cụ gọi API bằng đúng cookie này, nên chỉ làm được việc người đó làm được. */
  cookie: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
};

/** Gọi API thay mặt người dùng. Lỗi thì ném thông báo ngắn để mô hình đọc được và nói lại cho người dùng. */
async function callApi<T>(deps: ToolDeps, path: string): Promise<T> {
  const res = await deps.fetch(`${deps.apiUrl}${path}`, { headers: { cookie: deps.cookie } });
  if (!res.ok) {
    const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Lỗi ${res.status}`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const searchDocsDef = toolDefinition({
  name: "search_docs",
  description:
    "Tìm trong kho tài liệu của công ty (chính sách học phí, ưu đãi, hoàn phí, bảo lưu, giới thiệu khóa học, quy trình chăm sóc). " +
    "Dùng MỖI KHI người dùng hỏi về chính sách hay thông tin có thể nằm trong tài liệu. Trả tối đa 5 đoạn kèm tên nguồn.",
  inputSchema: z.object({ query: z.string().min(1).describe("Câu hỏi hoặc từ khóa cần tìm, tiếng Việt") }),
});

export function createTools(deps: ToolDeps) {
  const searchDocs = searchDocsDef.server(async ({ query }) => {
    const hits = await callApi<DocHit[]>(deps, `/documents/search?q=${encodeURIComponent(query)}`);
    if (hits.length === 0) return { found: false, message: "Không có đoạn tài liệu nào phù hợp." };
    return { found: true, hits: hits.map((h) => ({ source: h.source, heading: h.heading, text: h.content })) };
  });
  return [searchDocs];
}
