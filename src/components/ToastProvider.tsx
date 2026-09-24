import { type ReactNode } from "react";
import { Toaster, toast as sonner } from "sonner";

type ToastTipo = "success" | "error" | "info" | "warn";

/**
 * Envuelve la app con el Toaster de sonner. `useToast()` devuelve una función
 * compatible con el resto del código: toast(mensaje, tipo).
 */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: { fontFamily: "Inter, system-ui, sans-serif", borderRadius: "12px" },
        }}
      />
    </>
  );
}

export function useToast() {
  return (msg: string, tipo: ToastTipo = "info") => {
    if (tipo === "success") return sonner.success(msg);
    if (tipo === "error") return sonner.error(msg);
    if (tipo === "warn") return sonner.warning(msg);
    return sonner.info(msg);
  };
}
