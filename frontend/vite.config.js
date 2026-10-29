import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.NEXUS_API_URL || "http://localhost:8002";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      [
        "/webhook",
        "/stream",
        "/history",
        "/stats",
        "/health",
        "/tickets",
        "/demo",
      ].map((path) => [path, backend]),
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.js"],
    poolOptions: { threads: { singleThread: true } },
  },
});
