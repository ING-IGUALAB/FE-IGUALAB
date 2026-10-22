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

# Origen del backend (esquema://host[:puerto]) para la directiva connect-src de la CSP.
# Solo se aceptan caracteres de URL simples para no poder inyectar nada en la config de nginx.
API_ORIGEN=$(printf '%s' "$VITE_API_URL" | sed -nE 's#^(https?://[A-Za-z0-9.-]+(:[0-9]+)?).*#\1#p')
echo "set \$igualab_api \"${API_ORIGEN}\";" > /etc/nginx/igualab-api.conf
echo "[entrypoint] CSP connect-src: 'self' ${API_ORIGEN}"
