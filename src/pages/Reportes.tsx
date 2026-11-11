import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import SelectAnioConDocumentos from "../components/SelectAnioConDocumentos";
import { useDisponibilidadReportes } from "../components/useDisponibilidadReportes";
import SectionHeader from "../components/SectionHeader";
import Spinner from "../components/Spinner";
import TablaReportes from "../components/TablaReportes";
import TiraEtapas from "../components/TiraEtapas";
import GuiaVacia from "../components/GuiaVacia";
import VistaPreviaPdf from "../components/VistaPreviaPdf";
import { useToast } from "../components/ToastProvider";
import { useDescargarReporte } from "../components/useDescargarReporte";
import * as empresasApi from "../api/empresas";
import * as reportesApi from "../api/reportes";
import { ApiError, mensajeError, tipoAviso } from "../api/client";
import { descargarBlob } from "../lib/descargas";
import {
  SECTORES_API,
  accionesReporte,
  etiquetaAnioReporte,
  etiquetaSector,
  mensajeEmision,
  nombreArchivoReporte,
  situacionAnioReporte,
  situacionEmision,
  type TonoEstadoReporte,
} from "../lib/dominio";
import { fechaCorta } from "../lib/format";
import type { AnioDisponible, EmpresaApi, ReporteResumen, ReporteVigente, SectorApi } from "../types";

const RECIENTES = 5;
const CLS_SELECT =
  "w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none";
const CLS_BOTON_PRINCIPAL =
  "w-full min-h-12 bg-primary text-on-primary py-sm px-sm flex items-center justify-center gap-sm hover:bg-surface-tint text-body-md font-semibold disabled:cursor-not-allowed";
const CLS_BOTON_SECUNDARIO =
  "w-full min-h-12 bg-surface-container-lowest border border-on-surface text-on-surface py-sm px-sm flex items-center justify-center gap-sm hover:bg-surface-container-low text-body-md font-semibold disabled:cursor-not-allowed";

/** PDF en pantalla. `version` es la versión ya emitida que muestra; null si todavía no se ha emitido. */
interface VistaPrevia {
  archivo: Blob;
  version: number | null;
}

