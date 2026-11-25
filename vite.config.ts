import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:3111",
          changeOrigin: true,
        },
      },
    },
    build: { outDir: "dist" },
  };
});
