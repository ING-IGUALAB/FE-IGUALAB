import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTema } from "./useTema";

/** Botón de día/noche. El ícono gira y se desvanece al cambiar, con un leve desenfoque que oculta el cruce. */
export default function BotonTema({ className = "" }: Readonly<{ className?: string }>) {
  const { tema, alternar } = useTema();
  const boton = useRef<HTMLButtonElement>(null);
  const oscuro = tema === "oscuro";
  const etiqueta = oscuro ? "Activar modo claro" : "Activar modo oscuro";
  return (
    <button
      ref={boton}
      type="button"
      onClick={() => alternar(boton.current)}
      aria-label={etiqueta}
      title={etiqueta}
      className={`w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden text-on-surface hover:bg-surface-container-low ${className || "relative"}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={tema}
          aria-hidden="true"
          className="material-symbols-outlined"
          initial={{ opacity: 0, rotate: -90, scale: 0.6, filter: "blur(4px)" }}
          animate={{ opacity: 1, rotate: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6, filter: "blur(4px)" }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          {oscuro ? "light_mode" : "dark_mode"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
