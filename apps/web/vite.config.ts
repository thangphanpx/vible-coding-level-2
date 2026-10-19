import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const aiTarget = `http://127.0.0.1:${process.env.AI_PORT ?? 8788}`;
const apiTarget = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      // Web gọi /api/xyz -> API nhận /xyz
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      // Web gọi /ai/chat -> dịch vụ AI nhận /chat
      "/ai": {
        target: aiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, ""),
      },
    },
  },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
