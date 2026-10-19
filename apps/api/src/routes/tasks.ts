import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { dropEmpty, taskInputSchema, taskListQuerySchema, taskUpdateSchema } from "@ces/shared";
import { createTask, getTask, listTasks, updateTask } from "../services/tasks.ts";
import { readJson } from "./http.ts";

export function taskRoutes(db: DatabaseSync) {
  const r = new Hono();
  r.get("/", (c) => c.json(listTasks(db, taskListQuerySchema.parse(dropEmpty(c.req.query())))));
  r.get("/:id", (c) => c.json(getTask(db, c.req.param("id"))));
  r.post("/", async (c) => c.json(createTask(db, taskInputSchema.parse(await readJson(c))), 201));
  r.patch("/:id", async (c) => c.json(updateTask(db, c.req.param("id"), taskUpdateSchema.parse(await readJson(c)))));
  return r;
}
