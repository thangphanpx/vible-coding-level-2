import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { getLookups } from "../services/lookups.ts";
import type { AuthEnv } from "./guard.ts";

export function lookupRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.get("/", (c) => c.json(getLookups(db, c.get("user"))));
  return r;
}
