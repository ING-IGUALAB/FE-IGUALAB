import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import SelectAnioConDocumentos from "../components/SelectAnioConDocumentos";
import { useAniosConDocumentos } from "../components/useAniosConDocumentos";
import SectionHeader from "../components/SectionHeader";
import Spinner from "../components/Spinner";
import TablaReportes from "../components/TablaReportes";
import VistaPreviaPdf from "../components/VistaPreviaPdf";
import { useToast } from "../components/ToastProvider";
import { useDescargarReporte } from "../components/useDescargarReporte";
import * as empresasApi from "../api/empresas";
import * as reportesApi from "../api/reportes";
import { mensajeError, tipoAviso } from "../api/client";
import { SECTORES_API, etiquetaAnioReporte, etiquetaFlujo, etiquetaSector, reporteDe, type EstadoAnio } from "../lib/dominio";
import type { EmpresaApi, ReporteResumen, SectorApi } from "../types";

const RECIENTES = 5;
const CLS_SELECT =
  "w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none";

export default function Reportes() {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [sector, setSector] = useState<SectorApi>(SECTORES_API[0]);
  const [empresaId, setEmpresaId] = useState("");
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [vista, setVista] = useState<Blob | null>(null);
  const [accion, setAccion] = useState<"vista" | "generar" | null>(null);
  const navigate = useNavigate();

  const nombreEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nombre ?? "Empresa";
  const { descargar, descargando } = useDescargarReporte(nombreEmpresa);
  const empresasSector = empresas.filter((e) => e.activa && e.sector === sector);
  // Años de la empresa: los que tienen documentos (con el estado de su análisis) y los que ya tienen reporte.
  const aniosConReporte = reportes.filter((r) => r.empresa_id === empresaId).map((r) => r.anio);
  const aniosEmpresa = useAniosConDocumentos(empresaId, undefined, aniosConReporte);
  const { anio, estados } = aniosEmpresa;
  const estadoAnio = anio === null ? undefined : estados[anio];
  const listo = !!empresaId && anio !== null;
  // Los reportes son únicos por empresa y año: si ya existe, se va a descargarlo en vez de generarlo.
  const existente = listo ? reporteDe(reportes, empresaId, anio) : undefined;
  // La vista previa y la generación solo proceden con el análisis GRI validado.
  const habilitado = !!estadoAnio?.habilitaReporte;
  const irADescargas = (reporteId?: string) => navigate("/descargas", { state: { resaltar: reporteId } });
  const irAAnalisis = () => navigate("/analisis", { state: { sector, empresaId, anio } });

  const cargarReportes = useCallback(async () => {
    try {
      const data = await reportesApi.listarReportes();
      setReportes([...data].sort((a, b) => b.creado_en.localeCompare(a.creado_en)));
    } catch (err) {
      toast(mensajeError(err, "No se pudo cargar el historial de reportes."), tipoAviso(err));
    } finally {
      setCargandoReportes(false);
    }
  }, [toast]);

  useEffect(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), tipoAviso(err)));
    cargarReportes();
  }, [toast, cargarReportes]);

  // La vista previa corresponde a una empresa y año: al cambiarlos, deja de mostrarse.
  useEffect(() => {
    setVista(null);
  }, [empresaId, anio]);

  async function verVistaPrevia() {
    if (anio === null) return;
    setAccion("vista");
    try {
      const { blob } = await reportesApi.vistaPreviaReporte(empresaId, anio);
      setVista(blob);
    } catch (err) {
      toast(mensajeError(err, "No se pudo generar la vista previa."), tipoAviso(err));
    } finally {
      setAccion(null);
    }
  }

  async function generar() {
    if (existente) {
      irADescargas(existente.id);
      return;
    }
    if (anio === null) return;
    setAccion("generar");
    try {
      await reportesApi.generarReporte(empresaId, anio);
      toast(`Reporte de ${nombreEmpresa(empresaId)} (${anio}) generado.`, "success");
      await cargarReportes();
    } catch (err) {
      // Otro usuario pudo generarlo recién: se lleva a descargarlo, sin alerta.
      const previo = reportesApi.reporteYaExistente(err);
      if (previo) {
        irADescargas(previo.reporteId);
        return;
      }
      toast(mensajeError(err, "No se pudo generar el reporte."), tipoAviso(err));
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
                <SelectAnioConDocumentos
                  seleccion={aniosEmpresa}
                  className={`${CLS_SELECT} disabled:opacity-60`}
                  etiqueta={(a) => etiquetaAnioReporte(a, estados[a], aniosConReporte.includes(a))}
                />
              </Campo>
            </div>
            <div className="grid gap-sm mt-lg">
              <button onClick={verVistaPrevia} disabled={!listo || !habilitado || accion !== null} className="w-full bg-surface border border-primary text-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm hover:bg-primary/5 transition-all text-body-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {accion === "vista" ? <Spinner size={18} /> : <span className="material-symbols-outlined">visibility</span>} Vista previa
              </button>
              <button onClick={generar} disabled={!listo || (!existente && !habilitado) || accion !== null} className="w-full bg-primary text-on-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm shadow-md hover:bg-surface-tint transition-all text-body-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {accion === "generar" && <Spinner size={18} />}
                {accion !== "generar" && <span className="material-symbols-outlined">{existente ? "download" : "picture_as_pdf"}</span>}
                {existente ? "Ver reporte generado" : "Generar reporte"}
              </button>
            </div>
            <EstadoReporte
              hayEmpresa={!!empresaId}
              buscando={aniosEmpresa.cargando}
              sinDocumentos={aniosEmpresa.sinDocumentos}
              existente={!!existente}
              estado={estadoAnio}
              onIrAAnalisis={irAAnalisis}
            />
          </div>
        </div>

        <div className="lg:col-span-8 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-bright flex justify-between items-center">
              <h3 className="text-title-lg text-on-surface">Vista previa</h3>
              {vista && <span className="text-label-sm text-on-surface-variant">No se guarda en el historial</span>}
            </div>
            {vista ? (
              <VistaPreviaPdf archivo={vista} titulo="Vista previa del reporte" />
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

/** Qué se puede hacer con la empresa y el año elegidos, y qué falta si todavía no se puede. */
function EstadoReporte({
  hayEmpresa,
  buscando,
  sinDocumentos,
  existente,
  estado,
  onIrAAnalisis,
}: Readonly<{
  hayEmpresa: boolean;
  buscando: boolean;
  sinDocumentos: boolean;
  existente: boolean;
  estado?: EstadoAnio;
  onIrAAnalisis: () => void;
}>) {
  if (!hayEmpresa) {
    return <p className="text-label-sm text-outline mt-md">El reporte se arma con el análisis GRI validado de la empresa y el año.</p>;
  }
  if (buscando) {
    return <p className="text-label-sm text-on-surface-variant mt-md flex items-center gap-xs"><Spinner size={14} /> Revisando los años con documentos…</p>;
  }
  if (sinDocumentos) {
    return <Aviso tono="neutro" icono="info">Esta empresa aún no tiene documentos subidos, así que no hay reporte que generar.</Aviso>;
  }
  if (existente) {
    return <Aviso tono="neutro" icono="inventory_2">Ya existe el reporte de esta empresa y año; los reportes no se vuelven a generar.</Aviso>;
  }
  if (estado?.habilitaReporte) {
    return <Aviso tono="ok" icono="check_circle">Análisis validado: ya puedes ver la vista previa y generar el reporte.</Aviso>;
  }
  return (
    <Aviso tono="pendiente" icono="pending_actions">
      <span>
        El análisis GRI de este año aún no está validado
        {estado ? ` (${etiquetaFlujo(estado.estadoFlujo).toLowerCase()})` : ""}. Valídalo para poder ver la vista previa y
        generar el reporte.
      </span>
      <button type="button" onClick={onIrAAnalisis} className="mt-xs inline-flex items-center gap-xs font-semibold underline">
        Ir a validarlo en Análisis GRI <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
      </button>
    </Aviso>
  );
}

const TONOS = {
  ok: "bg-primary/10 text-primary",
  pendiente: "bg-tertiary-fixed/60 text-on-tertiary-fixed",
  neutro: "bg-surface-container-low text-on-surface-variant",
} as const;

function Aviso({ tono, icono, children }: Readonly<{ tono: keyof typeof TONOS; icono: string; children: ReactNode }>) {
  return (
    <output className={`mt-md rounded-lg px-md py-sm text-label-md flex gap-sm ${TONOS[tono]}`}>
      <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">{icono}</span>
      <span className="flex flex-col items-start">{children}</span>
    </output>
  );
}
