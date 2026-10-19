import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { dropEmpty, taskInputSchema, taskListQuerySchema, taskUpdateSchema } from "@ces/shared";
import { createTask, getTask, listTasks, updateTask } from "../services/tasks.ts";
import type { AuthEnv } from "./guard.ts";
import { readJson } from "./http.ts";

export function taskRoutes(db: DatabaseSync) {
  const r = new Hono<AuthEnv>();
  r.get("/", (c) => c.json(listTasks(db, c.get("user"), taskListQuerySchema.parse(dropEmpty(c.req.query())))));
  r.get("/:id", (c) => c.json(getTask(db, c.get("user"), c.req.param("id"))));
  r.post("/", async (c) => c.json(createTask(db, c.get("user"), taskInputSchema.parse(await readJson(c))), 201));
  r.patch("/:id", async (c) =>
    c.json(updateTask(db, c.get("user"), c.req.param("id"), taskUpdateSchema.parse(await readJson(c)))),
  );
  return r;
}
