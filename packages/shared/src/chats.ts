import { z } from "zod";
import { uuidField } from "./common.ts";

export const chatQuerySchema = z.object({
  /** Chat gắn với một khách (mở trên hồ sơ khách); bỏ trống = chat chung. */
  leadId: uuidField("Khách không hợp lệ").optional(),
});

export const chatMessageInputSchema = z.object({
  role: z.enum(["user", "assistant"], { error: "Vai trò tin nhắn không hợp lệ" }),
  content: z.string({ error: "Vui lòng nhập nội dung" }).trim().min(1, "Nội dung trống").max(8000, "Nội dung tối đa 8000 ký tự"),
});
export type ChatMessageInput = z.output<typeof chatMessageInputSchema>;

export const chatAppendSchema = z.object({
  leadId: uuidField("Khách không hợp lệ").nullable().optional(),
  messages: z.array(chatMessageInputSchema).min(1, "Không có tin nhắn nào").max(10, "Tối đa 10 tin một lần"),
});

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
