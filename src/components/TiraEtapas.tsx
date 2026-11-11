import { AnimatePresence, motion } from "framer-motion";
import { ETAPAS_REPORTE, etapaReporte } from "../lib/dominio";
import type { AnioDisponible } from "../types";

const EASE_SALIDA = [0.23, 1, 0.32, 1] as const;

/**
 * Tira de etapas del reporte: siempre las mismas cuatro, a la misma escala, para leer de un vistazo
 * en qué punto está el año. La etapa en curso se marca con un bloque azul que se desliza cuando
 * cambia el estado. No dibuja nada si el año no tiene recorrido (sin códigos GRI o sin documentos).
 */
export default function TiraEtapas({ item }: Readonly<{ item?: AnioDisponible }>) {
  const etapa = etapaReporte(item);
  if (!etapa) return null;
  return (
    <ol aria-label="Etapas del reporte" className="relative grid grid-cols-4 border border-outline-variant">
      {/* Un único bloque azul que se desplaza a la etapa en curso (sin montar ni desmontar nada, para
          no retener la salida de la página). Si todo está al día, se desvanece. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1/4 bg-primary"
        initial={false}
        animate={{ x: `${(etapa.actual ?? ETAPAS_REPORTE.length - 1) * 100}%`, opacity: etapa.actual === null ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
      />
      {ETAPAS_REPORTE.map((nombre, i) => {
        const cumplida = i < etapa.cumplidas;
        const actual = i === etapa.actual;
        let tono = "text-outline";
        if (actual) tono = "text-on-primary font-semibold";
        else if (cumplida) tono = "text-on-surface";
        return (
          <li
            key={nombre}
            aria-current={actual ? "step" : undefined}
            className={`relative min-h-[64px] px-xs sm:px-sm py-sm flex flex-col justify-between gap-xs border-r border-outline-variant last:border-r-0 ${cumplida && !actual ? "bg-primary-container/60" : ""}`}
          >
            <span className={`relative flex items-center justify-between text-label-sm ${tono}`}>
              {String(i + 1).padStart(2, "0")}
              <AnimatePresence initial={false}>
                {cumplida && (
                  <motion.span
                    className="material-symbols-outlined text-[16px] text-primary-ink"
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
            </span>
            <span className={`relative text-[11px] sm:text-label-md leading-tight break-words hyphens-auto ${tono}`} lang="es">
              {nombre}
              {actual && etapa.nuevaVersion && <span className="block text-label-sm font-normal">nueva versión</span>}
              <span className="sr-only">{estadoLegible(cumplida, actual)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function estadoLegible(cumplida: boolean, actual: boolean): string {
  if (actual) return " (en curso)";
  return cumplida ? " (lista)" : " (pendiente)";
}
