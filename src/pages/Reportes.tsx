import { useMemo, useState, type ReactNode } from "react";
import SectionHeader from "../components/SectionHeader";
import ReporteA4 from "../components/ReporteA4";
import { useDomain } from "../data/DomainContext";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { ESTADOS_GRI, esgScore } from "../data/seed";
import { PendienteBanner } from "./Ingesta";
import type { EstadoGri } from "../types";

export default function Reportes() {
  const { empresasConDocumentos, aniosDeEmpresa, getAnalisis, setEstadoGri, agregarReporte, pushAudit, reportes } = useDomain();
  const { sesion } = useAuth();
  const toast = useToast();

  const empresasDocs = empresasConDocumentos();
  const sectores = useMemo(() => [...new Set(empresasDocs.map((e) => e.sector))], [empresasDocs]);

  const [sector, setSector] = useState<string>(sectores[0] ?? "");
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);

  const empresasSector = empresasDocs.filter((e) => e.sector === sector);
  const empresa = empresasSector.find((e) => e.id === empresaId) || empresasSector[0];
  const anios = empresa ? aniosDeEmpresa(empresa.id) : [];
  const anioSel = anio != null && anios.includes(anio) ? anio : anios[0];
  const analisis = empresa && anioSel ? getAnalisis(empresa.id, anioSel) : null;
  const esg = analisis ? esgScore(analisis.gri) : null;

  if (!empresasDocs.length) {
    return (
      <>
        <SectionHeader titulo="Reportes de prospección" sub="Genera un reporte por empresa y año, a partir de los resultados de análisis almacenados (RF-042)." />
        <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-xl text-center">
          <span className="material-symbols-outlined text-[40px] text-outline">block</span>
          <p className="text-body-md text-on-surface-variant mt-sm">No hay empresas con documentos ingestados. No se puede generar un reporte de prospección (RF-026 / RN-020).</p>
        </div>
      </>
    );
  }

  function cambiarEstado(index: number, estado: EstadoGri) {
    if (!empresa || !anioSel || !analisis) return;
    const prev = analisis.gri[index].estado;
    if (prev === estado) return;
    setEstadoGri(empresa.id, anioSel, index, estado);
    pushAudit(sesion!.nombre, "Cambio de estado GRI", `Asignó estado '${estado}' a ${analisis.gri[index].codigo} · ${empresa.nombre} ${anioSel} (antes '${prev}')`);
    toast(`${analisis.gri[index].codigo}: estado '${estado}'. ESG recalculado.`, "success");
  }

  function generarVistaPrevia() {
    if (!empresa || !anioSel) return toast("Selecciona sector, empresa y año.", "warn");
    setPreview(true);
    setTimeout(() => document.getElementById("rep-preview")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  function descargarPDF() {
    if (!empresa || !anioSel) return toast("Selecciona sector, empresa y año.", "warn");
    setPreview(true);
    agregarReporte({ id: "r" + Date.now(), empresaId: empresa.id, empresa: empresa.nombre, sector: empresa.sector, anio: anioSel, generadoPor: sesion!.nombre, fecha: new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) });
    pushAudit(sesion!.nombre, "Generación de reporte", `Generó reporte de prospección · ${empresa.nombre} (${anioSel})`);
    toast("Reporte generado, registrado en auditoría e inmutable (RN-026).", "success");
    setTimeout(() => window.print(), 400);
  }

  return (
    <>
      <SectionHeader titulo="Reportes de prospección" sub="Selecciona sector, empresa y año; asigna el estado de cada código GRI y genera el reporte con resumen ejecutivo automático (RN-024). El reporte es inmutable (RN-026)." />
      <PendienteBanner />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-4 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow">
            <h3 className="text-title-lg text-on-background mb-md">Parámetros</h3>
            <div className="space-y-md">
              <Campo label="1 · Sector">
                <select value={sector} onChange={(e) => { setSector(e.target.value); setEmpresaId(""); setAnio(null); setPreview(false); }} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  {sectores.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Campo>
              <Campo label="2 · Empresa">
                <select value={empresa?.id || ""} onChange={(e) => { setEmpresaId(e.target.value); setAnio(null); setPreview(false); }} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  {empresasSector.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="3 · Año">
                <select value={anioSel || ""} onChange={(e) => { setAnio(parseInt(e.target.value, 10)); setPreview(false); }} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  {anios.map((a) => <option key={a}>{a}</option>)}
                </select>
              </Campo>
            </div>
            <div className="grid grid-cols-1 gap-sm mt-lg">
              <button onClick={generarVistaPrevia} className="w-full bg-surface border border-primary text-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm hover:bg-primary/5 transition-all text-body-lg font-semibold">
                <span className="material-symbols-outlined">visibility</span> Generar vista previa
              </button>
              <button onClick={descargarPDF} className="w-full bg-primary text-on-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm shadow-md hover:bg-surface-tint transition-all text-body-lg font-semibold">
                <span className="material-symbols-outlined">download</span> Descargar PDF
              </button>
            </div>
            <p className="text-label-sm text-outline mt-md">El resumen ejecutivo incluye sólo el puntaje ESG, el total de sanciones y las sanciones sin monto (RF-041).</p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-bright flex justify-between items-center">
              <h3 className="text-title-lg text-on-surface">Estados de códigos GRI (asignación manual)</h3>
              <span className="text-label-sm text-on-surface-variant">{esg != null ? `Puntaje ESG: ${esg}/100 · OK=100 · Baja=50 · Sub=0 (RF-051)` : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    {["Código", "Tema", "Cita textual (evidencia)", "Estado"].map((h) => <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="text-body-md">
                  {analisis ? analisis.gri.map((g, i) => (
                    <tr key={g.codigo} className="border-b border-surface-variant align-top">
                      <td className="py-md px-md whitespace-nowrap"><span className="bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded text-[10px] font-bold uppercase">{g.codigo}</span></td>
                      <td className="py-md px-md font-medium">{g.tema}</td>
                      <td className="py-md px-md">
                        <p className="text-body-md text-on-surface-variant italic border-l-2 border-outline-variant pl-sm">{g.cita}</p>
                        <p className="text-label-sm text-outline mt-xs">{g.doc} · {g.pagina}</p>
                      </td>
                      <td className="py-md px-md">
                        <select value={g.estado} onChange={(e) => cambiarEstado(i, e.target.value as EstadoGri)} className="rounded-lg border border-outline-variant bg-surface-container-low py-xs px-sm text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                          {ESTADOS_GRI.map((es) => <option key={es}>{es}</option>)}
                        </select>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="py-lg text-center text-on-surface-variant">Sin análisis para este año.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {preview && empresa && anioSel && (
            <div id="rep-preview" className="bg-surface-container-low rounded-xl border border-surface-variant p-lg">
              <div className="flex justify-between items-center mb-sm">
                <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider">Vista previa del documento</h3>
                <span className="text-label-sm text-outline">A4</span>
              </div>
              <div className="overflow-y-auto chat-scroll py-lg max-h-[560px]">
                <div className="scale-[0.7] lg:scale-[0.82] origin-top">
                  <div id="print-area"><ReporteA4 empresa={empresa} anio={anioSel} analisis={analisis} /></div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-bright"><h3 className="text-title-lg text-on-surface">Historial de reportes generados (RF-044)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    {["Empresa", "Sector", "Año", "Generado por", "Fecha"].map((h) => <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="text-body-md">
                  {reportes.length ? reportes.map((r) => (
                    <tr key={r.id} className="border-b border-surface-variant hover:bg-surface/50 transition-colors">
                      <td className="py-md px-md font-medium">{r.empresa}</td>
                      <td className="py-md px-md text-on-surface-variant">{r.sector}</td>
                      <td className="py-md px-md text-on-surface-variant">{r.anio}</td>
                      <td className="py-md px-md text-on-surface-variant">{r.generadoPor}</td>
                      <td className="py-md px-md text-on-surface-variant">{r.fecha}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="py-lg text-center text-on-surface-variant">Aún no has generado reportes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-xs">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}
