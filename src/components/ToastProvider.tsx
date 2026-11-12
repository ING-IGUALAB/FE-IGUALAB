import { type CSSProperties, type ReactNode } from "react";
import { useTema } from "./useTema";
import { Toaster, toast as sonner } from "sonner";

type ToastTipo = "success" | "error" | "info" | "warn";

/**
 * Envuelve la app con el Toaster de sonner. `useToast()` devuelve una función
 * compatible con el resto del código: toast(mensaje, tipo).
 */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { tema } = useTema();
  return (
    <>
      {children}
      {/* Avisos con los colores de la app (siguen el tema claro/oscuro): fondo de tarjeta, filete y
          el color del estado solo en el ícono. Entran y salen siempre por arriba. */}
      <Toaster
        position="top-center"
        theme={tema === "oscuro" ? "dark" : "light"}
        closeButton
        style={ESTILO_AVISOS}
        toastOptions={{
          style: { fontFamily: "Inter, system-ui, sans-serif", borderRadius: "2px", boxShadow: "0 12px 32px -12px rgba(15, 27, 42, 0.35)" },
        }}
      />
    </>
  );
}

const ESTILO_AVISOS = {
  "--normal-bg": "rgb(var(--c-surface-container-lowest))",
  "--normal-border": "rgb(var(--c-outline-variant))",
  "--normal-text": "rgb(var(--c-on-surface))",
} as CSSProperties;

// Referencia ESTABLE: sonner es un singleton de módulo, así que la función no
// necesita recrearse por render. Devolver siempre la misma referencia evita que
// los `useEffect`/`useCallback` que dependen de `toast` entren en bucle infinito.
function emitirToast(msg: string, tipo: ToastTipo = "info") {
  if (tipo === "success") return sonner.success(msg);
  if (tipo === "error") return sonner.error(msg);
  if (tipo === "warn") return sonner.warning(msg);
  return sonner.info(msg);
}

export function useToast() {
  return emitirToast;
}
