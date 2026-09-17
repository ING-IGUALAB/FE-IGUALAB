#!/bin/sh
# Genera /env.js en runtime a partir de las variables de entorno del contenedor
# (provistas por docker compose / Jenkins). Así una sola imagen sirve para
# development / qa / uat sin reconstruir.
set -e

: "${VITE_API_URL:=http://localhost:8000}"

TARGET="/usr/share/nginx/html/env.js"

cat > "$TARGET" <<EOF
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL}"
};
EOF

echo "[entrypoint] env.js generado con VITE_API_URL=${VITE_API_URL}"
