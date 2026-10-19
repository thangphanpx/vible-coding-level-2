import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { DatabaseSync } from "node:sqlite";
import { loginSchema } from "@ces/shared";
import type { AppConfig } from "../config.ts";
import { login, logout } from "../services/auth.ts";
import { requireUser, SESSION_COOKIE, type AuthEnv } from "./guard.ts";
import { readJson } from "./http.ts";

export function authRoutes(db: DatabaseSync, config: AppConfig) {
  const r = new Hono<AuthEnv>();
  const cookieBase = { path: "/", httpOnly: true, sameSite: "Lax", secure: config.cookieSecure } as const;

  r.post("/login", async (c) => {
    const input = loginSchema.parse(await readJson(c));
    const { user, token, expiresAt } = await login(db, config, input.email, input.password);
    setCookie(c, SESSION_COOKIE, token, { ...cookieBase, expires: expiresAt });
    c.header("Cache-Control", "no-store");
    return c.json({ user });
  });

  r.post("/logout", (c) => {
    logout(db, config, getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, cookieBase);
    return c.json({ ok: true });
  });

  r.get("/me", requireUser(db, config), (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ user: c.get("user") });
  });

  return r;
}
