/**
 * Configuración central de la aplicación.
 *
 * Orden de resolución de la URL de la API:
 *   1. window.__ENV__.VITE_API_URL  -> inyectada en RUNTIME por el contenedor
 *      (docker-entrypoint genera /env.js a partir de la variable de entorno que
 *      provee docker compose / Jenkins). Permite una sola imagen para dev/qa/uat.
 *   2. import.meta.env.VITE_API_URL -> valor de BUILD-TIME (archivos .env de Vite,
 *      útil en desarrollo con `npm run dev`).
 *   3. Fallback local.
 *
 * Nota: cualquier valor aquí es PÚBLICO (viaja al navegador). No poner secretos.
 */
declare global {
  // eslint-disable-next-line no-var
  var __ENV__: { VITE_API_URL?: string } | undefined;
}

const runtimeEnv = typeof globalThis === "undefined" ? undefined : globalThis.__ENV__;

export const config = {
  /** URL base del backend de Igualab. */
  apiUrl:
    runtimeEnv?.VITE_API_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000",
} as const;

if (import.meta.env.DEV && !runtimeEnv?.VITE_API_URL && !import.meta.env.VITE_API_URL) {
  console.warn("[config] VITE_API_URL no está definida; usando http://localhost:8000");
}
