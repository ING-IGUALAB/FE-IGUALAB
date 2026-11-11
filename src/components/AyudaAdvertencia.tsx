import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as EventoPuntero, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { EntradaAdvertencia } from "../lib/catalogoAdvertencias";

const ANCHO = 340;
const MARGEN = 16; // distancia mínima al borde de la ventana
const SEPARACION = 6; // entre el ícono y la ayuda
const DEMORA_CIERRE = 120; // ms para poder pasar el mouse del ícono a la ayuda sin que se cierre

/**
 * Ícono «?» que explica una advertencia con el texto del catálogo: qué significa, por qué aparece y
 * qué hacer. Se abre al pasar el mouse y queda fija con un clic (o un toque); se cierra con Escape o
 * al hacer clic fuera. Se dibuja sobre la página para que ninguna tarjeta la recorte.
 */
export default function AyudaAdvertencia({
  entradas,
  etiqueta,
  extra,
}: Readonly<{ entradas: EntradaAdvertencia[]; etiqueta: string; extra?: ReactNode }>) {
  const id = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const cierre = useRef<ReturnType<typeof setTimeout>>();
  const [fijada, setFijada] = useState(false);
  const [conMouse, setConMouse] = useState(false);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const abierta = fijada || conMouse;

  function entrar(e: EventoPuntero) {
    if (e.pointerType !== "mouse") return;
    clearTimeout(cierre.current);
    setConMouse(true);
  }
  function salir(e: EventoPuntero) {
    if (e.pointerType !== "mouse") return;
    cierre.current = setTimeout(() => setConMouse(false), DEMORA_CIERRE);
  }
  function cerrar() {
    clearTimeout(cierre.current);
    setFijada(false);
    setConMouse(false);
  }

  useEffect(() => () => clearTimeout(cierre.current), []);

  // Debajo del ícono; si no cabe, encima. Siempre dentro de la ventana.
  useLayoutEffect(() => {
    if (!abierta) {
      setPosicion(null);
      return;
    }
    const ubicar = () => {
      const b = boton.current?.getBoundingClientRect();
      if (!b) return;
      const alto = panel.current?.offsetHeight ?? 0;
      const ancho = Math.min(ANCHO, globalThis.innerWidth - MARGEN * 2);
      const left = Math.min(Math.max(MARGEN, b.left), globalThis.innerWidth - MARGEN - ancho);
      const debajo = b.bottom + SEPARACION;
      const noCabeDebajo = debajo + alto > globalThis.innerHeight - MARGEN;
      const cabeEncima = b.top - SEPARACION - alto >= MARGEN;
      setPosicion({ top: noCabeDebajo && cabeEncima ? b.top - SEPARACION - alto : debajo, left });
    };
    ubicar();
    globalThis.addEventListener("scroll", ubicar, true);
    globalThis.addEventListener("resize", ubicar);
    return () => {
      globalThis.removeEventListener("scroll", ubicar, true);
      globalThis.removeEventListener("resize", ubicar);
    };
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!boton.current?.contains(t) && !panel.current?.contains(t)) cerrar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera);
    };
  }, [abierta]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-controls={abierta ? id : undefined}
        onClick={() => (fijada ? cerrar() : setFijada(true))}
        onPointerEnter={entrar}
        onPointerLeave={salir}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-on-surface-variant hover:text-primary-ink hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-ink transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">help</span>
      </button>
      {abierta &&
        createPortal(
          // <dialog open> no modal: se anula su margen y su borde derecho por defecto para ubicarlo junto al ícono.
          <motion.dialog
            ref={panel}
            id={id}
            open
            aria-label={etiqueta}
            onPointerEnter={entrar}
            onPointerLeave={salir}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
            style={posicion ?? { top: 0, left: 0, visibility: "hidden" }}
            className="fixed z-50 m-0 right-auto w-[340px] max-w-[calc(100vw-32px)] rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface shadow-lg p-md text-left"
          >
            <div className="divide-y divide-outline-variant">
              {entradas.map((e) => (
                <div key={e.titulo} className="py-sm first:pt-0 last:pb-0 space-y-xs">
                  <p className="text-label-md font-semibold text-on-surface">{e.titulo}</p>
                  <Parte titulo="Qué significa">{e.significado}</Parte>
                  <Parte titulo="Por qué aparece">{e.motivo}</Parte>
                  <Parte titulo="Qué hacer">{e.accion}</Parte>
                </div>
              ))}
            </div>
            {extra && <div className="mt-sm pt-sm border-t border-outline-variant text-label-sm text-on-surface-variant">{extra}</div>}
          </motion.dialog>,
          document.body,
        )}
    </>
  );
}

function Parte({ titulo, children }: Readonly<{ titulo: string; children: ReactNode }>) {
  return (
    <p className="text-label-sm text-on-surface-variant">
      <span className="font-semibold text-on-surface">{titulo}: </span>
      {children}
    </p>
  );
}
