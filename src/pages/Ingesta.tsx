import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import SectionHeader from "../components/SectionHeader";
import PaginacionSalto from "../components/PaginacionSalto";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import { useToast } from "../components/ToastProvider";
import * as empresasApi from "../api/empresas";
import * as documentosApi from "../api/documentos";
import * as usuariosApi from "../api/usuarios";
import { mensajeError, tipoAviso } from "../api/client";
import {
  aniosDisponibles,
  SECTORES_API,
  TIPOS_API,
  etiquetaAnalisis,
  etiquetaEstado,
  etiquetaSector,
  etiquetaTipo,
  filtrarDocumentos,
  formatearTamano,
  nombrePersona,
  paginarLocal,
  textoFragmentos,
  validarArchivoIngesta,
} from "../lib/dominio";
import type {
  DocumentoDetalle,
  DocumentoResumen,
  EmpresaApi,
  EstadoProgreso,
  Operacion,
  ResultadoIngesta,
  SectorApi,
  TipoDocumentoApi,
} from "../types";

const ESTADOS: EstadoProgreso[] = ["COMPLETADO", "EN_PROCESO", "PUBLICACION_PENDIENTE", "FALLIDO", "FALLIDO_LIMPIEZA_PENDIENTE"];
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
  const [fEstado, setFEstado] = useState<"" | EstadoProgreso>("");
  const [fTipo, setFTipo] = useState<"" | TipoDocumentoApi>("");
  const [fSector, setFSector] = useState<"" | SectorApi>("");
  const [pagina, setPagina] = useState(1);
  const [detalleId, setDetalleId] = useState<string | null>(null);
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

  // El backend no busca por nombre de empresa ni filtra por sector: en esos casos se traen todos los
  // documentos una vez y se filtra aquí, así escribir en la búsqueda no hace una petición por tecla.
  const filtroLocal = !!fSector || !!busqueda.trim();
  const paginaAPedir = filtroLocal ? 1 : pagina;

  const cargarDocs = useCallback(async () => {
    setCargandoDocs(true);
    try {
      const filtros = { estado: fEstado || undefined, tipo: fTipo || undefined };
      if (filtroLocal) {
        setTodosDocs(await documentosApi.listarTodosDocumentos(filtros));
      } else {
        const data = await documentosApi.listarDocumentos({ ...filtros, pagina: paginaAPedir, tamano: TAM_PAGINA });
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
                    <td className="py-md px-md"><Badge estado={inactiva ? "Inactivo" : etiquetaEstado(d.estado)} /></td>
                    <td className="py-md px-md text-on-surface-variant">{etiquetaAnalisis(d.resultado_analisis)}</td>
                    <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{fechaHora(d.creado_en)}</td>
                    <td className="py-md px-md text-right">
                      <span className="inline-flex items-center gap-xs text-primary-ink text-label-md"><span className="material-symbols-outlined text-[18px]">visibility</span> Ver</span>
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
  const [resultado, setResultado] = useState<ResultadoIngesta | Operacion | null>(null);

  const empresasSector = empresas.filter((e) => e.activa && e.sector === sector);

  function cerrar() {
    if (enviando) return;
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

  async function esperarTerminal(opId: string, inicial: Operacion): Promise<Operacion> {
    let actual = inicial;
    let intentos = 0;
    while (!actual.terminal && intentos < 20) {
      await new Promise((r) => setTimeout(r, 1500));
      actual = await documentosApi.consultarOperacion(opId);
      intentos += 1;
    }
    return actual;
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
    try {
      const op = await documentosApi.crearOperacion();
      const res = await documentosApi.ingerirDocumento(op.operacion_id, {
        archivo,
        empresaId,
        anio,
        tipoDocumento: tipo,
      });
      const final = res.terminal ? res : await esperarTerminal(op.operacion_id, res);
      setResultado({ ...res, ...final });
      if (final.exitosa) {
        toast("Documento ingestado e indexado.", "success");
        setArchivo(null);
        onIngestado();
      } else {
        toast("La ingesta no se completó. Revisa el detalle.", "error");
      }
    } catch (err) {
      toast(mensajeError(err, "No se pudo realizar la ingesta."), tipoAviso(err));
    } finally {
      setEnviando(false);
    }
  }

  async function reintentar(opId: string) {
    try {
      const op = await documentosApi.reintentarPublicacion(opId);
      setResultado((prev) => (prev ? { ...prev, ...op } : op));
      toast(op.exitosa ? "Publicación completada." : "Aún no se pudo publicar.", op.exitosa ? "success" : "warn");
      if (op.exitosa) onIngestado();
    } catch (err) {
      toast(mensajeError(err, "No se pudo reintentar la publicación."), tipoAviso(err));
    }
  }

  return (
    <Modal open={abierto} onClose={cerrar} width="max-w-2xl">
      <div className="p-xl overflow-y-auto">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary-ink" aria-hidden="true">upload_file</span> Nueva carga
        </h3>
        <div className="space-y-md">
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
                  <option key={t} value={t}>{etiquetaTipo(t)}</option>
                ))}
              </select>
            </Campo>
          </div>
          {empresasSector.length === 0 && (
            <p className="text-label-sm text-on-surface-variant">No hay empresas activas en este sector. Regístralas en el Catálogo de empresas.</p>
          )}

          <label
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dropzone-active"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("dropzone-active")}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("dropzone-active"); elegirArchivo(e.dataTransfer.files); }}
            className="flex flex-col items-center justify-center gap-sm border-2 border-dashed border-outline-variant rounded-xl p-lg text-center cursor-pointer hover:border-primary-ink hover:bg-primary/5 transition-colors"
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

          {resultado && <PanelResultado resultado={resultado} onReintentar={reintentar} />}
        </div>

        <div className="flex flex-wrap items-center gap-sm mt-lg">
          <button onClick={() => navigate("/empresas")} disabled={enviando} className="text-label-md text-primary-ink hover:underline flex items-center gap-xs disabled:opacity-50">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add_business</span> Empresas
          </button>
          <div className="ml-auto flex items-center gap-sm">
            <button onClick={cerrar} disabled={enviando} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50">
              {resultado ? "Cerrar" : "Cancelar"}
            </button>
            <button onClick={realizarIngesta} disabled={enviando || !archivo || !empresaId} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-sm">
              {enviando ? <><Spinner size={16} /> Procesando…</> : <><span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_sync</span> Realizar ingesta</>}
            </button>
          </div>
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
  estado: "" | EstadoProgreso;
  onEstado: (v: "" | EstadoProgreso) => void;
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
              <select aria-label="Filtrar por estado" value={estado} onChange={(e) => onEstado(e.target.value as "" | EstadoProgreso)} className={CLS_FILTRO}>
                <option value="">Todos</option>
                {ESTADOS.map((s) => <option key={s} value={s}>{etiquetaEstado(s)}</option>)}
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

function PanelResultado({ resultado, onReintentar }: Readonly<{ resultado: ResultadoIngesta | Operacion; onReintentar: (opId: string) => void }>) {
  const motivos = "motivos" in resultado ? resultado.motivos ?? [] : [];
  const exito = resultado.exitosa;
  return (
    <div className={`rounded-xl border p-lg ${exito ? "border-primary/40 bg-primary/5" : "border-error/40 bg-error-container/30"}`}>
      <div className="flex items-center gap-sm mb-sm">
        <span className={`material-symbols-outlined ${exito ? "text-primary-ink" : "text-error"}`}>{exito ? "task_alt" : "error"}</span>
        <h4 className="text-title-md text-on-background">{exito ? "Ingesta completada" : "Ingesta no completada"}</h4>
      </div>
      <p className="text-body-md text-on-surface-variant mb-sm">Estado: <strong>{etiquetaEstado(resultado.estado as EstadoProgreso)}</strong>{resultado.etapa ? ` · ${resultado.etapa}` : ""}</p>
      {exito && (
        <p className="text-body-md text-on-surface-variant">
          Análisis: {etiquetaAnalisis(resultado.resultado_analisis)}
          {typeof resultado.fragmentos_total === "number" ? ` · ${textoFragmentos(resultado.fragmentos_procesados, resultado.fragmentos_total)}` : ""}
        </p>
      )}
      {motivos.length > 0 && (
        <ul className="mt-sm list-disc list-inside text-body-md text-on-error-container space-y-xs">
          {motivos.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {resultado.error && <p className="mt-sm text-body-md text-on-error-container">{resultado.error.message}</p>}
      {resultado.publicacion_reintentable && (
        <button onClick={() => onReintentar(resultado.operacion_id)} className="mt-md px-md py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">refresh</span> Reintentar publicación
        </button>
      )}
    </div>
  );
}
