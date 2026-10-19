import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { getLookups } from "../services/lookups.ts";

export function lookupRoutes(db: DatabaseSync) {
  const r = new Hono();
  r.get("/", (c) => c.json(getLookups(db)));
  return r;
}
