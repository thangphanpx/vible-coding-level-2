import { serve } from "@hono/node-server";
import { app } from "./app.ts";

const port = Number(process.env.API_PORT ?? 8787);

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`API đang chạy tại http://localhost:${info.port}`);
});