export default function Reportes() {
  const toast = useToast();
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [sector, setSector] = useState<SectorApi>(SECTORES_API[0]);
  const [empresaId, setEmpresaId] = useState("");
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [accion, setAccion] = useState<"vista" | "generar" | "descargar" | null>(null);

  const seleccion = useDisponibilidadReportes(empresaId);
  const { anio, item, vigente, recargar } = seleccion;
  const acciones = accionesReporte(item);
  const { descargar, descargando } = useDescargarReporte();
  const empresasSector = empresas.filter((e) => e.activa && e.sector === sector);
  const empresaNombre = empresas.find((e) => e.id === empresaId)?.nombre ?? "Empresa";

  // Selección vigente: una vista previa que llega tarde de otra empresa o año se descarta.
  const claveSeleccion = `${empresaId}:${anio}`;
  const seleccionActual = useRef(claveSeleccion);
  seleccionActual.current = claveSeleccion;

  const irADescargas = (reporteId?: string | null) => navigate("/descargas", { state: { resaltar: reporteId } });
  const irAAnalisis = () => navigate("/analisis", { state: { sector, empresaId, anio } });

  const cargarEmpresas = useCallback(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), tipoAviso(err)));
  }, [toast]);

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
    cargarEmpresas();
    cargarReportes();
  }, [cargarEmpresas, cargarReportes]);

  // La vista previa corresponde a una selección y a una situación: si cambian, deja de mostrarse.
  useEffect(() => {
    setVista(null);
  }, [empresaId, anio, item?.estado, item?.reporte_id]);

  // Tras un error la situación pudo cambiar: se vuelve a preguntar al servidor.
  function refrescarTrasError(err: unknown) {
    recargar();
    if (err instanceof ApiError && err.code === "COMPANY_NOT_FOUND") {
      setEmpresaId("");
      cargarEmpresas();
    }
  }

  async function verVistaPrevia() {
    if (anio === null) return;
    const clave = claveSeleccion;
    const version = item?.estado === "REPORTE_GENERADO" ? (item.reporte_version ?? null) : null;
    setAccion("vista");
    try {
      const { blob } = await reportesApi.vistaPreviaReporte(empresaId, anio);
      if (seleccionActual.current === clave) setVista({ archivo: blob, version });
    } catch (err) {
      toast(reportesApi.mensajeErrorReporte(err, "No se pudo generar la vista previa."), tipoAviso(err));
      refrescarTrasError(err);
    } finally {
      setAccion(null);
    }
  }

  async function generar() {
    if (anio === null) return;
    setAccion("generar");
    try {
      const emision = await reportesApi.generarReporte(empresaId, anio);
      toast(mensajeEmision(emision), "success");
      setVista(null);
      recargar();
      await cargarReportes();
    } catch (err) {
      if (reportesApi.emisionSinConfirmar(err)) {
        // Sin respuesta no se sabe si se emitió: se consulta en vez de afirmar que falló.
        toast("No recibimos la confirmación del servidor. Revisa la situación del reporte antes de volver a intentarlo.", "warn");
        await cargarReportes();
      } else {
        toast(reportesApi.mensajeErrorReporte(err, "No se pudo generar el reporte."), tipoAviso(err));
      }
      refrescarTrasError(err);
    } finally {
      setAccion(null);
    }
  }

  async function descargarActualizado() {
    if (anio === null) return;
    setAccion("descargar");
    try {
      const { blob } = await reportesApi.descargarReporteActualizado(empresaId, anio);
      descargarBlob(blob, nombreArchivoReporte(empresaNombre, anio, item?.reporte_version));
      toast("Descarga iniciada.", "success");
    } catch (err) {
      // Nunca se cambia por otra versión sin avisar: se explica y la pantalla muestra la nueva situación.
      toast(reportesApi.mensajeErrorReporte(err, "No se pudo descargar el reporte."), tipoAviso(err));
      refrescarTrasError(err);
    } finally {
      setAccion(null);
    }
  }

  function descargarHistorica() {
    if (!item?.reporte_id || !item.reporte_version || anio === null) return;
    descargar({ id: item.reporte_id, empresa_nombre: empresaNombre, anio, version: item.reporte_version });
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
                  seleccion={seleccion}
                  className={`${CLS_SELECT} disabled:opacity-60`}
                  etiqueta={(a) => {
                    const datosAnio = seleccion.items.find((x) => x.anio === a);
                    return datosAnio ? etiquetaAnioReporte(datosAnio) : String(a);
                  }}
                />
              </Campo>
            </div>
            {item && !seleccion.cargando && (
              <div className="mt-lg">
                <TiraEtapas item={item} />
              </div>
            )}
            <div className="grid gap-sm mt-lg">
              <button onClick={verVistaPrevia} disabled={!acciones.vistaPrevia || accion !== null} aria-busy={accion === "vista"} className={CLS_BOTON_SECUNDARIO}>
                {accion === "vista" ? <Spinner size={18} /> : <span className="material-symbols-outlined">visibility</span>} Vista previa
              </button>
              {acciones.descargarActualizado ? (
                <button onClick={descargarActualizado} disabled={accion !== null} aria-busy={accion === "descargar"} className={CLS_BOTON_PRINCIPAL}>
                  {accion === "descargar" ? <Spinner size={18} /> : <span className="material-symbols-outlined">download</span>} Descargar reporte actualizado
                </button>
              ) : (
                <button onClick={generar} disabled={!acciones.generar || accion !== null} aria-busy={accion === "generar"} className={CLS_BOTON_PRINCIPAL}>
                  {accion === "generar" ? <Spinner size={18} /> : <span className="material-symbols-outlined">picture_as_pdf</span>} {acciones.etiquetaGenerar}
                </button>
              )}
              {acciones.descargarHistorica && (
                <button onClick={descargarHistorica} disabled={descargando === item?.reporte_id} aria-busy={descargando === item?.reporte_id} className={CLS_BOTON_SECUNDARIO}>
                  {descargando === item?.reporte_id ? <Spinner size={18} /> : <span className="material-symbols-outlined">history</span>} Descargar versión {item?.reporte_version} — histórica
                </button>
              )}
            </div>
            <SituacionReporte
              hayEmpresa={seleccion.hayEmpresa}
              buscando={seleccion.cargando}
              fallo={seleccion.fallo}
              sinAnios={seleccion.sinAnios}
              item={item}
              onReintentar={recargar}
              onIrAAnalisis={irAAnalisis}
            />
            {item?.reporte_id && <UltimaEmision item={item} vigente={vigente} onVerHistorial={() => irADescargas(item.reporte_id)} />}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-bright flex justify-between items-center gap-md">
              <h3 className="text-title-lg text-on-surface">Vista previa</h3>
              {vista && (
                <span className="text-label-sm text-on-surface-variant text-right">
                  {vista.version ? `Reporte emitido: versión ${vista.version}` : "Vista previa sin emitir; la versión y fecha definitivas se confirman al generar"}
                </span>
              )}
            </div>
            {vista ? (
              <VistaPreviaPdf archivo={vista.archivo} titulo="Vista previa del reporte" />
            ) : (
              <GuiaVacia
                icono="picture_as_pdf"
                mensaje="Elige empresa y año y pulsa «Vista previa» para revisar el PDF."
                pasos={[
                  { texto: "Elige la empresa", hecho: !!empresaId },
                  { texto: "Elige el año", hecho: anio !== null },
                  { texto: "Abre la vista previa", hecho: false },
                ]}
              />
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-bright flex justify-between items-center gap-md">
              <h3 className="text-title-lg text-on-surface">Reportes recientes</h3>
              <Link to="/descargas" className="text-label-md text-primary-ink hover:underline">Ver todos</Link>
            </div>
            {cargandoReportes ? (
              <div className="p-lg space-y-sm">
                {["w-full", "w-5/6", "w-2/3"].map((k) => <div key={k} className={`h-5 ${k} bg-surface-variant animate-pulse`} />)}
              </div>
            ) : (
              <TablaReportes
                reportes={reportes.slice(0, RECIENTES)}
                descargando={descargando}
                onDescargar={descargar}
                vacio="Aún no se han generado reportes."
                conHuella={false}
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

const ICONOS: Record<TonoEstadoReporte, string> = { ok: "check_circle", pendiente: "pending_actions", neutro: "info" };

/** Qué se puede hacer con la empresa y el año elegidos, y qué falta si todavía no se puede. */
function SituacionReporte({
  hayEmpresa,
  buscando,
  fallo,
  sinAnios,
  item,
  onReintentar,
  onIrAAnalisis,
}: Readonly<{
  hayEmpresa: boolean;
  buscando: boolean;
  fallo: boolean;
  sinAnios: boolean;
  item?: AnioDisponible;
  onReintentar: () => void;
  onIrAAnalisis: () => void;
}>) {
  if (!hayEmpresa) {
    return <p className="text-label-sm text-outline mt-md">El reporte se arma con el análisis GRI validado de la empresa y el año.</p>;
  }
  if (buscando) {
    return <p className="text-label-sm text-on-surface-variant mt-md flex items-center gap-xs"><Spinner size={14} /> Revisando los años de la empresa…</p>;
  }
  if (fallo) {
    return (
      <Aviso tono="pendiente" icono="error">
        <span>No se pudo consultar la situación de esta empresa.</span>
        <button type="button" onClick={onReintentar} className="mt-xs font-semibold underline">Volver a intentarlo</button>
      </Aviso>
    );
  }
  if (sinAnios || !item) {
    return <Aviso tono="neutro" icono="info">Esta empresa aún no tiene documentos subidos, así que no hay reporte que generar.</Aviso>;
  }
  const { mensaje, tono, irAAnalisis } = situacionAnioReporte(item);
  return (
    <Aviso tono={tono} icono={ICONOS[tono]}>
      <span>{mensaje}</span>
      {irAAnalisis && (
        <button type="button" onClick={onIrAAnalisis} className="mt-xs inline-flex items-center gap-xs font-semibold underline">
          Ir a Análisis GRI <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
        </button>
      )}
    </Aviso>
  );
}

/** Última versión emitida. Que sea la última no significa que siga actualizada: se muestran por separado. */
function UltimaEmision({ item, vigente, onVerHistorial }: Readonly<{ item: AnioDisponible; vigente: ReporteVigente | null; onVerHistorial: () => void }>) {
  const situacion = situacionEmision(item);
  const fecha = vigente?.creado_en ?? item.reporte_creado_en ?? undefined;
  const validacionDistinta =
    item.ultima_validacion_numero && item.reporte_validacion_numero && item.ultima_validacion_numero !== item.reporte_validacion_numero;
  return (
    <div className="mt-md border border-outline-variant px-md py-sm text-label-md text-on-surface-variant space-y-xs">
      <div className="flex items-center justify-between gap-sm">
        <span className="font-semibold text-on-surface">Última emisión: versión {item.reporte_version}</span>
        <span className={`shrink-0 px-sm py-[2px] text-label-sm uppercase tracking-[0.06em] ${item.reporte_actualizado ? "bg-success-container text-on-success-container" : "bg-tertiary-fixed text-on-tertiary-fixed"}`}>{situacion}</span>
      </div>
      {fecha && <p>Generada el {fechaCorta(fecha)}{vigente ? ` por ${vigente.generado_por_nombre}` : ""}</p>}
      {validacionDistinta && <p>Validación actual: {item.ultima_validacion_numero} · Validación del reporte: {item.reporte_validacion_numero}</p>}
      <button type="button" onClick={onVerHistorial} className="font-semibold text-primary-ink underline">
        Ver historial{item.versiones_emitidas ? ` (${item.versiones_emitidas})` : ""}
      </button>
    </div>
  );
}

const TONOS: Record<TonoEstadoReporte, string> = {
  ok: "bg-success-container text-on-success-container",
  pendiente: "bg-tertiary-fixed text-on-tertiary-fixed",
  neutro: "bg-surface-container-low text-on-surface-variant",
};

function Aviso({ tono, icono, children }: Readonly<{ tono: TonoEstadoReporte; icono: string; children: ReactNode }>) {
  return (
    <output className={`mt-md px-md py-sm text-label-md flex gap-sm ${TONOS[tono]}`}>
      <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">{icono}</span>
      <span className="flex flex-col items-start">{children}</span>
    </output>
  );
}
