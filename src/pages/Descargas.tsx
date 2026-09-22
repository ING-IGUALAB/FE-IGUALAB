import { useState } from "react";
import SectionHeader from "../components/SectionHeader";
import Modal from "../components/Modal";
import ReporteA4 from "../components/ReporteA4";
import { useDomain } from "../data/DomainContext";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { PendienteBanner } from "./Ingesta";
import type { Reporte } from "../types";

export default function Descargas() {
  const { reportes, empresas, getAnalisis, pushAudit } = useDomain();
  const { sesion } = useAuth();
  const toast = useToast();
  const [ver, setVer] = useState<Reporte | null>(null);

  const empresa = ver ? empresas.find((e) => e.id === ver.empresaId) : null;
  const analisis = ver && empresa ? getAnalisis(empresa.id, ver.anio) : null;

  function imprimir() {
    if (!ver || !empresa) return;
    pushAudit(sesion!.nombre, "Descarga", `Descargó reporte de prospección · ${empresa.nombre} (${ver.anio})`);
    toast("Reporte descargado (simulado con impresión).", "success");
    setTimeout(() => globalThis.print(), 300);
  }

  return (
    <>
      <SectionHeader titulo="Descargar reportes" sub="Reportes de prospección generados, con la empresa, el año y la fecha de generación (RF-044). Disponibles aun si el asistente de IA no está operativo (RN-030)." />
      <PendienteBanner />

      <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {["Reporte", "Sector", "Año", "Fecha", ""].map((h) => <th key={h} className={`py-sm px-md text-label-sm text-on-surface-variant uppercase ${h === "" ? "text-right" : ""}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="text-body-md">
              {reportes.length ? reportes.map((r) => (
                <tr key={r.id} className="border-b border-surface-variant hover:bg-surface/50 transition-colors">
                  <td className="py-md px-md"><div className="flex items-center gap-sm"><span className="material-symbols-outlined text-error">picture_as_pdf</span><span className="font-medium">Prospección · {r.empresa}</span></div></td>
                  <td className="py-md px-md">{r.sector}</td>
                  <td className="py-md px-md text-on-surface-variant">{r.anio}</td>
                  <td className="py-md px-md text-on-surface-variant">{r.fecha}</td>
                  <td className="py-md px-md text-right">
                    <button onClick={() => setVer(r)} className="flex items-center gap-xs px-md py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint transition-colors ml-auto">
                      <span className="material-symbols-outlined text-[16px]">visibility</span> Ver / descargar
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-xl text-center text-on-surface-variant">No hay reportes disponibles todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!ver} onClose={() => setVer(null)} width="max-w-4xl">
        {ver && empresa && (
          <>
            <div className="flex justify-between items-center p-lg border-b border-outline-variant">
              <h3 className="text-title-lg text-on-surface flex items-center gap-sm"><span className="material-symbols-outlined text-primary">picture_as_pdf</span> Reporte · {empresa.nombre} ({ver.anio})</h3>
              <button onClick={() => setVer(null)} className="p-2 rounded-lg hover:bg-surface-container-low text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="overflow-y-auto p-lg bg-surface-container-low"><div id="print-area"><ReporteA4 empresa={empresa} anio={ver.anio} analisis={analisis} /></div></div>
            <div className="p-md border-t border-outline-variant flex justify-end gap-sm">
              <button onClick={() => setVer(null)} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low">Cerrar</button>
              <button onClick={imprimir} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold flex items-center gap-sm hover:bg-surface-tint"><span className="material-symbols-outlined text-[18px]">download</span> Descargar PDF</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
