import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { dropEmpty, leadInputSchema, leadListQuerySchema, leadUpdateSchema } from "@ces/shared";
import { createLead, getLead, listLeads, updateLead } from "../services/leads.ts";
import { readJson } from "./http.ts";

/** Route chỉ đọc yêu cầu, kiểm bằng Zod rồi gọi service. */
export function leadRoutes(db: DatabaseSync) {
  const r = new Hono();
  r.get("/", (c) => c.json(listLeads(db, leadListQuerySchema.parse(dropEmpty(c.req.query())))));
  r.get("/:id", (c) => c.json(getLead(db, c.req.param("id"))));
  r.post("/", async (c) => c.json(createLead(db, leadInputSchema.parse(await readJson(c))), 201));
  r.patch("/:id", async (c) => c.json(updateLead(db, c.req.param("id"), leadUpdateSchema.parse(await readJson(c)))));
  return r;
}
