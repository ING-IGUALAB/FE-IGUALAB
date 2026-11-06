import { useSyncExternalStore } from "react";

export type Tema = "claro" | "oscuro";

// Preferencia de esta persona en este navegador. Sin almacenamiento, sigue la del sistema.
const CLAVE_TEMA = "igualab.tema";
const oyentes = new Set<() => void>();

function temaDelSistema(): Tema {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    // Sin almacenamiento disponible: se usa el tema del sistema.
  }
  return temaDelSistema();
}

let actual: Tema = leerTema();

function pintar(tema: Tema) {
  document.documentElement.dataset.theme = tema === "oscuro" ? "dark" : "light";
}

/** Aplica el tema guardado antes del primer render, para que la app no parpadee en el tema equivocado. */
export function aplicarTemaInicial() {
  pintar(actual);
}

function fijarTema(tema: Tema) {
  actual = tema;
  pintar(tema);
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // La preferencia dura solo esta visita.
  }
  oyentes.forEach((avisar) => avisar());
}

type DocumentoConTransicion = Document & {
  startViewTransition?: (cambio: () => void) => { ready: Promise<void> };
};

/**
 * Tema claro/oscuro compartido por toda la app. Al alternar desde un botón, el tema nuevo se
 * revela en un círculo que crece desde ese botón; con «reducir movimiento» cambia al instante.
 */
export function useTema() {
  const tema = useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      return () => oyentes.delete(avisar);
    },
    () => actual,
  );

  function alternar(origen?: HTMLElement | null) {
    const siguiente: Tema = actual === "oscuro" ? "claro" : "oscuro";
    const doc = document as DocumentoConTransicion;
    const reducir = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reducir || !origen) {
      fijarTema(siguiente);
      return;
    }
    const caja = origen.getBoundingClientRect();
    const x = caja.left + caja.width / 2;
    const y = caja.top + caja.height / 2;
    const radio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transicion = doc.startViewTransition(() => fijarTema(siguiente));
    transicion.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
          { duration: 480, easing: "cubic-bezier(0.23, 1, 0.32, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {
        // Si el navegador cancela la transición, el tema ya quedó aplicado.
      });
  }

  return { tema, alternar };
}
