import { useState, type FormEvent } from "react";
import { paginaValida, rangoPaginas } from "../lib/dominio";

// Forma común; el color va aparte para que el botón activo no compita con el normal.
const CLS_FORMA = "min-w-[2.25rem] h-9 px-sm rounded-lg border text-label-md transition-colors disabled:cursor-not-allowed";
const CLS_BOTON = `${CLS_FORMA} border-outline-variant text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40 disabled:hover:bg-transparent`;
const CLS_ACTUAL = `${CLS_FORMA} border-primary bg-primary text-on-primary font-semibold`;

/**
 * Paginación completa: primera/anterior, números de página (con «…»), siguiente/última y un campo
 * para ir directo a una página. No se muestra si hay una sola página.
 */
export default function Paginacion({
  pagina,
  totalPaginas,
  onCambiar,
  deshabilitado = false,
}: Readonly<{ pagina: number; totalPaginas: number; onCambiar: (p: number) => void; deshabilitado?: boolean }>) {
  const [ir, setIr] = useState("");
  if (totalPaginas <= 1) return null;

  const irA = (p: number) => {
    if (p !== pagina) onCambiar(p);
  };

  function irDirecto(e: FormEvent) {
    e.preventDefault();
    const p = paginaValida(ir, totalPaginas);
    if (p !== null) irA(p);
    setIr("");
  }

  const enPrimera = pagina <= 1 || deshabilitado;
  const enUltima = pagina >= totalPaginas || deshabilitado;

  return (
    <nav aria-label="Paginación" className="flex flex-col md:flex-row md:items-center justify-between gap-md">
      <span className="text-label-md text-on-surface-variant">Página {pagina} de {totalPaginas}</span>

      <div className="flex flex-wrap items-center gap-xs">
        <button type="button" onClick={() => irA(1)} disabled={enPrimera} aria-label="Primera página" title="Primera página" className={CLS_BOTON}>
          <span className="material-symbols-outlined text-[18px] align-middle" aria-hidden="true">first_page</span>
        </button>
        <button type="button" onClick={() => irA(pagina - 1)} disabled={enPrimera} className={`${CLS_BOTON} px-md`}>
          Anterior
        </button>
        {rangoPaginas(pagina, totalPaginas).map((item, i) =>
          item === "…" ? (
            <span key={`salto-${i < 3 ? "inicio" : "fin"}`} className="px-xs text-label-md text-outline" aria-hidden="true">…</span>
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
        <button type="button" onClick={() => irA(pagina + 1)} disabled={enUltima} className={`${CLS_BOTON} px-md`}>
          Siguiente
        </button>
        <button type="button" onClick={() => irA(totalPaginas)} disabled={enUltima} aria-label="Última página" title="Última página" className={CLS_BOTON}>
          <span className="material-symbols-outlined text-[18px] align-middle" aria-hidden="true">last_page</span>
        </button>
      </div>

      <form onSubmit={irDirecto} className="flex items-center gap-xs">
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
            className="w-16 h-9 rounded-lg border border-outline-variant bg-surface-container-lowest px-sm text-label-md text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </label>
        <button type="submit" disabled={deshabilitado || !ir} className={`${CLS_BOTON} px-md`}>
          Ir
        </button>
      </form>
    </nav>
  );
}
