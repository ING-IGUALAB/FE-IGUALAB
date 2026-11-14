import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import Paginacion from "../components/Paginacion";
import TablaReportes from "../components/TablaReportes";
import { useToast } from "../components/ToastProvider";
import { useDescargarReporte } from "../components/useDescargarReporte";
import * as empresasApi from "../api/empresas";
import * as reportesApi from "../api/reportes";
import { mensajeError, tipoAviso } from "../api/client";
import { SECTORES_API, etiquetaSector, filtrarPorTexto, paginarLocal } from "../lib/dominio";
import type { EmpresaApi, ReporteResumen, SectorApi } from "../types";

const TAM_PAGINA = 10;
const CLS_FILTRO =
  "rounded-lg border border-outline-variant bg-surface-container-low py-xs px-sm text-label-md focus:border-primary-ink outline-none";

/** Reportes que cumplen los filtros de sector y año. */
function filtrar(reportes: ReporteResumen[], empresas: EmpresaApi[], sector: "" | SectorApi, anio: string) {
  return reportes.filter(
    (r) => (!sector || empresas.find((e) => e.id === r.empresa_id)?.sector === sector) && (!anio || r.anio === Number(anio)),
  );
}

export default function Descargas() {
  const toast = useToast();
  // Al llegar desde «Ver historial» se destaca esa versión.
  const resaltar = (useLocation().state as { resaltar?: string } | null)?.resaltar;
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fSector, setFSector] = useState<"" | SectorApi>("");
  const [fAnio, setFAnio] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const empresaDe = (id: string) => empresas.find((e) => e.id === id);
  const sectorDe = (id: string) => {
    const e = empresaDe(id);
    return e ? etiquetaSector(e.sector) : "—";
  };
  const { descargar, descargando } = useDescargarReporte();

  useEffect(() => {
    Promise.all([empresasApi.listarEmpresas({ soloActivas: true }), reportesApi.listarReportes()])
      .then(([emps, reps]) => {
        const ordenados = [...reps].sort((a, b) => b.creado_en.localeCompare(a.creado_en));
        setEmpresas(emps);
        setReportes(ordenados);
        const destacado = ordenados.find((r) => r.id === resaltar);
        if (destacado) {
          const sectorDestacado = emps.find((e) => e.id === destacado.empresa_id)?.sector ?? "";
          const lista = filtrar(ordenados, emps, sectorDestacado, String(destacado.anio));
          setFSector(sectorDestacado);
          setFAnio(String(destacado.anio));
          setPagina(Math.floor(lista.indexOf(destacado) / TAM_PAGINA) + 1);
        }
      })
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar los reportes."), tipoAviso(err)))
      .finally(() => setCargando(false));
  }, [toast, resaltar]);

  // La búsqueda por empresa se suma a los filtros de sector y año, sobre la lista ya cargada.
  const filtrados = filtrarPorTexto(filtrar(reportes, empresas, fSector, fAnio), busqueda, (r) => r.empresa_nombre);
  const pag = paginarLocal(filtrados, pagina, TAM_PAGINA);
  const anios = [...new Set(reportes.map((r) => r.anio))].sort((a, b) => b - a);
  const hayFiltros = !!(fSector || fAnio);
  const buscando = busqueda.trim() !== "";
  let vacio = "Aún no se han generado reportes.";
  if (buscando) vacio = `Ningún reporte coincide con «${busqueda.trim()}».`;
  else if (hayFiltros) vacio = "No hay reportes con estos filtros.";

  function buscar(texto: string) {
    setBusqueda(texto);
    setPagina(1);
  }

  return (
    <>
      <SectionHeader
        titulo="Descargar reportes"
      />

      <div data-lista className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-col sm:flex-row sm:justify-between sm:items-center gap-md">
          <h3 className="text-title-lg text-on-surface">Versiones emitidas</h3>
          <div className="flex flex-wrap items-center gap-sm">
            <div className="relative w-full sm:w-[260px]">
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-[20px] text-outline pointer-events-none" aria-hidden="true">search</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => buscar(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape" && busqueda) { e.preventDefault(); buscar(""); } }}
                aria-label="Buscar por empresa"
                placeholder="Buscar por empresa…"
                autoComplete="off"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-xs pl-[40px] pr-[40px] text-label-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none [&::-webkit-search-cancel-button]:appearance-none"
              />
              {busqueda && (
                <button type="button" onClick={() => buscar("")} aria-label="Borrar búsqueda" title="Borrar búsqueda" className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-on-surface-variant hover:text-primary-ink">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                </button>
              )}
            </div>
            <select aria-label="Filtrar por sector" value={fSector} onChange={(e) => { setFSector(e.target.value as "" | SectorApi); setPagina(1); }} className={CLS_FILTRO}>
              <option value="">Todo sector</option>
              {SECTORES_API.map((s) => <option key={s} value={s}>{etiquetaSector(s)}</option>)}
            </select>
            <select aria-label="Filtrar por año" value={fAnio} onChange={(e) => { setFAnio(e.target.value); setPagina(1); }} className={CLS_FILTRO}>
              <option value="">Todo año</option>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {cargando ? (
          <div className="p-lg space-y-sm">
            {["c1", "c2", "c3"].map((k) => <div key={k} className="h-5 bg-surface-variant rounded animate-pulse" />)}
          </div>
        ) : (
          <TablaReportes
            reportes={pag.items}
            sectorDe={sectorDe}
            descargando={descargando}
            onDescargar={descargar}
            vacio={vacio}
            resaltado={resaltar}
          />
        )}

        {pag.paginas > 1 && (
          <div className="p-md border-t border-outline-variant">
            <Paginacion pagina={pag.pagina} totalPaginas={pag.paginas} onCambiar={setPagina} />
          </div>
        )}
      </div>
    </>
  );
}
