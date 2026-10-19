import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { chatAppendSchema, chatQuerySchema, dropEmpty } from "@ces/shared";
import { addChatMessages, clearChat, listChat } from "../services/chats.ts";
import type { AuthEnv } from "./guard.ts";
import { readJson } from "./http.ts";

/** Lịch sử chat với trợ lý AI, riêng từng người dùng. */
export function chatRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.get("/", (c) => {
    const q = chatQuerySchema.parse(dropEmpty(c.req.query()));
    return c.json(listChat(db, c.get("user"), q.leadId ?? null));
  });
  r.post("/", async (c) => {
    const b = chatAppendSchema.parse(await readJson(c));
    return c.json(addChatMessages(db, c.get("user"), b.leadId ?? null, b.messages), 201);
  });
  r.delete("/", (c) => {
    const q = chatQuerySchema.parse(dropEmpty(c.req.query()));
    clearChat(db, c.get("user"), q.leadId ?? null);
    return c.body(null, 204);
  });
  return r;
}
