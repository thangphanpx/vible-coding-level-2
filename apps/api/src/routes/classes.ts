import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { enrollmentInputSchema, paymentInputSchema } from "@ces/shared";
import { createEnrollment, getClass, listClasses, recordPayment } from "../services/classes.ts";
import { listCourses } from "../services/courses.ts";
import type { AuthEnv } from "./guard.ts";
import { readJson } from "./http.ts";

export function courseRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.get("/", (c) => c.json(listCourses(db)));
  return r;
}

export function classRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.get("/", (c) => c.json(listClasses(db, c.get("user"))));
  r.get("/:id", (c) => c.json(getClass(db, c.get("user"), c.req.param("id"))));
  return r;
}

export function enrollmentRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.post("/", async (c) => c.json(createEnrollment(db, c.get("user"), enrollmentInputSchema.parse(await readJson(c))), 201));
  r.post("/:id/payments", async (c) =>
    c.json(recordPayment(db, c.get("user"), c.req.param("id"), paymentInputSchema.parse(await readJson(c)))),
  );
  return r;
}
