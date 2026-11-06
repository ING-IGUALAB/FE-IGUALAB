import { AnimatePresence, motion } from "framer-motion";

export interface PasoGuia {
  texto: string;
  hecho: boolean;
}

const EASE_SALIDA = [0.23, 1, 0.32, 1] as const;

/**
 * Estado vacío que guía: la frase de qué hacer y los pasos numerados, marcando los que ya están
 * listos. El siguiente paso pendiente se resalta para que sea obvio por dónde seguir.
 */
export default function GuiaVacia({ icono, mensaje, pasos }: Readonly<{ icono: string; mensaje: string; pasos: PasoGuia[] }>) {
  const siguiente = pasos.findIndex((p) => !p.hecho);
  return (
    <div className="px-lg py-xl flex flex-col items-center text-center gap-lg">
      <span className="w-14 h-14 flex items-center justify-center bg-primary-container text-on-primary-container">
        <span className="material-symbols-outlined text-[28px]" aria-hidden="true">{icono}</span>
      </span>
      <p className="text-body-lg text-on-surface max-w-[44ch] text-balance">{mensaje}</p>
      <ol className="w-full max-w-[660px] grid grid-cols-1 sm:grid-cols-3 border border-outline-variant text-left">
        {pasos.map((paso, i) => {
          const esSiguiente = i === siguiente;
          let tono = "text-outline";
          if (esSiguiente) tono = "text-on-surface";
          else if (paso.hecho) tono = "text-on-surface-variant";
          return (
            <li
              key={paso.texto}
              className={`relative flex items-center gap-sm px-md py-sm border-b sm:border-b-0 sm:border-r border-outline-variant last:border-0 transition-colors duration-200 ${esSiguiente ? "bg-surface-container-low" : ""}`}
            >
              <span className={`w-6 shrink-0 text-label-md font-semibold ${esSiguiente ? "text-primary-ink" : tono}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={`flex-1 text-label-md ${tono} ${paso.hecho ? "line-through decoration-outline-variant" : ""}`}>
                {paso.texto}
                {paso.hecho && <span className="sr-only"> (listo)</span>}
              </span>
              <AnimatePresence initial={false}>
                {paso.hecho && (
                  <motion.span
                    className="material-symbols-outlined text-[18px] text-primary-ink"
                    aria-hidden="true"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.2, ease: EASE_SALIDA }}
                  >
                    check
                  </motion.span>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
