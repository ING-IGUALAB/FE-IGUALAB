// Placeholder de configuración en runtime.
// En producción/contenedor, docker-entrypoint.sh SOBREESCRIBE este archivo con
// los valores reales tomados de las variables de entorno (Jenkins / docker compose).
// En desarrollo (npm run dev) queda vacío y la app usa import.meta.env (archivos .env).
window.__ENV__ = window.__ENV__ || {};
