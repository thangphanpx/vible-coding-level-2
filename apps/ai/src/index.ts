import { serve } from "@hono/node-server";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { readFileSync } from "node:fs";
import { createAiApp } from "./server.ts";
import { loadSkills } from "./skills.ts";

const port = Number(process.env.AI_PORT ?? 8788);
const apiUrl = process.env.API_URL ?? "http://127.0.0.1:8787";
const apiKey = process.env.AI_API_KEY ?? "";
const baseURL = process.env.AI_BASE_URL ?? "https://api.deepseek.com/v1";
const model = process.env.AI_MODEL ?? "deepseek-chat";

const app = createAiApp({
  apiUrl,
  // Chưa có khóa thì vẫn chạy, chỉ trả 503 khi có người hỏi.
  adapter: () => (apiKey ? openaiCompatibleText(model, { baseURL, apiKey }) : null),
  agentMd: readFileSync(process.env.AGENT_MD_PATH ?? new URL("../AGENT.md", import.meta.url), "utf8"),
  skills: loadSkills(process.env.SKILLS_DIR ?? new URL("../skills/", import.meta.url)),
  serviceKey: process.env.AI_SERVICE_KEY || undefined,
  asksPerHour: Number(process.env.ASKS_PER_HOUR ?? 60),
  origins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000").split(",").map((s) => s.trim()),
});

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`Dịch vụ AI đang chạy tại http://localhost:${info.port} (${apiKey ? `model ${model}` : "CHƯA có AI_API_KEY"})`);
});
