import { bloquesPaginacion } from "../lib/dominio";
import { useIrAPagina, type PropsPaginacion } from "./useIrAPagina";

const CLS_CIRCULO =
  "w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-full border-2 text-label-md font-semibold tabular-nums transition-colors disabled:cursor-not-allowed";
const CLS_NUMERO = `${CLS_CIRCULO} border-primary text-primary hover:bg-primary-container/40 disabled:opacity-40`;
const CLS_ACTUAL = `${CLS_CIRCULO} border-primary bg-primary text-on-primary`;
const CLS_FLECHA =
  "w-6 sm:w-8 h-9 shrink-0 flex items-center justify-center rounded-full text-primary hover:text-on-secondary-container hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent";

/**
 * Paginación con salto directo: flechas, las páginas cercanas a la actual, un campo «Ir a» en medio
 * y las últimas páginas. Debajo, «Página N de M». No se muestra si hay una sola página.
 */
export default function PaginacionSalto({
  pagina,
  totalPaginas,
  onCambiar,
  deshabilitado = false,
}: PropsPaginacion) {
  const { ir, setIr, irA, irDirecto } = useIrAPagina(pagina, totalPaginas, onCambiar);
  if (totalPaginas <= 1) return null;

  const { inicio, fin } = bloquesPaginacion(pagina, totalPaginas);
  // En pantallas pequeñas el grupo final se reduce a la última página para que todo quepa en una línea.
  const soloEscritorio = (p: number) => fin.includes(p) && p !== totalPaginas && p !== pagina;
  const numero = (p: number) => (
    <button
      key={p}
      type="button"
      onClick={() => irA(p)}
      disabled={deshabilitado}
      aria-label={`Página ${p}`}
      aria-current={p === pagina ? "page" : undefined}
      className={`${p === pagina ? CLS_ACTUAL : CLS_NUMERO} ${soloEscritorio(p) ? "hidden sm:inline-block" : ""}`}
    >
      {p}
    </button>
  );

  return (
    <nav aria-label="Paginación" className="flex flex-col items-center gap-xs">
      <div className="flex flex-wrap items-center justify-center gap-xs sm:gap-sm">
        <button type="button" onClick={() => irA(pagina - 1)} disabled={pagina <= 1 || deshabilitado} aria-label="Página anterior" title="Página anterior" className={CLS_FLECHA}>
          <span className="material-symbols-outlined text-[28px]" aria-hidden="true">chevron_left</span>
        </button>

        {inicio.map(numero)}

        {fin.length > 0 && (
          <form onSubmit={irDirecto} noValidate className="flex items-center h-7 sm:h-9 w-24 sm:w-32 rounded-lg border-2 border-primary bg-surface-container-lowest focus-within:bg-primary-container/20 transition-colors">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPaginas}
              value={ir}
              onChange={(e) => setIr(e.target.value)}
              disabled={deshabilitado}
              aria-label="Ir a la página"
              placeholder="Ir a…"
              className="w-full min-w-0 h-full bg-transparent pl-sm text-label-md font-semibold text-primary placeholder:text-primary placeholder:font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button type="submit" disabled={deshabilitado || !ir} aria-label="Ir a la página escrita" title="Ir" className="h-full px-xs text-primary disabled:opacity-60 disabled:cursor-default">
              <span className="material-symbols-outlined text-[20px] align-middle" aria-hidden="true">search</span>
            </button>
          </form>
        )}

        {fin.map(numero)}

        <button type="button" onClick={() => irA(pagina + 1)} disabled={pagina >= totalPaginas || deshabilitado} aria-label="Página siguiente" title="Página siguiente" className={CLS_FLECHA}>
          <span className="material-symbols-outlined text-[28px]" aria-hidden="true">chevron_right</span>
        </button>
      </div>
      <span className="text-label-sm text-on-surface-variant">Página {pagina} de {totalPaginas}</span>
    </nav>
  );
}
