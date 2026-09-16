# Igualab — Frontend (React + TypeScript + Vite)

Frontend de la plataforma Igualab, construido a partir del mockup navegable y
conectado al backend de la API.

## Requisitos

- Node 18+ (recomendado 20+)
- Backend de Igualab corriendo (por defecto `http://localhost:8000`)

## Configuración

Crea un `.env` a partir de `.env.example`:

```
VITE_API_URL=http://localhost:8000
```

## Scripts

```bash
npm install      # instala dependencias
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm run build    # typecheck + build de producción (dist/)
npm run preview  # sirve el build de producción
```

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
