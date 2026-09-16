import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    watch: {
      ignored: ['**/release/**', '**/dist/**', '**/*.tmp', '**/build/**']
    }
  },
  plugins: [react(), tailwindcss()],
});