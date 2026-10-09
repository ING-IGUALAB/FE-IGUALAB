import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import { useToast } from "../components/ToastProvider";
import * as empresasApi from "../api/empresas";
import * as documentosApi from "../api/documentos";
import { mensajeError } from "../api/client";
import {
  SECTORES_API,
  TIPOS_API,
  etiquetaAnalisis,
  etiquetaEstado,
  etiquetaSector,
  etiquetaTipo,
  formatearTamano,
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
const ANIO_ACTUAL = new Date().getFullYear();

export default function Ingesta() {
  const toast = useToast();
  const navigate = useNavigate();

  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [sector, setSector] = useState<SectorApi>(SECTORES_API[0]);
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState(ANIO_ACTUAL - 1);
  const [tipo, setTipo] = useState<TipoDocumentoApi>(TIPOS_API[0]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoIngesta | Operacion | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<DocumentoResumen[]>([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargandoDocs, setCargandoDocs] = useState(true);
  const [fEstado, setFEstado] = useState<"" | EstadoProgreso>("");
  const [fTipo, setFTipo] = useState<"" | TipoDocumentoApi>("");
  const [pagina, setPagina] = useState(1);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const empresasSector = empresas.filter((e) => e.sector === sector);

  useEffect(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), "error"));
  }, [toast]);

  const cargarDocs = useCallback(async () => {
    setCargandoDocs(true);
    try {
      const data = await documentosApi.listarDocumentos({
        estado: fEstado || undefined,
        tipo: fTipo || undefined,
        pagina,
        tamano: 10,
      });
      setDocs(data.items);
      setPaginaActual(data.pagina);
      setTotalPaginas(Math.max(1, data.paginas));
    } catch (err) {
      toast(mensajeError(err, "No se pudieron cargar los documentos."), "error");
    } finally {
      setCargandoDocs(false);
    }
  }, [fEstado, fTipo, pagina, toast]);

  useEffect(() => {
    cargarDocs();
  }, [cargarDocs]);

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
        setPagina(1);
        cargarDocs();
      } else {
        toast("La ingesta no se completó. Revisa el detalle.", "error");
      }
    } catch (err) {
      toast(mensajeError(err, "No se pudo realizar la ingesta."), "error");
    } finally {
      setEnviando(false);
    }
  }

  async function reintentar(opId: string) {
    try {
      const op = await documentosApi.reintentarPublicacion(opId);
      setResultado((prev) => (prev ? { ...prev, ...op } : op));
      toast(op.exitosa ? "Publicación completada." : "Aún no se pudo publicar.", op.exitosa ? "success" : "warn");
      if (op.exitosa) cargarDocs();
    } catch (err) {
      toast(mensajeError(err, "No se pudo reintentar la publicación."), "error");
    }
  }

  return (
    <>
      <SectionHeader titulo="Ingesta de documentos" sub="Carga de memorias anuales y reportes de sostenibilidad GRI en Markdown (RN-012). El backend valida, indexa y analiza de forma síncrona (RF-022)." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-1 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant ambient-shadow p-lg">
            <div className="flex items-center justify-between mb-md">
              <h3 className="text-title-lg text-on-background">Nueva carga</h3>
              <button onClick={() => navigate("/empresas")} className="text-label-md text-primary hover:underline flex items-center gap-xs">
                <span className="material-symbols-outlined text-[16px]">add_business</span> Empresas
              </button>
            </div>
            <div className="space-y-md">
              <Campo label="Sector (RN-019)">
                <select value={sector} onChange={(e) => { setSector(e.target.value as SectorApi); setEmpresaId(""); }} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  {SECTORES_API.map((s) => (
                    <option key={s} value={s}>{etiquetaSector(s)}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Empresa (RN-014)">
                <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  <option value="">— Selecciona una empresa —</option>
                  {empresasSector.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
                {empresasSector.length === 0 && (
                  <span className="text-label-sm text-on-surface-variant">No hay empresas activas en este sector. Regístralas en el Catálogo de empresas.</span>
                )}
              </Campo>
              <div className="grid grid-cols-2 gap-sm">
                <Campo label="Año">
                  <input type="number" min={2000} max={ANIO_ACTUAL} value={anio} onChange={(e) => setAnio(Number.parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </Campo>
                <Campo label="Tipo (RN-011)">
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumentoApi)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                    {TIPOS_API.map((t) => (
                      <option key={t} value={t}>{etiquetaTipo(t)}</option>
                    ))}
                  </select>
                </Campo>
              </div>

              <label
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dropzone-active"); }}
                onDragLeave={(e) => e.currentTarget.classList.remove("dropzone-active")}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("dropzone-active"); elegirArchivo(e.dataTransfer.files); }}
                className="flex flex-col items-center justify-center gap-sm border-2 border-dashed border-outline-variant rounded-xl p-lg text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="material-symbols-outlined text-[36px] text-primary">cloud_upload</span>
                <span className="text-body-md text-on-background font-medium">Arrastra el .md aquí o haz clic para seleccionar</span>
                <span className="text-label-sm text-outline">Sólo Markdown (.md) · hasta 50 MB (RNF-014)</span>
                <input ref={inputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={(e) => { elegirArchivo(e.target.files); e.target.value = ""; }} />
              </label>

              {archivo && (
                <div className="rounded-lg border border-outline-variant bg-surface-container-low p-sm flex items-center gap-xs text-body-md text-on-surface">
                  <span className="material-symbols-outlined text-[16px] text-primary">description</span> {archivo.name}
                  <span className="text-outline">· {formatearTamano(archivo.size)}</span>
                  <button onClick={() => setArchivo(null)} className="ml-auto text-outline hover:text-error"><span className="material-symbols-outlined text-[18px]">close</span></button>
                </div>
              )}

              <button onClick={realizarIngesta} disabled={enviando || !archivo || !empresaId} className="w-full bg-primary text-on-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm shadow-md hover:bg-surface-tint transition-all text-body-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {enviando ? <><Spinner size={18} /> Procesando…</> : <><span className="material-symbols-outlined">cloud_sync</span> Realizar ingesta</>}
              </button>
            </div>
          </div>

          {resultado && <PanelResultado resultado={resultado} onReintentar={reintentar} />}
        </div>

        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
          <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-col sm:flex-row sm:justify-between sm:items-center gap-md">
            <h3 className="text-title-lg text-on-surface">Documentos ingestados</h3>
            <div className="flex flex-wrap items-center gap-sm">
              <select value={fTipo} onChange={(e) => { setFTipo(e.target.value as "" | TipoDocumentoApi); setPagina(1); }} className="rounded-lg border border-outline-variant bg-surface-container-low py-xs px-sm text-label-md focus:border-primary outline-none">
                <option value="">Todo tipo</option>
                {TIPOS_API.map((t) => <option key={t} value={t}>{etiquetaTipo(t)}</option>)}
              </select>
              <select value={fEstado} onChange={(e) => { setFEstado(e.target.value as "" | EstadoProgreso); setPagina(1); }} className="rounded-lg border border-outline-variant bg-surface-container-low py-xs px-sm text-label-md focus:border-primary outline-none">
                <option value="">Todo estado</option>
                {ESTADOS.map((s) => <option key={s} value={s}>{etiquetaEstado(s)}</option>)}
              </select>
            </div>
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
                {cargandoDocs && ["r1", "r2", "r3"].map((k) => (
                  <tr key={k} className="border-b border-surface-variant"><td colSpan={7} className="py-md px-md"><div className="h-5 bg-surface-variant rounded animate-pulse" /></td></tr>
                ))}
                {!cargandoDocs && docs.length === 0 && (
                  <tr><td colSpan={7} className="py-xl px-md text-center text-on-surface-variant">Aún no hay documentos ingestados.</td></tr>
                )}
                {!cargandoDocs && docs.map((d) => (
                  <tr key={d.id} onClick={() => setDetalleId(d.id)} className="border-b border-surface-variant hover:bg-surface/50 transition-colors cursor-pointer">
                    <td className="py-md px-md">
                      <div className="flex items-center gap-sm">
                        <span className={`material-symbols-outlined ${d.tipo === "REPORTE_SOSTENIBILIDAD_GRI" ? "text-secondary" : "text-primary"}`}>{d.tipo === "REPORTE_SOSTENIBILIDAD_GRI" ? "eco" : "description"}</span>
                        <div>
                          <p className="font-medium text-on-background">{d.empresa_nombre}</p>
                          <p className="text-label-sm text-outline">{d.nombre_archivo} · {formatearTamano(d.tamano_bytes)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-md px-md text-on-surface-variant">{d.anio}</td>
                    <td className="py-md px-md">{etiquetaTipo(d.tipo)}</td>
                    <td className="py-md px-md"><Badge estado={etiquetaEstado(d.estado)} /></td>
                    <td className="py-md px-md text-on-surface-variant">{etiquetaAnalisis(d.resultado_analisis)}</td>
                    <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{fechaHora(d.creado_en)}</td>
                    <td className="py-md px-md text-right">
                      <span className="inline-flex items-center gap-xs text-primary text-label-md"><span className="material-symbols-outlined text-[18px]">visibility</span> Ver</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between p-md border-t border-outline-variant">
              <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaActual <= 1} className="px-md py-xs rounded-lg border border-outline-variant text-label-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-low">Anterior</button>
              <span className="text-label-md text-on-surface-variant">Página {paginaActual} de {totalPaginas}</span>
              <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual >= totalPaginas} className="px-md py-xs rounded-lg border border-outline-variant text-label-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-low">Siguiente</button>
            </div>
          )}
        </div>
      </div>
      <DetalleDocumentoModal id={detalleId} onClose={() => setDetalleId(null)} />
    </>
  );
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function Campo({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-xs">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      {children}
    </div>
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

function DetalleDocumentoModal({ id, onClose }: Readonly<{ id: string | null; onClose: () => void }>) {
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
        toast(mensajeError(err, "No se pudo cargar el detalle."), "error");
        onClose();
      })
      .finally(() => setCargando(false));
  }, [id, toast, onClose]);

  const analisisJson = doc?.analisis && Object.keys(doc.analisis).length > 0 ? JSON.stringify(doc.analisis, null, 2) : null;

  return (
    <Modal open={id !== null} onClose={onClose}>
      <div className="p-xl max-h-[80vh] overflow-y-auto">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">description</span> Detalle del documento
        </h3>

        {cargando && <div className="flex items-center gap-sm text-on-surface-variant"><Spinner size={18} /> Cargando…</div>}

        {!cargando && doc && (
          <div className="space-y-lg">
            <div className="grid grid-cols-2 gap-md">
              <Dato label="Empresa">{doc.empresa_nombre}</Dato>
              <Dato label="Sector">{etiquetaSector(doc.sector)}</Dato>
              <Dato label="Año">{doc.anio}</Dato>
              <Dato label="Tipo">{etiquetaTipo(doc.tipo)}</Dato>
              <Dato label="Estado"><Badge estado={etiquetaEstado(doc.estado)} /></Dato>
              <Dato label="Análisis">{etiquetaAnalisis(doc.resultado_analisis)}</Dato>
              <Dato label="Disponible para RAG">{doc.disponible_para_rag ? "Sí" : "No"}</Dato>
              <Dato label="Fragmentos">{doc.fragmentos_procesados}{typeof doc.fragmentos_total === "number" ? ` / ${doc.fragmentos_total}` : ""}</Dato>
              <Dato label="Etapa">{doc.etapa || "—"}</Dato>
              <Dato label="Advertencias">{doc.cantidad_advertencias}</Dato>
            </div>

            <div className="grid grid-cols-1 gap-md border-t border-surface-variant pt-md">
              <Dato label="Archivo">{doc.nombre_archivo} · {formatearTamano(doc.tamano_bytes)}</Dato>
              <Dato label="SHA-256"><code className="text-label-sm">{doc.sha256}</code></Dato>
              <div className="grid grid-cols-2 gap-md">
                <Dato label="Cargado por">{doc.cargado_por}</Dato>
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

            {analisisJson && (
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Análisis (crudo)</p>
                <pre className="rounded-lg bg-surface-container-low border border-outline-variant p-sm text-label-sm overflow-x-auto max-h-64">{analisisJson}</pre>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end mt-lg">
          <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low">Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

function PanelResultado({ resultado, onReintentar }: Readonly<{ resultado: ResultadoIngesta | Operacion; onReintentar: (opId: string) => void }>) {
  const motivos = "motivos" in resultado ? resultado.motivos ?? [] : [];
  const exito = resultado.exitosa;
  return (
    <div className={`rounded-xl border p-lg ${exito ? "border-primary/40 bg-primary/5" : "border-error/40 bg-error-container/30"}`}>
      <div className="flex items-center gap-sm mb-sm">
        <span className={`material-symbols-outlined ${exito ? "text-primary" : "text-error"}`}>{exito ? "task_alt" : "error"}</span>
        <h4 className="text-title-md text-on-background">{exito ? "Ingesta completada" : "Ingesta no completada"}</h4>
      </div>
      <p className="text-body-md text-on-surface-variant mb-sm">Estado: <strong>{etiquetaEstado(resultado.estado as EstadoProgreso)}</strong>{resultado.etapa ? ` · ${resultado.etapa}` : ""}</p>
      {exito && (
        <p className="text-body-md text-on-surface-variant">
          Análisis: {etiquetaAnalisis(resultado.resultado_analisis)}
          {typeof resultado.fragmentos_total === "number" ? ` · ${resultado.fragmentos_procesados}/${resultado.fragmentos_total} fragmentos` : ""}
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
