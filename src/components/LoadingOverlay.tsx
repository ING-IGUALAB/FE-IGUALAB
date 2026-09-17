import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ScaleLoader } from "react-spinners";
import { LOADING_END, LOADING_START } from "../api/client";

const DELAY = 150; // ms antes de mostrar (evita parpadeo en requests instantáneos)
const MIN_VISIBLE = 550; // ms mínimo visible una vez mostrado

/**
 * Indicador de carga centrado en pantalla. Escucha los eventos del cliente HTTP
 * y se muestra mientras haya peticiones activas, con retardo de aparición y
 * duración mínima para que la carga se perciba con claridad.
 */
export default function LoadingOverlay() {
  const [visible, setVisible] = useState(false);
  const activos = useRef(0);
  const shownAt = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = () => {
      activos.current += 1;
      if (activos.current === 1) {
        if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
        showTimer.current = setTimeout(() => {
          shownAt.current = Date.now();
          setVisible(true);
        }, DELAY);
      }
    };
    const end = () => {
      activos.current = Math.max(0, activos.current - 1);
      if (activos.current === 0) {
        if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
        setVisible((v) => {
          if (!v) return false;
          const restante = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current));
          hideTimer.current = setTimeout(() => setVisible(false), restante);
          return v;
        });
      }
    };
    window.addEventListener(LOADING_START, start);
    window.addEventListener(LOADING_END, end);
    return () => {
      window.removeEventListener(LOADING_START, start);
      window.removeEventListener(LOADING_END, end);
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-inverse-surface/30 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-surface-container-lowest rounded-2xl border border-surface-variant shadow-[0_16px_40px_rgba(0,0,0,0.18)] px-xl py-xl flex flex-col items-center justify-center text-center gap-md w-[240px]"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
          >
            <img src="/logo.webp" alt="Igualab" className="h-7 object-contain" />
            <ScaleLoader color="#006038" height={30} width={4} radius={4} margin={3} />
            <p className="text-label-md text-on-surface-variant">Cargando…</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
