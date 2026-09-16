import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // No saltar a otro puerto si 5173 está ocupado: el backend solo permite CORS
    // para 5173. Si está tomado, Vite fallará con un error claro en vez de usar 5174.
    strictPort: true,
  },
});
