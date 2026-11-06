---
name: Igualab
description: Manual de identidad suizo para una herramienta de cumplimiento GRI — retícula estricta, azul de marca y secciones numeradas.
colors:
  primary: "#77B9F2"
  on-primary: "#0F1B2A"
  primary-ink: "#1F5F99"
  primary-container: "#D6E9FB"
  surface-tint: "#5AA6E8"
  background: "#F6F9FC"
  surface-container-lowest: "#FFFFFF"
  surface-container-low: "#F3F7FB"
  surface-container-high: "#E2EAF2"
  on-surface: "#0F1B2A"
  on-surface-variant: "#3D4B5C"
  outline: "#5A6878"
  outline-variant: "#C8D3DF"
  rail: "#0F1B2A"
  on-rail: "#E6EEF7"
  on-rail-variant: "#9FB0C3"
  success: "#1E6B3A"
  success-container: "#DDF2E3"
  tertiary: "#8A5A00"
  tertiary-fixed: "#FBE7B5"
  error: "#B3261E"
  error-container: "#FBE0DD"
  dark-background: "#0B1320"
  dark-surface: "#111B2B"
  dark-on-surface: "#E6EEF7"
  dark-primary-ink: "#8EC8F5"
  dark-rail: "#070C14"
typography:
  numeral:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "-0.04em"
  headline-lg:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.02em"
  title-lg:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  body-md:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label-md:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.02em"
  label-sm:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.02em"
rounded:
  DEFAULT: "2px"
  2xl: "4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.DEFAULT}"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.surface-tint}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.outline}"
  button-secondary:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.DEFAULT}"
    height: "48px"
  nav-rail:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.on-rail-variant}"
    width: "260px"
  badge-success:
    backgroundColor: "{colors.success-container}"
    textColor: "{colors.success}"
    typography: "{typography.label-sm}"
---

# Igualab — sistema visual

## Overview

La app es el **manual de normas de Igualab**: cada pantalla es una sección numerada en el orden del flujo de trabajo (01 Asistente → 02 Análisis GRI → 03 Reportes → 04 Descargas para el Administrador; 01–04 de administración para el SuperAdmin). Es una herramienta de trabajo (modo *Operate*): primero claridad y escaneo, después expresión. La marca vive en tres gestos: el **numeral de sección** grande en azul, el **riel oscuro** con la opción actual resaltada y la **tira de etapas** del reporte.

Hay tema claro y oscuro (botón sol/luna en la cabecera y en el acceso). Los colores salen de variables CSS (`--c-*` en `src/index.css`) que Tailwind consume como `rgb(var(--c-x) / <alpha-value>)`: nunca escribas hex en componentes.

## Colors

- **Azul de marca `primary` #77B9F2** es *relleno*: botón principal, opción actual, numerales, etapa en curso. Sobre él, el texto va en tinta `on-primary` (#0F1B2A), nunca en blanco (2.1:1, no se lee).
- **Azul como texto o borde** sobre fondo claro usa `primary-ink` (#1F5F99, 6.7:1). En oscuro, `primary-ink` pasa a #8EC8F5.
- **Riel** `rail` #0F1B2A (oscuro en ambos temas); texto `on-rail` / `on-rail-variant`.
- **Estados** solo donde significan algo: éxito `success` (Activo, Validado, Actualizado), advertencia `tertiary` / `tertiary-fixed` (pendientes), error `error`.
- Todos los pares texto/fondo cumplen WCAG AA en ambos temas.

## Typography

Una sola familia, Inter (servida por la app, sin CDN), con **cifras tabulares** en toda la interfaz (`font-feature-settings: "tnum"`). Jerarquía por tamaño y peso, alineada a la izquierda. Encabezados de tabla y rótulos en versalitas espaciadas (`uppercase tracking-wider`). El numeral de sección (`text-numeral`, 72 px) es decorativo y va con `aria-hidden`.

## Layout

Retícula de 8 px (`xs`–`xl`). Riel fijo de 260 px (72 px colapsado, solo íconos). Cabecera de sección: numeral + título + regla de 2 px en tinta. Contenido en 12 columnas en escritorio (parámetros 4 / trabajo 8) y una columna en móvil, sin desplazamiento horizontal.

## Elevation & Depth

Sin sombras en tarjetas ni tablas: la separación la dan **filetes de 1 px** `outline-variant`. Solo flotan los diálogos, los avisos y el indicador de carga (sombra con desplazamiento y desenfoque).

## Shapes

Esquinas casi rectas (2 px). `rounded-full` solo para controles pequeños circulares. Las etiquetas de estado son rectángulos, en mayúsculas.

## Components

- **Botón principal**: relleno azul, texto tinta, 48 px de alto. **Una sola acción rellena por contexto**; el resto en contorno tinta (`border-on-surface`).
- **Deshabilitado**: gris plano (`surface-container-high` + `outline`), no azul lavado. Un botón ocupado lleva `aria-busy` y conserva su color mientras gira el spinner.
- **Riel de navegación**: numeral + texto; la opción actual es un bloque azul translúcido que se desliza entre opciones.
- **Tira de etapas** (`TiraEtapas`): Revisión → Validación → Emisión → Al día, siempre a la misma escala; la etapa en curso es un bloque azul que se desplaza.
- **Estado vacío guiado** (`GuiaVacia`): frase de qué hacer + pasos numerados que se van marcando.
- **Avisos** (sonner): tarjeta neutra con filete; el color del estado solo en el ícono; siguen el tema.

## Do's and Don'ts

**Sí**
- Animar solo `transform` y `opacity` (y color), con curva `cubic-bezier(0.23, 1, 0.32, 1)` y menos de 300 ms en la interfaz.
- Respetar `prefers-reduced-motion` (MotionConfig `reducedMotion="user"` y las reglas de `index.css`).
- Animar lo ocasional (cambio de tema, portada del acceso, despliegue de filtros); dejar casi quieto lo que se usa decenas de veces al día (navegación).
- Mostrar estados y versiones tal como los entrega el servidor.

**No**
- Hex sueltos, sombras de tarjeta, radios de 12–16 px, etiquetas tipo píldora.
- Texto blanco sobre #77B9F2.
- Varios botones rellenos en el mismo contexto.
- `layoutId` en elementos que se montan y desmontan dentro de una página: retienen la salida de la transición entre páginas. Usa un solo elemento que se desplaza.
- Códigos internos (RN/RF) o jerga técnica en la interfaz.
