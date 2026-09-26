import type { Analisis, Empresa } from "../types";
import { conteoEstados, esgScore, resumenSanciones } from "../data/seed";
import { money } from "../lib/format";
import Badge from "./Badge";

export default function ReporteA4({ empresa, anio, analisis }: Readonly<{ empresa: Empresa; anio: number; analisis: Analisis | null }>) {
  const a = analisis || { gri: [], sanciones: [], evidencia: { gri: false, sanciones: false } };
  const esg = esgScore(a.gri);
  const conteo = conteoEstados(a.gri);
  const resSan = resumenSanciones(a.sanciones);

  return (
    <div className="w-[800px] max-w-full bg-white shadow-[0_12px_32px_rgba(0,0,0,0.08)] rounded-sm flex flex-col mx-auto">
      <div className="h-24 border-b border-surface-variant flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-sm">
          <img src="/logo.webp" alt="Igualab" className="h-8 object-contain" />
          <div className="text-title-lg font-bold text-primary">Igualab Intelligence</div>
        </div>
        <div className="text-right">
          <div className="text-label-sm text-outline uppercase">Reporte de Prospección</div>
          <div className="text-body-md text-on-surface-variant">Generado: {new Date().toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}</div>
        </div>
      </div>

      <div className="p-10 flex flex-col gap-7">
        <div>
          <h1 className="text-headline-lg text-on-background font-black leading-tight mb-2">{empresa.nombre}</h1>
          <div className="text-title-lg text-secondary border-b-2 border-secondary inline-block pb-1">Año {anio} · Sector: {empresa.sector}</div>
        </div>

        {/* Resumen ejecutivo automático (RF-041): sólo ESG, total sanciones y sin monto */}
        <div>
          <h2 className="text-headline-md text-primary mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-primary">summarize</span> Resumen ejecutivo</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="border border-surface-variant rounded p-3 border-t-4 border-t-primary"><div className="text-label-sm text-outline uppercase">Puntaje ESG</div><div className="text-headline-md text-on-surface">{esg ?? "—"}<span className="text-title-lg text-outline">/100</span></div></div>
            <div className="border border-surface-variant rounded p-3 border-t-4 border-t-tertiary"><div className="text-label-sm text-outline uppercase">Total sanciones (S/)</div><div className="text-headline-md text-on-surface">{resSan.total ? money(resSan.total).replace("S/ ", "") : "0"}</div></div>
            <div className="border border-surface-variant rounded p-3 border-t-4 border-t-outline"><div className="text-label-sm text-outline uppercase">Sin monto</div><div className="text-headline-md text-on-surface">{resSan.sinMonto}</div></div>
          </div>
          <p className="text-body-md text-on-surface leading-relaxed">
            {empresa.nombre} presenta un puntaje ESG de <strong>{esg == null ? "sin datos" : `${esg}/100`}</strong> en {anio}.
            Brechas GRI por estado: <strong>{conteo["OK"]} OK</strong>, <strong>{conteo["Baja sustancia"]} baja sustancia</strong> y <strong>{conteo["Sub-reportado"]} sub-reportado</strong>.
            Sanciones cuantificadas por <strong>{money(resSan.total)}</strong>{resSan.sinMonto ? ` y ${resSan.sinMonto} sanción(es) sin monto determinado` : ""}.
          </p>
        </div>

        {/* Estado por código GRI con cita (RF-038) */}
        <div>
          <h2 className="text-headline-md text-primary mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-primary">rule</span> Estado por código GRI</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                {["Código", "Tema", "Estado", "Cita de respaldo"].map((h) => <th key={h} className="py-2 px-3 text-label-sm text-on-surface-variant uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {a.gri.length ? a.gri.map((g) => (
                <tr key={g.codigo} className="border-b border-surface-variant align-top">
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{g.codigo}</td>
                  <td className="py-2 px-3">{g.tema}</td>
                  <td className="py-2 px-3"><Badge estado={g.estado} /></td>
                  <td className="py-2 px-3 text-on-surface-variant text-body-md italic">{g.cita} <span className="not-italic text-outline">({g.pagina})</span></td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-3 px-3 text-on-surface-variant">Sin códigos GRI evaluados para este año.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sanciones (RF-039) + totales (RF-040) */}
        <div>
          <h2 className="text-headline-md text-primary mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-primary">gavel</span> Sanciones identificadas</h2>
          {a.sanciones.length ? a.sanciones.map((s) => (
            <div key={`${s.entidad}-${s.pagina}`} className="flex justify-between items-start border border-surface-variant rounded-lg p-3 mb-2 gap-4">
              <div><p className="text-body-md font-medium text-on-surface">{s.entidad}</p><p className="text-label-sm text-on-surface-variant">{s.motivo} · <span className="italic">{s.pagina}</span></p></div>
              {s.monto == null ? <span className="inline-flex items-center px-2 py-1 rounded-full bg-surface-variant text-on-surface-variant text-label-sm whitespace-nowrap">No cuantificada</span> : <p className="text-title-lg text-error font-bold whitespace-nowrap">{money(s.monto)}</p>}
            </div>
          )) : <p className="text-body-md text-on-surface-variant">Sin sanciones identificadas en los documentos del año analizado.</p>}
          <div className="mt-3 border border-surface-variant rounded-lg p-3 bg-surface-container-low flex justify-between">
            <div><p className="text-label-sm text-outline uppercase">Monto total de sanciones cuantificadas</p><p className="text-title-lg text-on-surface font-bold">{money(resSan.total)}</p></div>
            <div className="text-right"><p className="text-label-sm text-outline uppercase">Sanciones sin monto determinado</p><p className="text-title-lg text-on-surface font-bold">{resSan.sinMonto}</p></div>
          </div>
        </div>

        <div className="mt-auto border-t border-surface-variant pt-4 flex justify-between items-center text-outline text-label-md">
          <span>Confidencial · Uso interno de Igualab · Reporte inmutable (RN-026)</span>
          <span>Igualab Intelligence</span>
        </div>
      </div>
    </div>
  );
}
