import { useEffect, useRef } from "react";
import { rangoPaginas } from "../lib/dominio";
import { useIrAPagina, type PropsPaginacion } from "./useIrAPagina";

// Forma común; el color va aparte para que el botón activo no compita con el normal.
const CLS_FORMA = "min-w-[2rem] sm:min-w-[2.25rem] h-9 px-xs sm:px-sm rounded-lg border text-label-md transition-colors disabled:cursor-not-allowed";
const CLS_BOTON = `${CLS_FORMA} border-outline-variant text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40 disabled:hover:bg-transparent`;
const CLS_ACTUAL = `${CLS_FORMA} border-primary bg-primary text-on-primary font-semibold`;
// «Anterior» y «Siguiente»: con texto en pantallas anchas y solo la flecha en las angostas, para que la barra quepa en una línea.
const CLS_PASO = `${CLS_BOTON} inline-flex items-center justify-center sm:px-md`;
// Primera y última página: en pantallas angostas sobran, porque el 1 y el último número siempre se ven.
const CLS_EXTREMO = `${CLS_BOTON} hidden sm:inline-block`;

/**
 * Al cambiar de página, si el inicio de la lista quedó arriba, fuera de la vista, se vuelve a él:
 * así se ve la primera fila de la página nueva y no el final de la lista.
 */
function volverAlInicio(nav: HTMLElement | null) {
  const lista = nav?.closest<HTMLElement>("[data-lista]") ?? nav?.parentElement;
  if (!lista) return;
  // Lo que queda bajo la cabecera fija tampoco se ve.
  const tope = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  if (lista.getBoundingClientRect().top >= tope) return;
  // Sin animación: un desplazamiento suave se corta si la lista se recarga mientras se mueve.
  lista.scrollIntoView({ block: "start" });
}

/**
 * Paginación de todas las listas: primera/anterior, números de página (con «…»), siguiente/última
 * y un campo para ir directo a una página. No se muestra si hay una sola página.
 * El contenedor de la lista lleva `data-lista` para volver a su inicio al cambiar de página.
 */
export default function Paginacion({
  pagina,
  totalPaginas,
  onCambiar,
  deshabilitado = false,
}: PropsPaginacion) {
  const nav = useRef<HTMLElement>(null);
  // Se vuelve al inicio después de dibujar la página nueva, no antes: si no, el cambio de alto de la lista lo deshace.
  const volver = useRef(false);
  const cambiar = (p: number) => {
    volver.current = true;
    onCambiar(p);
  };
  useEffect(() => {
    if (!volver.current) return;
    volver.current = false;
    volverAlInicio(nav.current);
  }, [pagina]);
  const { ir, setIr, irA, irDirecto } = useIrAPagina(pagina, totalPaginas, cambiar);
  if (totalPaginas <= 1) return null;

  const enPrimera = pagina <= 1 || deshabilitado;
  const enUltima = pagina >= totalPaginas || deshabilitado;

  return (
    <nav ref={nav} aria-label="Paginación" className="flex flex-wrap md:flex-nowrap items-center justify-between gap-x-md gap-y-sm">
      <span className="text-label-md text-on-surface-variant">Página {pagina} de {totalPaginas}</span>

      <div className="order-last md:order-none w-full md:w-auto flex flex-wrap items-center justify-center gap-[2px] sm:gap-xs">
        <button type="button" onClick={() => irA(1)} disabled={enPrimera} aria-label="Primera página" title="Primera página" className={CLS_EXTREMO}>
          <span className="material-symbols-outlined text-[18px] align-middle" aria-hidden="true">first_page</span>
        </button>
        <button type="button" onClick={() => irA(pagina - 1)} disabled={enPrimera} aria-label="Anterior" title="Página anterior" className={CLS_PASO}>
          <span className="material-symbols-outlined text-[18px] sm:hidden" aria-hidden="true">chevron_left</span>
          <span className="hidden sm:inline">Anterior</span>
        </button>
        {rangoPaginas(pagina, totalPaginas).map((item, i) =>
          item === "…" ? (
            <span key={`salto-${i < 3 ? "inicio" : "fin"}`} className="sm:px-xs text-label-md text-outline" aria-hidden="true">…</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => irA(item)}
              disabled={deshabilitado}
              aria-label={`Página ${item}`}
              aria-current={item === pagina ? "page" : undefined}
              className={item === pagina ? CLS_ACTUAL : CLS_BOTON}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" onClick={() => irA(pagina + 1)} disabled={enUltima} aria-label="Siguiente" title="Página siguiente" className={CLS_PASO}>
          <span className="hidden sm:inline">Siguiente</span>
          <span className="material-symbols-outlined text-[18px] sm:hidden" aria-hidden="true">chevron_right</span>
        </button>
        <button type="button" onClick={() => irA(totalPaginas)} disabled={enUltima} aria-label="Última página" title="Última página" className={CLS_EXTREMO}>
          <span className="material-symbols-outlined text-[18px] align-middle" aria-hidden="true">last_page</span>
        </button>
      </div>

      {/* Sin validación del navegador: un número fuera de rango lleva a la primera o a la última página. */}
      <form onSubmit={irDirecto} noValidate className="flex items-center gap-xs">
        <label className="flex items-center gap-xs text-label-md text-on-surface-variant">
          <span>Ir a</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPaginas}
            value={ir}
            onChange={(e) => setIr(e.target.value)}
            disabled={deshabilitado}
            aria-label="Ir a la página"
            placeholder="N.º"
            className="w-16 h-9 rounded-lg border border-outline-variant bg-surface-container-lowest px-sm text-label-md text-center focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none"
          />
        </label>
        <button type="submit" disabled={deshabilitado || !ir} className={`${CLS_BOTON} px-md`}>
          Ir
        </button>
      </form>
    </nav>
  );
}
