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
});