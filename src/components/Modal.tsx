import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

const ENFOCABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal. Se dibuja en <body> (portal) para que cubra toda la pantalla aunque la página
 * tenga animaciones con transform. Fondo oscuro translúcido sin desenfoque, bloquea el scroll del
 * fondo, enfoca el primer campo al abrir, devuelve el foco al cerrar y se cierra con Escape.
 */
export default function Modal({ open, onClose, children, width = "max-w-lg" }: Readonly<Props>) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Se guarda en una ref: las pantallas pasan una función nueva en cada render y, si el efecto
  // dependiera de ella, se reiniciaría (y movería el foco) mientras el usuario escribe.
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar.current();
    document.addEventListener("keydown", onKey);
    // Enfoca el primer campo una vez montado el panel.
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>(ENFOCABLE)?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
      previo?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            data-testid="modal-fondo"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className={`relative bg-surface-container-lowest rounded-2xl border border-surface-variant shadow-[0_24px_48px_-12px_rgba(0,0,0,0.28)] w-full ${width} max-h-[92vh] flex flex-col overflow-hidden`}
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
