import { defineConfig } from "vite";
import path from "path";

const __dirname = path.resolve();

export default defineConfig({
  root: "./",
  publicDir: "public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@utils": path.resolve(__dirname, "./src/utils"),
    },
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(
      process.env.VITE_API_URL || "http://localhost:8787"
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    open: true,
    // Allow externally proxied hosts (Codespaces/GitHub.dev)
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
