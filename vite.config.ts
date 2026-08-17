import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: "tallypine-csp",
      transformIndexHtml(html) {
        const connections = command === "serve"
          ? "connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173"
          : "connect-src 'self'";
        return html.replace("__CONNECT_SRC__", connections);
      },
    },
  ],
  base: "./",
  build: {
    target: "chrome138",
    sourcemap: false,
  },
}));
