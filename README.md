# Igualab — Frontend (React + TypeScript + Vite)

Frontend de la plataforma Igualab, construido a partir del mockup navegable y
conectado al backend de la API.

## Requisitos

- Node 18+ (recomendado 20+)
- Backend de Igualab corriendo (por defecto `http://localhost:8000`)

## Configuración (variables de entorno)

`.env` NO se versiona (lo provee cada dev / Jenkins). Cópialo desde la plantilla:

```bash
cp .env.example .env   # backend LOCAL (http://localhost:8000)
```

> Los archivos `.env.<entorno>.example` apuntan a los backends **desplegados**
> (dev/qa/uat). Úsalos para esos ambientes; para desarrollo local contra tu
> propio backend usa `.env.example` (localhost).

Variable disponible:

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend (p. ej. `http://localhost:8000`). Es **pública** (viaja al navegador): no poner secretos. |

Plantillas por entorno versionadas: `.env.development.example`, `.env.qa.example`,
`.env.uat.example`. Cada dev crea su `.env.<entorno>` real a partir de ellas.

## Scripts

```bash
npm install      # instala dependencias
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm run build    # typecheck + build de producción (dist/)
npm run preview  # sirve el build de producción
```

## Docker y despliegue

La app se sirve con Nginx y **consume `VITE_API_URL` en runtime**: una sola imagen
sirve para dev/qa/uat. Al arrancar, `docker-entrypoint.sh` genera `/env.js` con el
valor que reciba el contenedor (vía `env_file`/entorno provisto por Jenkins).

Los despliegues usan un compose por entorno, **sin puertos expuestos** y con salida
a la red externa `proxy_net` (un reverse proxy enruta el dominio al contenedor:80):

- `docker-compose.dev.yml` (rama `development` → dev-igualab.ingsoftware.lat)
- `docker-compose.qa.yml`  (rama `qa` → qa-igualab.ingsoftware.lat)
- `docker-compose.uat.yml` (rama `uat` → uat-igualab.ingsoftware.lat)

Jenkins hace, por rama: `cp <secreto> .env` y `docker compose -f docker-compose.<env>.yml up -d --build`.

**Para desarrollo local NO uses Docker**: corre `npm run dev` (con `.env` apuntando
a `http://localhost:8000`). No se versiona ningún compose con puertos, por política
del despliegue.

Notas:
- Las variables las inyecta **Jenkins** al contenedor (no se hornean en el build):
  la imagen es la misma para todos los entornos.
- Nginx hace fallback SPA (`try_files … /index.html`) para que react-router
  funcione al recargar.
- `env.js` se sirve con `Cache-Control: no-store` para que el cambio de entorno
  tome efecto sin caché.

## Estado de integración con el backend

**Ya conectado a la API real** (`app/api/*`):

- Autenticación: login, logout, recuperar/restablecer contraseña, cambiar mi
  contraseña, expiración de sesión por inactividad (401 → logout automático).
- Gestión de usuarios (solo SuperAdmin): listar, crear, habilitar/deshabilitar,
  transferir rol SuperAdmin.

**Con datos locales de demostración** (el backend aún no expone estos endpoints;
marcados con un aviso "Módulo con datos locales"): Ingesta de documentos,
Análisis y estados GRI, Asistente de IA (RAG), Reportes de prospección,
Descargas y Auditoría. Cuando el backend publique estos endpoints, se reemplaza
la fuente de datos en `src/data/DomainContext.tsx` por llamadas a `src/api/`.

## Estructura

```
src/
  api/         Cliente HTTP + endpoints (auth, usuarios)
  auth/        AuthContext + ProtectedRoute
  components/  UI compartida (Layout, Modal, Badge, KpiCard, ReporteA4, toasts)
  data/        Datos semilla + DomainContext (módulos sin backend aún)
  lib/         Utilidades (token, formato, política de contraseñas)
  pages/       Vistas por ruta
```

## Rutas

- Público: `/login`, `/restablecer?token=...`
- SuperAdmin: `/usuarios`, `/ingesta`, `/auditoria`
- Administrador: `/ia`, `/reportes`, `/descargas`
- Compartida: `/mi-cuenta`
