import Spinner from "./Spinner";
import { huellaCorta } from "../lib/dominio";
import { fechaCorta } from "../lib/format";
import type { ReporteResumen } from "../types";

/** Tabla con todas las versiones emitidas y su botón de descarga (Reportes y Descargar reportes). */
export default function TablaReportes({
  reportes,
  sectorDe,
  descargando,
  onDescargar,
  vacio,
  resaltado,
  conHuella = true,
}: Readonly<{
  reportes: ReporteResumen[];
  sectorDe?: (id: string) => string;
  descargando: string | null;
  onDescargar: (r: ReporteResumen) => void;
  vacio: string;
  /** Id del reporte a destacar (p. ej. al llegar desde «Ver historial»). */
  resaltado?: string;
  /** La huella ocupa bastante: se omite donde la tabla tiene poco ancho. */
  conHuella?: boolean;
}>) {
  const columnas = ["Reporte", ...(sectorDe ? ["Sector"] : []), "Año", "Versión", "Generado", ...(conHuella ? ["Huella"] : []), ""];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant">
            {columnas.map((h) => (
              <th key={h || "acciones"} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-body-md">
          {reportes.length === 0 && (
            <tr><td colSpan={columnas.length} className="py-xl text-center text-on-surface-variant">{vacio}</td></tr>
          )}
          {reportes.map((r) => (
            <tr
              key={r.id}
              aria-current={r.id === resaltado ? "true" : undefined}
              className={`border-b border-surface-variant transition-colors ${r.id === resaltado ? "bg-primary-container/30" : "hover:bg-surface/50"}`}
            >
              <td className="py-md px-md">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-error">picture_as_pdf</span>
                  <span className="font-medium">{r.empresa_nombre}</span>
                </div>
              </td>
              {sectorDe && <td className="py-md px-md text-on-surface-variant">{sectorDe(r.empresa_id)}</td>}
              <td className="py-md px-md text-on-surface-variant">{r.anio}</td>
              <td className="py-md px-md whitespace-nowrap">
                <span className="block font-medium">v{r.version}</span>
                <span className={`inline-block mt-xs px-sm py-[2px] text-label-sm uppercase tracking-[0.06em] ${r.es_ultima_version ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface-variant"}`}>
                  {r.es_ultima_version ? "Última emisión" : "Histórica"}
                </span>
              </td>
              <td className="py-md px-md text-on-surface-variant">
                <span className="block whitespace-nowrap">{fechaCorta(r.creado_en)}</span>
                <span className="block text-label-sm text-outline">{r.generado_por_nombre}</span>
              </td>
              {conHuella && <td className="py-md px-md"><code className="text-label-sm text-outline" title={r.sha256}>{huellaCorta(r.sha256)}</code></td>}
              <td className="py-md px-md text-right">
                <button
                  onClick={() => onDescargar(r)}
                  disabled={descargando === r.id}
                  aria-label={`Descargar versión ${r.version}`}
                  className="inline-flex items-center gap-xs px-md h-9 border border-on-surface text-on-surface text-label-md font-semibold hover:bg-primary hover:border-primary transition-colors disabled:opacity-60"
                >
                  {descargando === r.id ? <Spinner size={14} /> : <span className="material-symbols-outlined text-[16px]">download</span>} Descargar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
