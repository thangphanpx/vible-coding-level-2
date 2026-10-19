import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { dropEmpty, leadInputSchema, leadListQuerySchema, leadUpdateSchema } from "@ces/shared";
import { createLead, getLead, listLeads, updateLead } from "../services/leads.ts";
import type { AuthEnv } from "./guard.ts";
import { readJson } from "./http.ts";

/** Route chỉ đọc yêu cầu, kiểm bằng Zod rồi gọi service (service kiểm quyền theo người đang đăng nhập). */
export function leadRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.get("/", (c) => c.json(listLeads(db, c.get("user"), leadListQuerySchema.parse(dropEmpty(c.req.query())))));
  r.get("/:id", (c) => c.json(getLead(db, c.get("user"), c.req.param("id"))));
  r.post("/", async (c) => c.json(createLead(db, c.get("user"), leadInputSchema.parse(await readJson(c))), 201));
  r.patch("/:id", async (c) =>
    c.json(updateLead(db, c.get("user"), c.req.param("id"), leadUpdateSchema.parse(await readJson(c)))),
  );
  return r;
}
