/**
 * Configuración central de la aplicación.
 *
 * Los valores se leen de variables de entorno de Vite (prefijo VITE_), definidas
 * en `.env` (local, git-ignored) o `.env.example` (plantilla versionada).
 *
 * Nota: cualquier variable VITE_ se incrusta en el bundle del navegador, así que
 * NO deben guardarse secretos aquí (claves, tokens de servidor). La URL de la API
 * es pública por naturaleza; esto es sólo para hacerla configurable por entorno.
 */
export const config = {
  /** URL base del backend de Igualab. */
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
} as const;

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  // Aviso en desarrollo si falta la variable (se usa el valor por defecto).
  console.warn("[config] VITE_API_URL no está definida; usando http://localhost:8000");
}
