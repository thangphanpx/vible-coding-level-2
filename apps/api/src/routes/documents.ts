import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { docSearchSchema, documentInputSchema, dropEmpty } from "@ces/shared";
import { addDocument, deleteDocument, listDocuments, searchDocs } from "../services/documents.ts";
import type { AuthEnv } from "./guard.ts";
import { readJson } from "./http.ts";

/** Kho tri thức: mọi vai trò xem và tìm; chỉ Admin nạp và xóa (service kiểm quyền). */
export function documentRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.get("/", (c) => c.json(listDocuments(db)));
  r.get("/search", (c) => c.json(searchDocs(db, docSearchSchema.parse(dropEmpty(c.req.query())).q)));
  r.post("/", async (c) => c.json(addDocument(db, c.get("user"), documentInputSchema.parse(await readJson(c))), 201));
  r.delete("/:id", (c) => {
    deleteDocument(db, c.get("user"), c.req.param("id"));
    return c.body(null, 204);
  });
  return r;
}
