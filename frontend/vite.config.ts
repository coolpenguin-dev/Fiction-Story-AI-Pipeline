import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Add both common ngrok extensions to be safe
    allowedHosts: [".ngrok-free.app", ".ngrok-free.dev"], 
    hmr: {
      clientPort: 443, 
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});