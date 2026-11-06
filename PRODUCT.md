# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **SuperAdmin (equipo Igualab):** gestiona usuarios y roles, el catálogo de empresas, la ingesta de documentos de cada empresa y la auditoría de acciones.
- **Administrador (empresa):** consulta el asistente de IA sobre los documentos, revisa y valida el análisis GRI por año y emite, descarga y consulta el historial de reportes de prospección.

Trabajo de escritorio, en sesiones de oficina; la app también debe poder usarse en pantallas pequeñas sin desplazamiento horizontal.

## Product Purpose

Igualab convierte la documentación pública o entregada por una empresa en un análisis según los estándares GRI y en reportes PDF versionados. El éxito es que un Administrador pase de documentos sueltos a un reporte validado y descargable con confianza en que refleja el análisis vigente.

## Operating Context

- Flujo principal del Administrador: Asistente de IA → Análisis GRI (revisar, validar) → Reportes (vista previa, generar versión, descargar actualizado o histórico) → Descargar reportes (historial de versiones).
- Flujo del SuperAdmin: Usuarios y roles → Catálogo de empresas → Ingesta de documentos → Auditoría.
- La sesión expira tras 2 horas de inactividad.

## Capabilities and Constraints

- Frontend React 18 + TypeScript + Vite + Tailwind; consume el backend de Igualab. El equipo solo es frontend: no se crea backend.
- Los reportes se versionan por validación; una versión emitida nunca cambia.
- Toda la lógica de negocio, los textos visibles y los `aria-label` están cubiertos por pruebas unitarias y e2e (Playwright); un cambio visual no debe alterarlos.
- La interfaz no muestra códigos internos de requisitos (RN/RF) ni jerga técnica.
- Solo un indicador de carga visible a la vez.

## Brand Commitments

- Nombre y logotipo: «Igualab =)» en negro (`public/logo.webp`).
- Color principal confirmado: **#77B9F2**. Sobre ese azul el texto va en un tono oscuro (no blanco) para cumplir contraste.
- Idioma de la interfaz: español.

## Evidence on Hand

- Logo en `public/logo.webp`. No hay fotografías, ilustraciones ni testimonios; no se deben inventar.

## Product Principles

1. Claridad antes que decoración: cada pantalla responde qué puedo hacer ahora y por qué no puedo hacer lo demás.
2. Confianza en el dato: estados, versiones y validaciones se muestran tal como los entrega el servidor, sin deducirlos.
3. Una acción principal por contexto; lo secundario queda visible pero en segundo plano.
4. Profesional y sereno: es una herramienta de trabajo de cumplimiento, no una vitrina.

## Accessibility & Inclusion

Contraste WCAG AA como mínimo, foco visible en todos los controles, navegación por teclado y respeto de `prefers-reduced-motion`.
