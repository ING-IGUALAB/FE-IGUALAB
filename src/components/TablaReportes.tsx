import Spinner from "./Spinner";
import { huellaCorta } from "../lib/dominio";
import type { ReporteResumen } from "../types";

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

/** Tabla de reportes generados con su botón de descarga (Reportes y Descargar reportes). */
export default function TablaReportes({
  reportes,
  nombreEmpresa,
  sectorDe,
  descargando,
  onDescargar,
  vacio,
  resaltado,
}: Readonly<{
  reportes: ReporteResumen[];
  nombreEmpresa: (id: string) => string;
  sectorDe?: (id: string) => string;
  descargando: string | null;
  onDescargar: (r: ReporteResumen) => void;
  vacio: string;
  /** Id del reporte a destacar (p. ej. al llegar desde «Ver reporte generado»). */
  resaltado?: string;
}>) {
  const columnas = ["Reporte", ...(sectorDe ? ["Sector"] : []), "Año", "Generado", "Huella", ""];
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
                  <span className="font-medium">{nombreEmpresa(r.empresa_id)}</span>
                </div>
              </td>
              {sectorDe && <td className="py-md px-md text-on-surface-variant">{sectorDe(r.empresa_id)}</td>}
              <td className="py-md px-md text-on-surface-variant">{r.anio}</td>
              <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{fechaHora(r.creado_en)}</td>
              <td className="py-md px-md"><code className="text-label-sm text-outline" title={r.sha256}>{huellaCorta(r.sha256)}</code></td>
              <td className="py-md px-md text-right">
                <button
                  onClick={() => onDescargar(r)}
                  disabled={descargando === r.id}
                  className="inline-flex items-center gap-xs px-md py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint transition-colors disabled:opacity-60"
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
