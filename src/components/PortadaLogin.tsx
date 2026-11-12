import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const FRASE = "Documentos, análisis GRI y reportes en un solo flujo.";

const PASOS = [
  { titulo: "Documentos ingestados", detalle: "Memorias y reportes de cada empresa, por año." },
  { titulo: "Análisis GRI validado", detalle: "Cada estándar revisado y aprobado antes de emitir." },
  { titulo: "Reporte emitido", detalle: "Versionado: cada validación deja su propio PDF." },
] as const;

const DURACION_PASO = 2600; // ms que cada paso queda activo en el recorrido automático
// Ola de color: tras la entrada, una franja azul recorre la frase y descansa antes de repetirse.
const INICIO_OLA = 1.4; // s, cuando ya entraron todas las palabras
const PASO_OLA = 0.14; // s entre una palabra y la siguiente
const EASE_SALIDA = [0.23, 1, 0.32, 1] as const;

/**
 * Portada del acceso (solo pantallas medianas o más): marca, la frase del producto entrando palabra
 * por palabra y el flujo de trabajo recorriéndose solo. Al pasar el mouse por un paso, el recorrido
 * se detiene en él. Es decorativa: queda fuera del árbol accesible y no recibe foco.
 */
export default function PortadaLogin() {
  const reducir = useReducedMotion();
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado || reducir) return;
    const t = setTimeout(() => setActivo((a) => (a + 1) % PASOS.length), DURACION_PASO);
    return () => clearTimeout(t);
  }, [activo, pausado, reducir]);

  return (
    <aside
      aria-hidden="true"
      className="hidden md:flex relative overflow-hidden flex-col justify-between gap-xl bg-rail text-on-rail p-xl lg:p-[64px]"
    >
      <img src="/logo.webp" alt="" className="relative h-11 w-fit object-contain logo-claro" />

      <div className="relative flex flex-col gap-xl max-w-[480px]">
        <p className="text-display-lg text-balance">
          {FRASE.split(" ").map((palabra, i) => (
            <span key={palabra} className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
              <motion.span
                className={`inline-block ${palabra === "GRI" ? "text-primary" : "ola-color"}`}
                // Cada palabra se enciende un poco después que la anterior: la ola recorre la frase.
                style={{ animationDelay: `${INICIO_OLA + i * PASO_OLA}s` }}
                initial={reducir ? false : { y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.045, ease: EASE_SALIDA }}
              >
                {palabra}&nbsp;
              </motion.span>
            </span>
          ))}
        </p>

        <motion.ol
          className="flex flex-col border-t border-rail-line"
          initial={reducir ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7, ease: EASE_SALIDA }}
          onMouseLeave={() => setPausado(false)}
        >
          {PASOS.map((paso, i) => {
            const esActivo = i === activo;
            return (
              <li
                key={paso.titulo}
                className="relative border-b border-rail-line cursor-default"
                onMouseEnter={() => {
                  setPausado(true);
                  setActivo(i);
                }}
              >
                {esActivo && (
                  <motion.div
                    layoutId="paso-activo"
                    className="absolute inset-0 bg-primary/15"
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  />
                )}
                <div className="relative flex items-start gap-md px-md py-md">
                  <span className={`w-7 shrink-0 text-label-md font-semibold transition-colors ${esActivo ? "text-primary" : "text-on-rail-variant"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`block text-body-lg font-semibold transition-colors ${esActivo ? "text-on-rail" : "text-on-rail-variant"}`}>
                      {paso.titulo}
                    </span>
                    <AnimatePresence initial={false}>
                      {esActivo && (
                        <motion.p
                          className="text-body-md text-on-rail-variant overflow-hidden"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.28, ease: EASE_SALIDA }}
                        >
                          <span className="block pt-xs">{paso.detalle}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {/* Barra de avance del paso activo: marca cuánto falta para pasar al siguiente. */}
                {esActivo && !pausado && !reducir && (
                  <motion.span
                    key={`avance-${activo}`}
                    className="absolute left-0 bottom-[-1px] h-[2px] w-full bg-primary origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: DURACION_PASO / 1000, ease: "linear" }}
                  />
                )}
              </li>
            );
          })}
        </motion.ol>
      </div>
    </aside>
  );
}
