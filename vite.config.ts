/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
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
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      // Cobertura sobre la lógica de negocio (unit-testable). La capa de UI
      // (pages/components/contextos) se excluye de la métrica en Sonar.
      include: ["src/lib/**", "src/data/seed.ts", "src/api/client.ts"],
    },
  },
});
