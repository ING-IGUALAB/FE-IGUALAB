import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import Spinner from "../components/Spinner";
import TablaReportes from "../components/TablaReportes";
import { useToast } from "../components/ToastProvider";
import { useDescargarReporte } from "../components/useDescargarReporte";
import * as empresasApi from "../api/empresas";
import * as reportesApi from "../api/reportes";
import { mensajeError } from "../api/client";
import { SECTORES_API, aniosDisponibles, anioIngestaValido, etiquetaSector } from "../lib/dominio";
import type { EmpresaApi, ReporteResumen, SectorApi } from "../types";

const ANIOS = aniosDisponibles();
const RECIENTES = 5;
const CLS_SELECT =
  "w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none";

export default function Reportes() {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [sector, setSector] = useState<SectorApi>(SECTORES_API[0]);
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState(ANIOS[0]);
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [vistaUrl, setVistaUrl] = useState<string | null>(null);
  const [accion, setAccion] = useState<"vista" | "generar" | null>(null);

  const nombreEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nombre ?? "Empresa";
  const { descargar, descargando } = useDescargarReporte(nombreEmpresa);
  const empresasSector = empresas.filter((e) => e.activa && e.sector === sector);
  const listo = !!empresaId && anioIngestaValido(anio);

  const cargarReportes = useCallback(async () => {
    try {
      const data = await reportesApi.listarReportes();
      setReportes([...data].sort((a, b) => b.creado_en.localeCompare(a.creado_en)));
    } catch (err) {
      toast(mensajeError(err, "No se pudo cargar el historial de reportes."), "error");
    } finally {
      setCargandoReportes(false);
    }
  }, [toast]);

  useEffect(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), "error"));
    cargarReportes();
  }, [toast, cargarReportes]);

  // Libera el PDF de la vista previa anterior al reemplazarlo o al salir de la pantalla.
  useEffect(() => {
    return () => {
      if (vistaUrl) URL.revokeObjectURL(vistaUrl);
    };
  }, [vistaUrl]);

  async function verVistaPrevia() {
    setAccion("vista");
    try {
      const { blob } = await reportesApi.vistaPreviaReporte(empresaId, anio);
      setVistaUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast(mensajeError(err, "No se pudo generar la vista previa."), "error");
    } finally {
      setAccion(null);
    }
  }

  async function generar() {
    setAccion("generar");
    try {
      await reportesApi.generarReporte(empresaId, anio);
      toast(`Reporte de ${nombreEmpresa(empresaId)} (${anio}) generado.`, "success");
      await cargarReportes();
    } catch (err) {
      toast(mensajeError(err, "No se pudo generar el reporte."), "error");
    } finally {
      setAccion(null);
    }
  }

  return (
    <>
      <SectionHeader
        titulo="Reportes de prospección"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-4 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow">
            <h3 className="text-title-lg text-on-background mb-md">Parámetros</h3>
            <div className="space-y-md">
              <Campo label="Sector">
                <select value={sector} onChange={(e) => { setSector(e.target.value as SectorApi); setEmpresaId(""); }} className={CLS_SELECT}>
                  {SECTORES_API.map((s) => <option key={s} value={s}>{etiquetaSector(s)}</option>)}
                </select>
              </Campo>
              <Campo label="Empresa">
                <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={CLS_SELECT}>
                  <option value="">— Selecciona una empresa —</option>
                  {empresasSector.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Año">
                <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={CLS_SELECT}>
                  {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Campo>
            </div>
            <div className="grid gap-sm mt-lg">
              <button onClick={verVistaPrevia} disabled={!listo || accion !== null} className="w-full bg-surface border border-primary text-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm hover:bg-primary/5 transition-all text-body-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {accion === "vista" ? <Spinner size={18} /> : <span className="material-symbols-outlined">visibility</span>} Vista previa
              </button>
              <button onClick={generar} disabled={!listo || accion !== null} className="w-full bg-primary text-on-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm shadow-md hover:bg-surface-tint transition-all text-body-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {accion === "generar" ? <Spinner size={18} /> : <span className="material-symbols-outlined">picture_as_pdf</span>} Generar reporte
              </button>
            </div>
            <p className="text-label-sm text-outline mt-md">
              El reporte se arma con el análisis GRI de la empresa y año. Si aún no está validado, valídalo en{" "}
              <Link to="/analisis" className="text-primary hover:underline">Análisis GRI</Link>.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-bright flex justify-between items-center">
              <h3 className="text-title-lg text-on-surface">Vista previa</h3>
              {vistaUrl && <span className="text-label-sm text-on-surface-variant">No se guarda en el historial</span>}
            </div>
            {vistaUrl ? (
              <iframe title="Vista previa del reporte" src={vistaUrl} className="w-full h-[70vh] bg-surface-container-low" />
            ) : (
              <div className="p-xl text-center">
                <span className="material-symbols-outlined text-[40px] text-outline">picture_as_pdf</span>
                <p className="text-body-md text-on-surface-variant mt-sm">Elige empresa y año y pulsa «Vista previa» para revisar el PDF antes de generarlo.</p>
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-bright flex justify-between items-center gap-md">
              <h3 className="text-title-lg text-on-surface">Reportes recientes</h3>
              <Link to="/descargas" className="text-label-md text-primary hover:underline">Ver todos</Link>
            </div>
            {cargandoReportes ? (
              <div className="p-lg space-y-sm">
                {["c1", "c2", "c3"].map((k) => <div key={k} className="h-5 bg-surface-variant rounded animate-pulse" />)}
              </div>
            ) : (
              <TablaReportes
                reportes={reportes.slice(0, RECIENTES)}
                nombreEmpresa={nombreEmpresa}
                descargando={descargando}
                onDescargar={descargar}
                vacio="Aún no se han generado reportes."
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Campo({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
