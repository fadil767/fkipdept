import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: './',
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: {
    host: true,
    port: 5173,
    watch: {
      ignored: ['**/release/**', '**/dist/**', '**/*.tmp', '**/build/**']
    }
  },
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) return "vendor-charts";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("react") || id.includes("scheduler"))
              return "vendor-react";
          }
        },
      },
    },
  },
});