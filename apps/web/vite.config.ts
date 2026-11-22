import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8790", ws: true } },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: { math: ["katex"], react: ["react", "react-dom"] },
      },
    },
  },
});
