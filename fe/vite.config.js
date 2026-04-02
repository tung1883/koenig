import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: devProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      },
      "/socket.io": {
        target: devProxyTarget,
        changeOrigin: true,
        ws: true
      }
    }
  }
});
