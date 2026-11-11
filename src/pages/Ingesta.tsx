import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import SectionHeader from "../components/SectionHeader";
import PaginacionSalto from "../components/PaginacionSalto";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import TiraEtapasIngesta from "../components/TiraEtapasIngesta";
import { useProgresoIngesta } from "../components/useProgresoIngesta";
import { progresoDePasos } from "../lib/progresoIngesta";
import { useToast } from "../components/ToastProvider";
import * as empresasApi from "../api/empresas";
import * as documentosApi from "../api/documentos";
import * as usuariosApi from "../api/usuarios";
import { ApiError, mensajeError, tipoAviso } from "../api/client";
import {
  aniosDisponibles,
  SECTORES_API,
  TIPOS_API,
  etiquetaAnalisis,
  etiquetaEstado,
  etiquetaEstadoOperacion,
  etiquetaEstadoResumida,
  cierreDeCarga,
  etiquetaHallazgos,
  motivoLegible,
  necesitaDecision,
  textoResumenConfirmacion,
  MINUTOS_VIGENCIA_CONFIRMACION,
  estadosDeFiltro,
  FILTROS_ESTADO,
  type FiltroEstado,
  etiquetaSector,
  etiquetaTipo,
  filtrarDocumentos,
  formatearTamano,
  nombrePersona,
  paginarLocal,
  plural,
  textoFragmentos,
  tiposNoCargables,
  validarArchivoIngesta,
} from "../lib/dominio";
import type {
  DocumentoDetalle,
  DocumentoResumen,
  EmpresaApi,
  Operacion,
  ResultadoIngesta,
  SectorApi,
  TipoDocumentoApi,
} from "../types";

/** Lo que devuelve una carga: el resultado completo o la vista de la operación. */
type ResultadoCarga = ResultadoIngesta | Operacion;

const ANIOS = aniosDisponibles();
const TAM_PAGINA = 10;

