import { useEffect, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import Paginacion from "../components/Paginacion";
import TablaReportes from "../components/TablaReportes";
import { useToast } from "../components/ToastProvider";
import { useDescargarReporte } from "../components/useDescargarReporte";
import * as empresasApi from "../api/empresas";
import * as reportesApi from "../api/reportes";
import { mensajeError } from "../api/client";
import { SECTORES_API, etiquetaSector, paginarLocal } from "../lib/dominio";
import type { EmpresaApi, ReporteResumen, SectorApi } from "../types";

const TAM_PAGINA = 10;
const CLS_FILTRO =
  "rounded-lg border border-outline-variant bg-surface-container-low py-xs px-sm text-label-md focus:border-primary outline-none";

export default function Descargas() {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fSector, setFSector] = useState<"" | SectorApi>("");
  const [fAnio, setFAnio] = useState("");
  const [pagina, setPagina] = useState(1);

  const empresaDe = (id: string) => empresas.find((e) => e.id === id);
  const nombreEmpresa = (id: string) => empresaDe(id)?.nombre ?? "Empresa";
  const sectorDe = (id: string) => {
    const e = empresaDe(id);
    return e ? etiquetaSector(e.sector) : "—";
  };
  const { descargar, descargando } = useDescargarReporte(nombreEmpresa);

  useEffect(() => {
    Promise.all([empresasApi.listarEmpresas({ soloActivas: true }), reportesApi.listarReportes()])
      .then(([emps, reps]) => {
        setEmpresas(emps);
        setReportes([...reps].sort((a, b) => b.creado_en.localeCompare(a.creado_en)));
      })
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar los reportes."), "error"))
      .finally(() => setCargando(false));
  }, [toast]);

  const filtrados = reportes.filter(
    (r) => (!fSector || empresaDe(r.empresa_id)?.sector === fSector) && (!fAnio || r.anio === Number(fAnio)),
  );
  const pag = paginarLocal(filtrados, pagina, TAM_PAGINA);
  const anios = [...new Set(reportes.map((r) => r.anio))].sort((a, b) => b - a);
  const hayFiltros = !!(fSector || fAnio);

  return (
    <>
      <SectionHeader
        titulo="Descargar reportes"
        sub="Reportes de prospección generados, con la empresa, el año y la fecha de generación."
      />

      <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-col sm:flex-row sm:justify-between sm:items-center gap-md">
          <h3 className="text-title-lg text-on-surface">Reportes generados</h3>
          <div className="flex flex-wrap items-center gap-sm">
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
            nombreEmpresa={nombreEmpresa}
            sectorDe={sectorDe}
            descargando={descargando}
            onDescargar={descargar}
            vacio={hayFiltros ? "No hay reportes con estos filtros." : "Aún no se han generado reportes."}
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
