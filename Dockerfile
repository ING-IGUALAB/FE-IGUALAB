# ---------- Etapa de build ----------
FROM node:24-alpine AS build
WORKDIR /app

# Instalar dependencias con cache eficiente
COPY package*.json ./
RUN npm ci

# Copiar el código y construir
COPY . .
RUN npm run build

# ---------- Etapa de runtime ----------
FROM nginx:alpine AS runtime

# Config de Nginx con fallback SPA (react-router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Artefactos estáticos del build
COPY --from=build /app/dist /usr/share/nginx/html

# Entrypoint que inyecta las variables de entorno en /env.js AL ARRANCAR.
# nginx:alpine ejecuta automáticamente los scripts de /docker-entrypoint.d/ antes
# de levantar nginx, así que una sola imagen sirve para dev/qa/uat según el .env.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-igualab-env.sh
RUN chmod +x /docker-entrypoint.d/40-igualab-env.sh

EXPOSE 80
# CMD/ENTRYPOINT los aporta la imagen base de nginx.