export default function Ingesta() {
  const toast = useToast();

  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [cargaAbierta, setCargaAbierta] = useState(false);

  // Lista paginada por el backend, o todos los documentos cuando se filtra aquí (null: aún no se traen).
  const [paginaServidor, setPaginaServidor] = useState<{ items: DocumentoResumen[]; pagina: number; paginas: number }>({ items: [], pagina: 1, paginas: 1 });
  const [todosDocs, setTodosDocs] = useState<DocumentoResumen[] | null>(null);
  const [cargandoDocs, setCargandoDocs] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [fEstado, setFEstado] = useState<FiltroEstado>("");
  const [fTipo, setFTipo] = useState<"" | TipoDocumentoApi>("");
  const [fSector, setFSector] = useState<"" | SectorApi>("");
  const [pagina, setPagina] = useState(1);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  // Carga en pausa que se retoma desde la lista para decidir continuar o cancelar.
  const [decisionDoc, setDecisionDoc] = useState<DocumentoResumen | null>(null);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());

  // Nombres de los usuarios, para mostrar «Cargado por» con el nombre y no con su ID.
  useEffect(() => {
    usuariosApi
      .listarUsuarios()
      .then((us) => setNombres(new Map(us.map((u) => [u.id, u.nombre]))))
      .catch(() => setNombres(new Map()));
  }, []);

  const empresasInactivas = new Set(empresas.filter((e) => !e.activa).map((e) => e.id));

  useEffect(() => {
    empresasApi
      .listarEmpresas()
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), tipoAviso(err)));
  }, [toast]);

  // El backend no busca por nombre de empresa, no filtra por sector y filtra un solo estado por
  // petición: en esos casos se traen todos los documentos una vez y se filtra y pagina aquí, así
  // escribir en la búsqueda no hace una petición por tecla.
  const filtroLocal = !!fSector || !!busqueda.trim() || estadosDeFiltro(fEstado).length > 1;
  const paginaAPedir = filtroLocal ? 1 : pagina;

  const cargarDocs = useCallback(async () => {
    setCargandoDocs(true);
    try {
      const estados = estadosDeFiltro(fEstado);
      const filtros = { tipo: fTipo || undefined };
      if (filtroLocal) {
        setTodosDocs(await documentosApi.listarPorEstados(estados, filtros));
      } else {
        const data = await documentosApi.listarDocumentos({ ...filtros, estado: estados[0], pagina: paginaAPedir, tamano: TAM_PAGINA });
        setPaginaServidor({ items: data.items, pagina: data.pagina, paginas: Math.max(1, data.paginas) });
        setTodosDocs(null);
      }
    } catch (err) {
      setTodosDocs((actual) => actual ?? []);
      toast(mensajeError(err, "No se pudieron cargar los documentos."), tipoAviso(err));
    } finally {
      setCargandoDocs(false);
    }
  }, [fEstado, fTipo, filtroLocal, paginaAPedir, toast]);

  useEffect(() => {
    cargarDocs();
  }, [cargarDocs]);

  const listaVisible = filtroLocal
    ? paginarLocal(filtrarDocumentos(todosDocs ?? [], { sector: fSector, busqueda }), pagina, TAM_PAGINA)
    : paginaServidor;
  const { items: docs, pagina: paginaActual, paginas: totalPaginas } = listaVisible;
  const mostrandoCarga = cargandoDocs || (filtroLocal && todosDocs === null);

  return (
    <>
      <SectionHeader titulo="Ingesta de documentos" />

        <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
          <div className="p-lg border-b border-outline-variant bg-surface-bright space-y-md">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <h3 className="text-title-lg text-on-surface">Documentos ingestados</h3>
              <button onClick={() => setCargaAbierta(true)} className="flex items-center justify-center gap-sm px-md py-sm bg-primary text-on-primary rounded-lg text-label-md font-semibold hover:bg-surface-tint transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span> Nueva carga
              </button>
            </div>
            <BarraDocumentos
              busqueda={busqueda}
              onBuscar={(v) => { setBusqueda(v); setPagina(1); }}
              sector={fSector}
              onSector={(v) => { setFSector(v); setPagina(1); }}
              tipo={fTipo}
              onTipo={(v) => { setFTipo(v); setPagina(1); }}
              estado={fEstado}
              onEstado={(v) => { setFEstado(v); setPagina(1); }}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  {["Documento", "Año", "Tipo", "Estado", "Análisis", "Fecha", ""].map((h) => (
                    <th key={h || "acciones"} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-body-md">
                {mostrandoCarga && ["r1", "r2", "r3"].map((k) => (
                  <tr key={k} className="border-b border-surface-variant"><td colSpan={7} className="py-md px-md"><div className="h-5 bg-surface-variant rounded animate-pulse" /></td></tr>
                ))}
                {!mostrandoCarga && docs.length === 0 && (
                  <tr><td colSpan={7} className="py-xl px-md text-center text-on-surface-variant">{filtroLocal || fTipo || fEstado ? "No hay documentos que coincidan con la búsqueda y los filtros." : "Aún no hay documentos ingestados."}</td></tr>
                )}
                {!mostrandoCarga && docs.map((d) => {
                  const inactiva = empresasInactivas.has(d.empresa_id);
                  return (
                  <tr key={d.id} onClick={() => setDetalleId(d.id)} title={inactiva ? "La empresa está desactivada en el catálogo" : undefined} className={`border-b border-surface-variant hover:bg-surface/50 transition-colors cursor-pointer ${inactiva ? "opacity-60" : ""}`}>
                    <td className="py-md px-md">
                      <div className="flex items-center gap-sm">
                        <span className={`material-symbols-outlined ${d.tipo === "REPORTE_SOSTENIBILIDAD_GRI" ? "text-secondary" : "text-primary-ink"}`}>{d.tipo === "REPORTE_SOSTENIBILIDAD_GRI" ? "eco" : "description"}</span>
                        <div>
                          <p className="font-medium text-on-background">{d.empresa_nombre}</p>
                          <p className="text-label-sm text-outline">{d.nombre_archivo} · {formatearTamano(d.tamano_bytes)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-md px-md text-on-surface-variant">{d.anio}</td>
                    <td className="py-md px-md">{etiquetaTipo(d.tipo)}</td>
                    <td className="py-md px-md"><Badge estado={inactiva ? "Inactivo" : etiquetaEstadoResumida(d.estado)} /></td>
                    <td className="py-md px-md text-on-surface-variant">{etiquetaAnalisis(d.resultado_analisis)}</td>
                    <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{fechaHora(d.creado_en)}</td>
                    <td className="py-md px-md text-right">
                      {necesitaDecision(d) && d.operacion_id ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDecisionDoc(d); }}
                          className="inline-flex items-center gap-xs px-sm py-xs rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-label-md font-semibold whitespace-nowrap hover:brightness-95"
                        >
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">pending_actions</span> Revisar decisión
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-xs text-primary-ink text-label-md"><span className="material-symbols-outlined text-[18px]">visibility</span> Ver</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="p-md border-t border-outline-variant">
              <PaginacionSalto pagina={paginaActual} totalPaginas={totalPaginas} onCambiar={setPagina} deshabilitado={mostrandoCarga} />
            </div>
          )}
        </div>
      <NuevaCargaModal abierto={cargaAbierta} empresas={empresas} onClose={() => setCargaAbierta(false)} onIngestado={() => { setPagina(1); cargarDocs(); }} />
      <DecisionPendienteModal documento={decisionDoc} onClose={() => setDecisionDoc(null)} onResuelto={cargarDocs} />
      <DetalleDocumentoModal id={detalleId} empresasInactivas={empresasInactivas} nombres={nombres} onClose={() => setDetalleId(null)} />
    </>
  );
}

/** Formulario de carga de un documento. No se puede cerrar mientras se procesa el archivo. */
function NuevaCargaModal({
  abierto,
  empresas,
  onClose,
  onIngestado,
}: Readonly<{ abierto: boolean; empresas: EmpresaApi[]; onClose: () => void; onIngestado: () => void }>) {
  const toast = useToast();
  const navigate = useNavigate();
  const [sector, setSector] = useState<SectorApi>(SECTORES_API[0]);
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState(ANIOS[0]);
  const [tipo, setTipo] = useState<TipoDocumentoApi>(TIPOS_API[0]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  // Barra de progreso de los 9 pasos: avanza con lo que informa el servidor mientras se procesa.
  const progreso = useProgresoIngesta();
  const [fallo, setFallo] = useState(false);
  const reintentar = useReintentarPublicacion(setResultado, onIngestado, progreso.setOperacion);
  // Doble check: la carga se pausa tras el análisis hasta que se decide continuar o cancelar.
  const { pendiente, setPendiente, resolviendo, resolver } = useDobleCheck((op) => {
    if (op) setResultado(op);
    setArchivo(null);
    setVueltaDisponibilidad((v) => v + 1);
    onIngestado();
  }, progreso);
  const ocupado = enviando || !!pendiente || !!resolviendo;
  // Una empresa tiene como máximo un documento de cada tipo por año: los tipos ya ocupados se deshabilitan.
  const [noCargables, setNoCargables] = useState<Partial<Record<TipoDocumentoApi, string>>>({});
  const [consultando, setConsultando] = useState(false);
  const [vueltaDisponibilidad, setVueltaDisponibilidad] = useState(0);

  const empresasSector = empresas.filter((e) => e.activa && e.sector === sector);
  const sinTiposLibres = TIPOS_API.every((t) => noCargables[t]);

  useEffect(() => {
    setNoCargables({});
    if (!abierto || !empresaId) {
      setConsultando(false);
      return;
    }
    let vigente = true;
    setConsultando(true);
    documentosApi
      .disponibilidadIngesta(empresaId, anio)
      .then((d) => {
        if (!vigente) return;
        const ocupados = tiposNoCargables(d.tipos);
        setNoCargables(ocupados);
        setTipo((actual) => (ocupados[actual] ? (TIPOS_API.find((t) => !ocupados[t]) ?? actual) : actual));
      })
      .catch(() => {
        // Sin la consulta no se bloquea ningún tipo: la carga vuelve a comprobarlo y avisa si ya existe.
      })
      .finally(() => {
        if (vigente) setConsultando(false);
      });
    return () => {
      vigente = false;
    };
  }, [abierto, empresaId, anio, vueltaDisponibilidad]);

  function cerrar() {
    if (enviando || resolviendo) return;
    if (pendiente) {
      // No se decide por la persona: la carga sigue en pausa y se retoma desde la lista.
      toast(`La carga quedó en pausa. Retómala desde la lista con «Revisar decisión» antes de ${MINUTOS_VIGENCIA_CONFIRMACION} minutos.`, "info");
      setPendiente(null);
      onIngestado();
    }
    progreso.detener();
    progreso.setOperacion(null);
    setFallo(false);
    setEmpresaId("");
    setArchivo(null);
    setResultado(null);
    onClose();
  }

  function elegirArchivo(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const v = validarArchivoIngesta(f);
    if (!v.ok) {
      toast(v.motivo ?? "Archivo no válido.", "error");
      return;
    }
    setArchivo(f);
  }

  async function realizarIngesta() {
    if (!empresaId) {
      toast("Selecciona una empresa.", "warn");
      return;
    }
    if (!archivo) {
      toast("Selecciona primero un archivo .md.", "warn");
      return;
    }
    setEnviando(true);
    setResultado(null);
    setPendiente(null);
    setFallo(false);
    progreso.setOperacion(null);
    let opId: string | null = null;
    try {
      const op = await documentosApi.crearOperacion();
      opId = op.operacion_id;
      // El backend procesa la carga de una vez y responde al final: el avance se consulta EN
      // PARALELO, mientras la petición sigue en curso, para ver cada paso.
      const ingesta = documentosApi.ingerirDocumento(op.operacion_id, { archivo, empresaId, anio, tipoDocumento: tipo });
      progreso.seguir(op.operacion_id).catch(() => null);
      let respuesta: Awaited<typeof ingesta>;
      try {
        respuesta = await ingesta;
      } finally {
        progreso.detener();
      }
      const { status, data } = respuesta;
      progreso.setOperacion(data);
      // Si respondió sin terminar ni pausarse, se sigue consultando un rato hasta que termine.
      const enCurso = status !== 202 && !data.terminal && !necesitaDecision(data);
      const final = enCurso ? ((await progreso.seguir(op.operacion_id, data, 20)) ?? data) : data;
      if (necesitaDecision(final)) {
        // No es un error: el análisis terminó y falta decidir.
        setPendiente(final);
        toast("El análisis terminó. Revisa el resumen y decide si continuar.", "info");
        return;
      }
      setResultado({ ...data, ...final });
      if (final.exitosa) {
        toast("Documento ingestado e indexado.", "success");
        setArchivo(null);
        setVueltaDisponibilidad((v) => v + 1);
        onIngestado();
      } else {
        toast("La ingesta no se completó. Revisa el detalle.", "error");
      }
    } catch (err) {
      progreso.detener();
      setFallo(true);
      // Se pregunta en qué paso quedó para marcarlo; sin respuesta, el fallo queda en el paso 1.
      const actual = opId ? await documentosApi.consultarOperacion(opId).catch(() => null) : null;
      progreso.setOperacion(actual);
      toast(mensajeError(err, "No se pudo realizar la ingesta."), tipoAviso(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={abierto} onClose={cerrar} width="max-w-2xl">
      <div className="p-xl overflow-y-auto">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary-ink" aria-hidden="true">upload_file</span> Nueva carga
        </h3>
        <div className="space-y-md">
          {/* Mientras se espera la decisión, el formulario queda bloqueado: la carga ya se hizo. */}
          <fieldset disabled={ocupado} className="space-y-md disabled:opacity-60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Campo label="Sector">
              <select value={sector} onChange={(e) => { setSector(e.target.value as SectorApi); setEmpresaId(""); }} className={CLS_FILTRO}>
                {SECTORES_API.map((s) => (
                  <option key={s} value={s}>{etiquetaSector(s)}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Empresa">
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} title={empresasSector.find((e) => e.id === empresaId)?.nombre} className={`${CLS_FILTRO} truncate`}>
                <option value="">— Selecciona una empresa —</option>
                {empresasSector.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Año">
              <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={CLS_FILTRO}>
                {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Campo>
            <Campo label="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumentoApi)} className={CLS_FILTRO}>
                {TIPOS_API.map((t) => (
                  <option key={t} value={t} disabled={Boolean(noCargables[t])}>
                    {noCargables[t] ? `${etiquetaTipo(t)} — ${noCargables[t]}` : etiquetaTipo(t)}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          {empresaId && sinTiposLibres && (
            <p role="status" className="text-label-sm text-on-surface-variant">
              Esta empresa ya tiene la Memoria Anual y el Reporte de Sostenibilidad GRI de {anio}. Elige otro año.
            </p>
          )}
          {empresasSector.length === 0 && (
            <p className="text-label-sm text-on-surface-variant">No hay empresas activas en este sector. Regístralas en el Catálogo de empresas.</p>
          )}

          <label
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dropzone-active"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("dropzone-active")}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("dropzone-active"); elegirArchivo(e.dataTransfer.files); }}
            className={`flex-col items-center justify-center gap-sm border-2 border-dashed border-outline-variant rounded-xl p-lg text-center cursor-pointer hover:border-primary-ink hover:bg-primary/5 transition-colors ${ocupado || progreso.operacion || fallo ? "hidden" : "flex"}`}
          >
            <span className="material-symbols-outlined text-[36px] text-primary-ink">cloud_upload</span>
            <span className="text-body-md text-on-background font-medium">Arrastra el .md aquí o haz clic para seleccionar</span>
            <span className="text-label-sm text-outline">Sólo Markdown (.md) · hasta 50 MB</span>
            <input type="file" accept=".md,text/markdown" className="hidden" onChange={(e) => { elegirArchivo(e.target.files); e.target.value = ""; }} />
          </label>

          {archivo && (
            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-sm flex items-center gap-xs text-body-md text-on-surface">
              <span className="material-symbols-outlined text-[16px] text-primary-ink" aria-hidden="true">description</span>
              <span className="truncate">{archivo.name}</span>
              <span className="text-outline shrink-0">· {formatearTamano(archivo.size)}</span>
              <button onClick={() => setArchivo(null)} aria-label="Quitar archivo" title="Quitar archivo" className="ml-auto text-outline hover:text-error"><span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span></button>
            </div>
          )}

          </fieldset>

          {(enviando || progreso.operacion || fallo) && (
            <TiraEtapasIngesta progreso={progresoDePasos(progreso.operacion, enviando, fallo)} sinConexion={progreso.sinConexion} />
          )}
          {pendiente && (
            <PanelDobleCheck
              operacion={pendiente}
              resolviendo={resolviendo}
              onConfirmar={() => resolver("confirmar")}
              onCancelar={() => resolver("cancelar")}
            />
          )}
          {resultado && <PanelResultado resultado={resultado} onReintentar={reintentar} />}
        </div>

        <div className="flex flex-wrap items-center gap-sm mt-lg">
          <button onClick={() => navigate("/empresas")} disabled={enviando} className="text-label-md text-primary-ink hover:underline flex items-center gap-xs disabled:opacity-50">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add_business</span> Empresas
          </button>
          <div className="ml-auto flex items-center gap-sm">
            <button onClick={cerrar} disabled={enviando || !!resolviendo} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50">
              {textoBotonCerrar(!!pendiente, !!resultado)}
            </button>
            <button onClick={realizarIngesta} disabled={enviando || consultando || !!pendiente || !archivo || !empresaId || Boolean(noCargables[tipo])} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-sm">
              {/* Mientras procesa, el único indicador es la barra de progreso. */}
              {enviando ? "Procesando…" : <><span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_sync</span> Realizar ingesta</>}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function textoBotonCerrar(pendiente: boolean, conResultado: boolean): string {
  if (pendiente) return "Decidir después";
  return conResultado ? "Cerrar" : "Cancelar";
}

type AccionDobleCheck = "confirmar" | "cancelar";

/**
 * Doble check: continuar o cancelar una carga en pausa. Si otra persona ya decidió (409) o la
 * publicación quedó pendiente (502), se pregunta al servidor cómo quedó en lugar de reintentar a
 * ciegas. Ante un error de red el panel sigue abierto para volver a intentarlo. Nunca decide solo.
 */
type ProgresoCarga = Pick<ReturnType<typeof useProgresoIngesta>, "setOperacion" | "seguir" | "detener">;

function useDobleCheck(onResuelto: (op: Operacion | null) => void, progreso: ProgresoCarga) {
  const toast = useToast();
  const [pendiente, setPendiente] = useState<Operacion | null>(null);
  const [resolviendo, setResolviendo] = useState<AccionDobleCheck | null>(null);
  const resuelto = useRef(onResuelto);
  resuelto.current = onResuelto;

  async function reconciliar(opId: string) {
    const actual = await documentosApi.consultarOperacion(opId).catch(() => null);
    if (actual) progreso.setOperacion(actual);
    if (actual && necesitaDecision(actual)) {
      setPendiente(actual);
      return;
    }
    setPendiente(null);
    resuelto.current(actual);
  }

  async function resolver(accion: AccionDobleCheck) {
    if (!pendiente || resolviendo) return;
    const enPausa = pendiente;
    const opId = pendiente.operacion_id;
    setResolviendo(accion);
    try {
      if (accion === "confirmar") {
        // El paso 6 pasa de «en pausa» a «en curso» y la barra sigue los pasos 7 a 9 mientras responde.
        const enMarcha: Operacion = { ...enPausa, confirmacion_pendiente: false, estado: "EN_PROCESO", etapa: "CONFIRMANDO" };
        progreso.setOperacion(enMarcha);
        progreso.seguir(opId, enMarcha).catch(() => null);
        let op: ResultadoIngesta;
        try {
          op = await documentosApi.confirmarOperacion(opId);
        } finally {
          progreso.detener();
        }
        progreso.setOperacion(op);
        setPendiente(null);
        toast(op.exitosa ? "Documento ingestado e indexado." : "La ingesta no se completó. Revisa el detalle.", op.exitosa ? "success" : "error");
        resuelto.current(op);
      } else {
        const op = await documentosApi.cancelarOperacion(opId);
        progreso.setOperacion(op);
        setPendiente(null);
        toast("Carga cancelada. Ya puedes volver a cargar ese documento.", "info");
        resuelto.current(op);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast("Esta carga ya se había resuelto. Se muestra cómo quedó.", "warn");
        await reconciliar(opId);
      } else if (err instanceof ApiError && err.status === 502) {
        toast("El documento se cargó, pero falta publicarlo. Usa «Reintentar publicación».", "warn");
        await reconciliar(opId);
      } else {
        progreso.setOperacion(enPausa); // la carga sigue en pausa: se puede volver a decidir
        toast(mensajeError(err, "No se pudo completar la decisión. Inténtalo de nuevo."), tipoAviso(err));
      }
    } finally {
      setResolviendo(null);
    }
  }

  return { pendiente, setPendiente, resolviendo, resolver };
}

/** Reintento de la publicación de un documento que quedó cargado pero sin publicar. */
function useReintentarPublicacion(
  setResultado: (f: (prev: ResultadoCarga | null) => ResultadoCarga | null) => void,
  onPublicado: () => void,
  setOperacion: (op: Operacion) => void,
) {
  const toast = useToast();
  return async function reintentar(opId: string) {
    try {
      const op = await documentosApi.reintentarPublicacion(opId);
      setOperacion(op);
      setResultado((prev) => (prev ? { ...prev, ...op } : op));
      toast(op.exitosa ? "Publicación completada." : "Aún no se pudo publicar.", op.exitosa ? "success" : "warn");
      if (op.exitosa) onPublicado();
    } catch (err) {
      toast(mensajeError(err, "No se pudo reintentar la publicación."), tipoAviso(err));
    }
  };
}

/** Resumen del análisis con los botones para continuar o cancelar la carga en pausa. */
function PanelDobleCheck({
  operacion,
  resolviendo,
  onConfirmar,
  onCancelar,
}: Readonly<{ operacion: Operacion; resolviendo: AccionDobleCheck | null; onConfirmar: () => void; onCancelar: () => void }>) {
  const tituloId = useId();
  const caja = useRef<HTMLElement>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  // Al aparecer se lleva a la vista: en pantallas bajas el formulario lo deja fuera.
  useEffect(() => {
    caja.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, []);
  const r = operacion.resumen_confirmacion;
  const advertencias = (r?.advertencias ?? []).filter((a) => a.mensaje);
  const motivos = r?.motivos ?? [];
  const ocupado = resolviendo !== null;

  return (
    <section ref={caja} aria-labelledby={tituloId} aria-busy={ocupado} className="rounded-xl border border-tertiary/40 bg-tertiary-fixed/20 p-lg space-y-md">
      <div className="flex items-start gap-sm">
        <span className="material-symbols-outlined text-tertiary" aria-hidden="true">pending_actions</span>
        <div className="min-w-0">
          <h4 id={tituloId} className="text-title-md text-on-background">Revisa el análisis antes de continuar</h4>
          <p role="status" aria-live="polite" className="text-body-md text-on-surface-variant mt-xs">{textoResumenConfirmacion(r)}</p>
        </div>
      </div>

      {r && (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          <Contador etiqueta="Resultado" valor={etiquetaHallazgos(r.resultado)} />
          <Contador etiqueta="Referencias GRI" valor={plural(r.referencias_gri, "grupo", "grupos")} />
          <Contador etiqueta="Sanciones" valor={plural(r.sanciones, "mención", "menciones")} />
        </dl>
      )}

      {advertencias.length > 0 && (
        <details className="text-body-md text-on-surface-variant">
          <summary className="cursor-pointer text-label-md text-on-surface">Advertencias ({advertencias.length})</summary>
          <ul className="mt-xs space-y-xs">
            {advertencias.map((a, i) => (
              <li key={`${a.codigo ?? ""}-${i}`} className="flex items-start gap-xs text-label-sm">
                <span className="material-symbols-outlined text-[14px] text-tertiary mt-[1px]" aria-hidden="true">warning</span>
                {a.mensaje}
              </li>
            ))}
          </ul>
        </details>
      )}
      {motivos.length > 0 && (
        <details className="text-body-md text-on-surface-variant">
          <summary className="cursor-pointer text-label-md text-on-surface">Detalle técnico</summary>
          <ul className="mt-xs list-disc list-inside text-label-sm space-y-xs">
            {motivos.map((m) => <li key={m}>{motivoLegible(m)}</li>)}
          </ul>
        </details>
      )}

      <p className="flex items-start gap-xs text-label-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span>
        Si nadie decide, la carga se cancelará sola a los {MINUTOS_VIGENCIA_CONFIRMACION} minutos y se eliminarán el archivo y sus fragmentos.
      </p>

      {confirmandoCancelar ? (
        <div className="rounded-lg border border-error/40 bg-error-container/30 p-md space-y-sm">
          <p className="text-body-md text-on-error-container">
            ¿Cancelar la carga? Se eliminarán el archivo original y sus fragmentos, y no se puede deshacer.
          </p>
          <div className="flex flex-wrap justify-end gap-sm">
            <button type="button" onClick={() => setConfirmandoCancelar(false)} disabled={ocupado} className="px-md py-sm rounded-lg border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50">
              Volver
            </button>
            <button type="button" onClick={onCancelar} disabled={ocupado} className="px-md py-sm rounded-lg bg-error text-on-error text-label-md font-semibold flex items-center gap-sm disabled:opacity-60">
              {resolviendo === "cancelar" ? <><Spinner size={16} /> Cancelando…</> : "Sí, cancelar y eliminar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-sm">
          <button type="button" onClick={() => setConfirmandoCancelar(true)} disabled={ocupado} className="px-md py-sm rounded-lg border border-error/60 text-error text-label-md font-semibold hover:bg-error-container/30 disabled:opacity-50">
            Cancelar y eliminar
          </button>
          <button type="button" onClick={onConfirmar} disabled={ocupado} className="px-md py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint flex items-center gap-sm disabled:opacity-60">
            {resolviendo === "confirmar" ? (
              "Continuando…"
            ) : (
              <><span className="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span> Continuar con la ingesta</>
            )}
          </button>
        </div>
      )}
    </section>
  );
}

function Contador({ etiqueta, valor }: Readonly<{ etiqueta: string; valor: string }>) {
  return (
    <div className="rounded-lg bg-surface-container-lowest border border-outline-variant px-md py-sm">
      <dt className="text-label-sm text-on-surface-variant">{etiqueta}</dt>
      <dd className="text-body-md font-semibold text-on-surface">{valor}</dd>
    </div>
  );
}

/** Retoma desde la lista una carga en pausa: consulta cómo está y, si sigue esperando, muestra la decisión. */
function DecisionPendienteModal({
  documento,
  onClose,
  onResuelto,
}: Readonly<{ documento: DocumentoResumen | null; onClose: () => void; onResuelto: () => void }>) {
  const toast = useToast();
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const resuelto = useRef(onResuelto);
  resuelto.current = onResuelto;
  const progreso = useProgresoIngesta();
  const { setOperacion, detener } = progreso;
  const reintentar = useReintentarPublicacion(setResultado, () => resuelto.current(), setOperacion);
  const { pendiente, setPendiente, resolviendo, resolver } = useDobleCheck((op) => {
    setResultado(op);
    resuelto.current();
  }, progreso);
  const opId = documento?.operacion_id ?? null;

  useEffect(() => {
    if (!opId) return;
    let vigente = true;
    setCargando(true);
    setResultado(null);
    setPendiente(null);
    setOperacion(null);
    documentosApi
      .consultarOperacion(opId)
      .then((op) => {
        if (!vigente) return;
        setOperacion(op);
        if (necesitaDecision(op)) {
          setPendiente(op);
        } else {
          setResultado(op);
          toast("Esta carga ya se había resuelto. Se muestra cómo quedó.", "info");
          resuelto.current();
        }
      })
      .catch((err) => {
        if (vigente) toast(mensajeError(err, "No se pudo consultar la carga."), tipoAviso(err));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
      detener();
    };
  }, [opId, setPendiente, setOperacion, detener, toast]);

  function cerrar() {
    if (resolviendo) return;
    onClose();
  }

  return (
    <Modal open={!!documento} onClose={cerrar} width="max-w-2xl">
      <div className="p-xl overflow-y-auto space-y-md">
        <div>
          <h3 className="text-title-lg text-on-background flex items-center gap-sm">
            <span className="material-symbols-outlined text-tertiary" aria-hidden="true">pending_actions</span> Decisión pendiente
          </h3>
          {documento && (
            <p className="text-label-md text-on-surface-variant mt-xs">
              {documento.empresa_nombre} · {documento.anio} · {etiquetaTipo(documento.tipo)} · {documento.nombre_archivo}
            </p>
          )}
        </div>
        {cargando && (
          <p className="flex items-center gap-sm text-body-md text-on-surface-variant"><Spinner size={16} /> Cargando…</p>
        )}
        {progreso.operacion && <TiraEtapasIngesta progreso={progresoDePasos(progreso.operacion, false)} sinConexion={progreso.sinConexion} />}
        {pendiente && (
          <PanelDobleCheck operacion={pendiente} resolviendo={resolviendo} onConfirmar={() => resolver("confirmar")} onCancelar={() => resolver("cancelar")} />
        )}
        {resultado && <PanelResultado resultado={resultado} onReintentar={reintentar} />}
        <div className="flex justify-end">
          <button onClick={cerrar} disabled={!!resolviendo} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50">
            {pendiente ? "Decidir después" : "Cerrar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const CLS_FILTRO =
  "w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none";

/** Búsqueda por empresa y botón «Filtros», que despliega debajo los filtros de la lista. */
function BarraDocumentos({
  busqueda,
  onBuscar,
  sector,
  onSector,
  tipo,
  onTipo,
  estado,
  onEstado,
}: Readonly<{
  busqueda: string;
  onBuscar: (v: string) => void;
  sector: "" | SectorApi;
  onSector: (v: "" | SectorApi) => void;
  tipo: "" | TipoDocumentoApi;
  onTipo: (v: "" | TipoDocumentoApi) => void;
  estado: FiltroEstado;
  onEstado: (v: FiltroEstado) => void;
}>) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();
  const activos = [sector, tipo, estado].filter(Boolean).length;

  function limpiarFiltros() {
    onSector("");
    onTipo("");
    onEstado("");
  }

  return (
    <div className="space-y-sm">
      <div className="flex flex-wrap gap-sm">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-[20px] text-outline" aria-hidden="true">search</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            aria-label="Buscar por empresa"
            placeholder="Buscar por empresa…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm pl-[40px] pr-[40px] text-body-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          {busqueda && (
            <button type="button" onClick={() => onBuscar("")} aria-label="Borrar búsqueda" title="Borrar búsqueda" className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-on-surface-variant hover:text-primary-ink">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls={idPanel}
          className={`shrink-0 flex items-center gap-xs px-md py-sm rounded-lg border text-label-md font-semibold transition-colors ${activos > 0 ? "border-primary-ink text-primary-ink" : "border-outline-variant text-on-surface-variant"} hover:bg-surface-container-low`}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">tune</span>
          Filtros
          {activos > 0 && (
            <span className="min-w-[20px] h-5 px-xs rounded-full bg-primary text-on-primary text-label-sm flex items-center justify-center" aria-label={`${activos} activos`}>{activos}</span>
          )}
          <span className={`material-symbols-outlined text-[20px] transition-transform duration-200 ease-out ${abierto ? "rotate-180" : ""}`} aria-hidden="true">expand_more</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
      {abierto && (
        // Se despliega desde el botón: alto y opacidad juntos, así el contenido no salta.
        <motion.div
          id={idPanel}
          className="overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
        <div className="border border-outline-variant bg-surface-container-lowest p-md space-y-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
            <Campo label="Sector">
              <select aria-label="Filtrar por sector" value={sector} onChange={(e) => onSector(e.target.value as "" | SectorApi)} className={CLS_FILTRO}>
                <option value="">Todos</option>
                {SECTORES_API.map((s) => <option key={s} value={s}>{etiquetaSector(s)}</option>)}
              </select>
            </Campo>
            <Campo label="Tipo">
              <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => onTipo(e.target.value as "" | TipoDocumentoApi)} className={CLS_FILTRO}>
                <option value="">Todos</option>
                {TIPOS_API.map((t) => <option key={t} value={t}>{etiquetaTipo(t)}</option>)}
              </select>
            </Campo>
            <Campo label="Estado">
              <select aria-label="Filtrar por estado" value={estado} onChange={(e) => onEstado(e.target.value as FiltroEstado)} className={CLS_FILTRO}>
                <option value="">Todos</option>
                {FILTROS_ESTADO.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
              </select>
            </Campo>
          </div>
          {activos > 0 && (
            <button type="button" onClick={limpiarFiltros} className="text-label-md text-primary-ink hover:underline">Limpiar filtros</button>
          )}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function Campo({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

function Dato({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
      <span className="text-body-md text-on-background break-words">{children}</span>
    </div>
  );
}

function DetalleDocumentoModal({
  id,
  empresasInactivas,
  nombres,
  onClose,
}: Readonly<{ id: string | null; empresasInactivas: Set<string>; nombres: Map<string, string>; onClose: () => void }>) {
  const toast = useToast();
  const [doc, setDoc] = useState<DocumentoDetalle | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (id === null) {
      setDoc(null);
      return;
    }
    setCargando(true);
    documentosApi
      .detalleDocumento(id)
      .then(setDoc)
      .catch((err) => {
        toast(mensajeError(err, "No se pudo cargar el detalle."), tipoAviso(err));
        onClose();
      })
      .finally(() => setCargando(false));
  }, [id, toast, onClose]);

  const analisisJson = doc?.analisis && Object.keys(doc.analisis).length > 0 ? JSON.stringify(doc.analisis, null, 2) : null;

  return (
    <Modal open={id !== null} onClose={onClose}>
      <div className="p-xl max-h-[80vh] overflow-y-auto">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary-ink">description</span> Detalle del documento
        </h3>

        {cargando && <div className="flex items-center gap-sm text-on-surface-variant"><Spinner size={18} /> Cargando…</div>}

        {!cargando && doc && (
          <div className="space-y-lg">
            {empresasInactivas.has(doc.empresa_id) && (
              <div className="flex items-start gap-sm rounded-lg bg-surface-variant text-on-surface-variant px-md py-sm text-body-md">
                <span className="material-symbols-outlined text-[18px]">block</span>
                <span>La empresa de este documento está desactivada en el catálogo. El documento no se considera en el análisis GRI.</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-md">
              <Dato label="Empresa">{doc.empresa_nombre}</Dato>
              <Dato label="Sector">{etiquetaSector(doc.sector)}</Dato>
              <Dato label="Año">{doc.anio}</Dato>
              <Dato label="Tipo">{etiquetaTipo(doc.tipo)}</Dato>
              <Dato label="Estado"><Badge estado={etiquetaEstado(doc.estado)} /></Dato>
              <Dato label="Análisis">{etiquetaAnalisis(doc.resultado_analisis)}</Dato>
              <Dato label="Disponible para el asistente de IA">{doc.disponible_para_rag ? "Sí" : "No"}</Dato>
              <Dato label="Fragmentos">{doc.fragmentos_total ?? doc.fragmentos_procesados}</Dato>
              <Dato label="Advertencias">{doc.cantidad_advertencias}</Dato>
            </div>

            <div className="grid grid-cols-1 gap-md border-t border-surface-variant pt-md">
              <Dato label="Archivo">{doc.nombre_archivo} · {formatearTamano(doc.tamano_bytes)}</Dato>
              <div className="grid grid-cols-2 gap-md">
                <Dato label="Cargado por">{nombrePersona(doc.cargado_por, nombres)}</Dato>
                <Dato label="Creado">{fechaHora(doc.creado_en)}</Dato>
                <Dato label="Actualizado">{fechaHora(doc.actualizado_en)}</Dato>
                <Dato label="Completado">{doc.completado_en ? fechaHora(doc.completado_en) : "—"}</Dato>
              </div>
            </div>

            {doc.error && (
              <div className="rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">
                <strong>{doc.error.code}:</strong> {doc.error.message}
              </div>
            )}

            <DetallesTecnicos sha256={doc.sha256} etapa={doc.etapa} analisisJson={analisisJson} />
          </div>
        )}

        <div className="flex justify-end mt-lg">
          <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low">Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

function DetallesTecnicos({
  sha256,
  etapa,
  analisisJson,
}: Readonly<{ sha256: string; etapa?: string | null; analisisJson: string | null }>) {
  const toast = useToast();
  async function copiar() {
    try {
      await navigator.clipboard.writeText(sha256);
      toast("Huella copiada.", "success");
    } catch {
      toast("No se pudo copiar. Selecciónala y cópiala manualmente.", "warn");
    }
  }
  return (
    <details className="rounded-lg border border-outline-variant bg-surface-container-low/50 group">
      <summary className="cursor-pointer select-none px-md py-sm text-label-md text-on-surface-variant flex items-center gap-xs">
        <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90" aria-hidden="true">chevron_right</span>
        <span>Detalles técnicos</span>
      </summary>
      <div className="px-md pb-md space-y-md">
        <div>
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Huella del archivo (SHA-256)</p>
          <p className="text-label-sm text-outline mt-xs">Identifica este archivo exacto: permite detectar cargas duplicadas y comprobar que no fue modificado.</p>
          <div className="mt-xs flex items-start gap-sm">
            <code className="flex-1 min-w-0 break-all rounded bg-surface-container-lowest border border-outline-variant px-sm py-xs text-label-sm">{sha256}</code>
            <button onClick={copiar} title="Copiar huella" aria-label="Copiar huella" className="shrink-0 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">content_copy</span>
            </button>
          </div>
        </div>
        {etapa && (
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Etapa del procesamiento</p>
            <p className="text-label-md text-on-surface mt-xs">{etapa}</p>
          </div>
        )}
        {analisisJson && (
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Resultado del análisis (datos sin procesar)</p>
            <pre className="rounded-lg bg-surface-container-lowest border border-outline-variant p-sm text-label-sm overflow-x-auto max-h-64">{analisisJson}</pre>
          </div>
        )}
      </div>
    </details>
  );
}

const PANEL_RESULTADO = {
  exito: { caja: "border-primary/40 bg-primary/5", icono: "text-primary-ink", simbolo: "task_alt", titulo: "Ingesta completada" },
  porPublicar: { caja: "border-tertiary/40 bg-tertiary-fixed/20", icono: "text-tertiary", simbolo: "cloud_sync", titulo: "Falta publicar el documento" },
  fallo: { caja: "border-error/40 bg-error-container/30", icono: "text-error", simbolo: "error", titulo: "Ingesta no completada" },
} as const;

// El documento quedó cargado pero sin publicar: no es un fallo, falta un paso que se puede reintentar.
function tipoPanelResultado(r: Operacion): keyof typeof PANEL_RESULTADO {
  if (r.exitosa) return "exito";
  return r.publicacion_reintentable ? "porPublicar" : "fallo";
}

function PanelResultado({ resultado, onReintentar }: Readonly<{ resultado: ResultadoCarga; onReintentar: (opId: string) => void }>) {
  const cierre = cierreDeCarga(resultado);
  if (cierre) return <PanelCargaCerrada cierre={cierre} />;
  const motivos = "motivos" in resultado ? resultado.motivos ?? [] : [];
  const exito = resultado.exitosa;
  const estilo = PANEL_RESULTADO[tipoPanelResultado(resultado)];
  return (
    <div role="status" aria-live="polite" className={`rounded-xl border p-lg ${estilo.caja}`}>
      <div className="flex items-center gap-sm mb-sm">
        <span className={`material-symbols-outlined ${estilo.icono}`} aria-hidden="true">{estilo.simbolo}</span>
        <h4 className="text-title-md text-on-background">{estilo.titulo}</h4>
      </div>
      <p className="text-body-md text-on-surface-variant mb-sm">Estado: <strong>{etiquetaEstadoOperacion(resultado.estado)}</strong></p>
      {exito && (
        <p className="text-body-md text-on-surface-variant">
          Análisis: {resultado.resultado_analisis ? etiquetaHallazgos(resultado.resultado_analisis) : "—"}
          {typeof resultado.fragmentos_total === "number" ? ` · ${textoFragmentos(resultado.fragmentos_procesados, resultado.fragmentos_total)}` : ""}
        </p>
      )}
      {motivos.length > 0 && (
        <details className="mt-sm text-body-md text-on-surface-variant">
          <summary className="cursor-pointer text-label-md text-on-surface">Detalle técnico</summary>
          <ul className="mt-xs list-disc list-inside text-label-sm space-y-xs">
            {motivos.map((m) => <li key={m}>{motivoLegible(m)}</li>)}
          </ul>
        </details>
      )}
      {resultado.error && <p className="mt-sm text-body-md text-on-error-container">{resultado.error.message}</p>}
      {resultado.publicacion_reintentable && (
        <button onClick={() => onReintentar(resultado.operacion_id)} className="mt-md px-md py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span> Reintentar publicación
        </button>
      )}
    </div>
  );
}

/** Carga que no siguió por decisión o por vencimiento: no es un error, se informa en tono neutro. */
function PanelCargaCerrada({ cierre }: Readonly<{ cierre: "cancelada" | "vencida" }>) {
  const cancelada = cierre === "cancelada";
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-outline-variant bg-surface-container-low p-lg">
      <div className="flex items-center gap-sm mb-sm">
        <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">{cancelada ? "block" : "timer_off"}</span>
        <h4 className="text-title-md text-on-background">{cancelada ? "Carga cancelada" : "Carga vencida"}</h4>
      </div>
      <p className="text-body-md text-on-surface-variant">
        {cancelada ? "" : `Pasaron ${MINUTOS_VIGENCIA_CONFIRMACION} minutos sin una decisión y la carga se canceló sola. `}
        Se eliminaron el archivo original y sus fragmentos. Puedes volver a cargar el documento para esta empresa y año.
      </p>
    </div>
  );
}
