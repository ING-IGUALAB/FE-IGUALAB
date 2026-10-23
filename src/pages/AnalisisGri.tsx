import { useCallback, useEffect, useState, type ReactNode } from "react";
import SectionHeader from "../components/SectionHeader";
import Paginacion from "../components/Paginacion";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import { useAniosConDocumentos } from "../components/useAniosConDocumentos";
import SelectAnioConDocumentos from "../components/SelectAnioConDocumentos";
import * as empresasApi from "../api/empresas";
import * as analisisApi from "../api/analisis";
import { ApiError, mensajeError, tipoAviso } from "../api/client";
import {
  ESTADOS_GRI_API,
  ESTADO_GRI_LABEL,
  FLUJO_INFO,
  SECTORES_API,
  detallePuntaje,
  etiquetaEstadoGri,
  etiquetaSector,
  plural,
  puedeValidar,
  textoMonto,
  textoMotivosNoVigente,
  valorPuntaje,
} from "../lib/dominio";
import type {
  AdvertenciaAnalisis,
  AnalisisGri as Analisis,
  EmpresaApi,
  EstadoGriApi,
  EvidenciaGri,
  FilaGri,
  PaginaHistorialGri,
  ResumenSanciones,
  SancionVista,
  SectorApi,
  ValidacionVista,
} from "../types";

const CLS_SELECT =
  "w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none";
const CLS_CARD = "bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden";

// Garantiza listas aunque el backend omita alguna, para que la vista nunca se caiga.
function normalizar(a: Analisis): Analisis {
  return {
    ...a,
    filas: a.filas ?? [],
    documentos: a.documentos ?? [],
    advertencias: a.advertencias ?? [],
    sanciones: a.sanciones ?? [],
    pendientes: a.pendientes ?? [],
  };
}

export default function AnalisisGri() {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [sector, setSector] = useState<SectorApi>(SECTORES_API[0]);
  const [empresaId, setEmpresaId] = useState("");
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);

  useEffect(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), tipoAviso(err)));
  }, [toast]);

  const empresasSector = empresas.filter((e) => e.sector === sector);

  // Solo se ofrecen los años en que la empresa tiene documentos subidos (se buscan al elegirla).
  const aniosEmpresa = useAniosConDocumentos(empresaId);
  const { anio, sinDocumentos } = aniosEmpresa;

  const cargar = useCallback(
    async (empId: string, a: number) => {
      setCargando(true);
      try {
        setAnalisis(normalizar(await analisisApi.consultarAnalisis(empId, a)));
      } catch (err) {
        setAnalisis(null);
        toast(mensajeError(err, "No se pudo consultar el análisis."), tipoAviso(err));
      } finally {
        setCargando(false);
      }
    },
    [toast],
  );

  function consultar() {
    if (!empresaId) {
      toast("Selecciona una empresa.", "warn");
      return;
    }
    if (anio === null) {
      toast("Esta empresa aún no tiene documentos subidos.", "warn");
      return;
    }
    cargar(empresaId, anio);
  }

  async function recargar() {
    if (analisis) await cargar(analisis.empresa.id, analisis.anio);
  }

  async function cambiarEstado(fila: FilaGri, estado: EstadoGriApi) {
    if (!analisis || fila.estado === estado) return;
    setGuardando(fila.identidad);
    try {
      const r = await analisisApi.asignarEstado(analisis.empresa.id, analisis.anio, fila.identidad, estado, fila.version_fila);
      if (r.validacion_previa_invalidada) {
        toast("Estado actualizado. La validación anterior quedó sin vigencia; vuelve a validar.", "warn");
      } else {
        toast(`${fila.estandar}: ${etiquetaEstadoGri(r.estado)}.`, "success");
      }
      await recargar();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast("Este código cambió desde que lo consultaste. Se actualizó el análisis.", "warn");
        await recargar();
      } else {
        toast(mensajeError(err, "No se pudo asignar el estado."), tipoAviso(err));
      }
    } finally {
      setGuardando(null);
    }
  }

  async function validar() {
    if (!analisis) return;
    setValidando(true);
    try {
      await analisisApi.validarAnalisis(analisis.empresa.id, analisis.anio, analisis.version, analisis.huella_documentos);
      toast("Análisis validado.", "success");
      await recargar();
    } catch (err) {
      toast(mensajeError(err, "No se pudo validar el análisis."), tipoAviso(err));
      if (err instanceof ApiError && err.status === 409) await recargar();
    } finally {
      setValidando(false);
    }
  }

  return (
    <>
      <SectionHeader
        titulo="Análisis y validación GRI"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-4 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow">
            <h3 className="text-title-lg text-on-background mb-md">Parámetros</h3>
            <div className="space-y-md">
              <Campo label="Sector">
                <select value={sector} onChange={(e) => { setSector(e.target.value as SectorApi); setEmpresaId(""); }} className={CLS_SELECT}>
                  {SECTORES_API.map((s) => (
                    <option key={s} value={s}>{etiquetaSector(s)}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Empresa">
                <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={CLS_SELECT}>
                  <option value="">— Selecciona una empresa —</option>
                  {empresasSector.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
                {empresasSector.length === 0 && (
                  <span className="text-label-sm text-on-surface-variant">No hay empresas activas en este sector.</span>
                )}
              </Campo>
              <Campo label="Año">
                <SelectAnioConDocumentos seleccion={aniosEmpresa} className={`${CLS_SELECT} disabled:opacity-60`} />
              </Campo>
              {sinDocumentos && (
                <p className="text-label-sm text-on-surface-variant -mt-sm">Esta empresa aún no tiene documentos subidos.</p>
              )}
            </div>
            <button onClick={consultar} disabled={cargando || anio === null} className="w-full mt-lg bg-primary text-on-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm shadow-md hover:bg-surface-tint transition-all text-body-lg font-semibold disabled:opacity-60">
              {cargando ? <Spinner size={18} /> : <span className="material-symbols-outlined">search</span>} Consultar análisis
            </button>
          </div>

          {analisis && (
            <ResumenCard analisis={analisis} validando={validando} onValidar={validar} onHistorial={() => setHistorialOpen(true)} />
          )}
        </div>

        <div className="lg:col-span-8 space-y-lg">
          {!analisis && (
            <div className={`${CLS_CARD} p-xl text-center`}>
              <span className="material-symbols-outlined text-[40px] text-outline">fact_check</span>
              <p className="text-body-md text-on-surface-variant mt-sm">Elige sector, empresa y año, y pulsa «Consultar análisis».</p>
            </div>
          )}
          {analisis && <TablaFilas filas={analisis.filas} guardando={guardando} onCambiar={cambiarEstado} />}
          {analisis && analisis.documentos.length > 0 && (
            <SancionesCard sanciones={analisis.sanciones} resumen={analisis.resumen_sanciones} />
          )}
          {analisis && analisis.advertencias.length > 0 && <AdvertenciasCard advertencias={analisis.advertencias} />}
        </div>
      </div>

      <HistorialModal
        abierto={historialOpen}
        empresaId={analisis?.empresa.id ?? null}
        anio={analisis?.anio ?? null}
        onClose={() => setHistorialOpen(false)}
      />
    </>
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

function ResumenCard({
  analisis,
  validando,
  onValidar,
  onHistorial,
}: Readonly<{ analisis: Analisis; validando: boolean; onValidar: () => void; onHistorial: () => void }>) {
  const flujo = FLUJO_INFO[analisis.estado_flujo];
  const habilitado = puedeValidar(analisis.estado_flujo) && !validando;
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow space-y-md">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
            {etiquetaSector(analisis.empresa.sector)} · {analisis.anio}
          </p>
          <h3 className="text-title-lg text-on-background break-words">{analisis.empresa.nombre}</h3>
        </div>
        <Badge estado={flujo.etiqueta} />
      </div>
      <p className="text-body-md text-on-surface-variant">{flujo.descripcion}</p>

      <div className="rounded-lg bg-surface-container-low p-md">
        <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Puntaje ESG</p>
        <p className="text-headline-md font-bold text-on-background">{valorPuntaje(analisis.puntaje)}</p>
        <p className="text-label-sm text-outline">{detallePuntaje(analisis.puntaje)}</p>
      </div>

      <EstadoValidacion validacion={analisis.validacion} />

      {analisis.pendientes.length > 0 && (
        <ul className="space-y-xs">
          {analisis.pendientes.map((p) => (
            <li key={p.codigo} className="flex items-start gap-xs text-label-md text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-tertiary">pending_actions</span>
              {p.mensaje}
            </li>
          ))}
        </ul>
      )}

      <p className="text-label-sm text-outline">Documentos analizados: {analisis.documentos.length}</p>

      <div className="grid gap-sm">
        <button onClick={onValidar} disabled={!habilitado} className="w-full bg-primary text-on-primary py-sm px-lg rounded-lg flex items-center justify-center gap-sm hover:bg-surface-tint transition-all text-label-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
          {validando ? <Spinner size={16} /> : <span className="material-symbols-outlined text-[18px]">verified</span>} Validar análisis
        </button>
        <button onClick={onHistorial} className="w-full border border-outline-variant text-on-surface-variant py-sm px-lg rounded-lg flex items-center justify-center gap-sm hover:bg-surface-container-low text-label-md">
          <span className="material-symbols-outlined text-[18px]">history</span> Historial de cambios
        </button>
      </div>
    </div>
  );
}

function EstadoValidacion({ validacion }: Readonly<{ validacion: ValidacionVista | null }>) {
  if (!validacion) {
    return <p className="text-body-md text-on-surface-variant">Aún no se ha validado este análisis.</p>;
  }
  return (
    <div className="text-body-md">
      <div className="flex items-center gap-sm">
        <Badge estado={validacion.vigente ? "Vigente" : "Sin vigencia"} />
        <span className="text-on-background">Validación #{validacion.numero}</span>
      </div>
      <p className="text-label-sm text-outline mt-xs">
        Por {validacion.validado_por.nombre} · {fechaHora(validacion.validado_en)}
      </p>
      {!validacion.vigente && validacion.motivos_no_vigente.length > 0 && (
        <p className="text-label-sm text-on-surface-variant mt-xs">
          Perdió vigencia porque {textoMotivosNoVigente(validacion.motivos_no_vigente)}.
        </p>
      )}
    </div>
  );
}

function TablaFilas({
  filas,
  guardando,
  onCambiar,
}: Readonly<{ filas: FilaGri[]; guardando: string | null; onCambiar: (fila: FilaGri, estado: EstadoGriApi) => void }>) {
  const conEstado = filas.filter((f) => f.estado).length;
  return (
    <div className={CLS_CARD}>
      <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-wrap justify-between items-center gap-sm">
        <h3 className="text-title-lg text-on-surface">Códigos GRI</h3>
        <span className="text-label-sm text-on-surface-variant">
          {conEstado} de {filas.length} con estado asignado
        </span>
      </div>
      {filas.length === 0 ? (
        <p className="p-xl text-center text-body-md text-on-surface-variant">No hay códigos GRI para evaluar.</p>
      ) : (
        <div className="divide-y divide-surface-variant">
          {filas.map((f) => (
            <FilaItem key={f.identidad} fila={f} guardando={guardando === f.identidad} onCambiar={onCambiar} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaItem({
  fila,
  guardando,
  onCambiar,
}: Readonly<{ fila: FilaGri; guardando: boolean; onCambiar: (fila: FilaGri, estado: EstadoGriApi) => void }>) {
  const ediciones = fila.candidatos.length > 0 ? `Ediciones posibles: ${fila.candidatos.join(", ")}` : undefined;
  return (
    <div className="p-lg flex flex-col md:flex-row md:items-start gap-md">
      <div className="flex-1 min-w-0 space-y-xs">
        <div className="flex flex-wrap items-center gap-sm">
          <span className="bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded text-label-sm font-bold">{fila.estandar}</span>
          {fila.requiere_revision && (
            <span title={ediciones} className="bg-tertiary-fixed text-on-tertiary-fixed px-2 py-0.5 rounded-full text-label-sm">
              Requiere revisión
            </span>
          )}
        </div>
        <p className="font-medium text-on-background">{fila.nombre ?? "Nombre no disponible en el catálogo"}</p>
        <p className="text-label-sm text-outline">
          {plural(fila.total_menciones, "mención", "menciones")} · {fila.menciones_en_indice} en índice GRI · {fila.menciones_en_cuerpo} en el cuerpo
        </p>
        {fila.advertencias.map((a) => (
          <p key={a.codigo + a.mensaje} className="flex items-start gap-xs text-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px] text-tertiary">warning</span>
            {a.mensaje}
          </p>
        ))}
        <Evidencias evidencias={fila.evidencias} />
      </div>
      <div className="md:w-56 flex flex-col gap-xs">
        <label className="flex flex-col gap-xs">
          <span className="text-label-sm text-on-surface-variant">Estado</span>
          <select
            aria-label={`Estado de ${fila.estandar}`}
            value={fila.estado ?? ""}
            disabled={guardando}
            onChange={(e) => onCambiar(fila, e.target.value as EstadoGriApi)}
            className="rounded-lg border border-outline-variant bg-surface-container-low py-xs px-sm text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
          >
            {!fila.estado && <option value="" disabled>— Asignar estado —</option>}
            {ESTADOS_GRI_API.map((s) => (
              <option key={s} value={s}>{ESTADO_GRI_LABEL[s]}</option>
            ))}
          </select>
        </label>
        {guardando && (
          <span className="flex items-center gap-xs text-label-sm text-outline"><Spinner size={12} /> Guardando…</span>
        )}
        {fila.asignado_por && (
          <span className="text-label-sm text-outline">
            Por {fila.asignado_por.nombre}
            {fila.asignado_en ? ` · ${fechaHora(fila.asignado_en)}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function Evidencias({ evidencias }: Readonly<{ evidencias: EvidenciaGri[] }>) {
  if (evidencias.length === 0) return null;
  const [primera, ...resto] = evidencias;
  return (
    <div className="space-y-xs pt-xs">
      <Cita evidencia={primera} />
      {resto.length > 0 && (
        <details className="text-label-sm">
          <summary className="cursor-pointer text-primary">Ver {plural(resto.length, "evidencia más", "evidencias más")}</summary>
          <div className="space-y-sm mt-sm">
            {resto.map((ev) => (
              <Cita key={`${ev.documento_id}:${ev.inicio}`} evidencia={ev} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Cita({ evidencia }: Readonly<{ evidencia: EvidenciaGri }>) {
  const enIndice = evidencia.rol === "indice" ? " · índice GRI" : "";
  return (
    <div>
      <p className="text-body-md text-on-surface-variant italic border-l-2 border-outline-variant pl-sm break-words">{evidencia.cita}</p>
      <p className="text-label-sm text-outline mt-xs">
        {evidencia.documento_nombre} · {evidencia.seccion}
        {enIndice}
      </p>
    </div>
  );
}

function SancionesCard({ sanciones, resumen }: Readonly<{ sanciones: SancionVista[]; resumen: ResumenSanciones }>) {
  return (
    <div className={CLS_CARD}>
      <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-wrap justify-between items-center gap-sm">
        <h3 className="text-title-lg text-on-surface">Sanciones identificadas</h3>
        <span className="text-label-sm text-on-surface-variant">
          {resumen.total} en total · {resumen.cuantificadas} con monto · {resumen.no_cuantificadas} sin monto
        </span>
      </div>
      {sanciones.length === 0 ? (
        <p className="p-xl text-center text-body-md text-on-surface-variant">No se identificaron sanciones en los documentos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {["Entidad", "Monto", "Periodo", "Evidencia"].map((h) => (
                  <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-body-md">
              {sanciones.map((s) => (
                <tr key={`${s.documento_id}:${s.inicio}`} className="border-b border-surface-variant align-top">
                  <td className="py-md px-md">{s.entidad?.texto ?? "No identificada"}</td>
                  <td className="py-md px-md whitespace-nowrap">{s.monto ? textoMonto(s.monto) : "No cuantificada"}</td>
                  <td className="py-md px-md text-on-surface-variant">{s.periodo?.texto ?? "—"}</td>
                  <td className="py-md px-md">
                    <p className="text-on-surface-variant italic border-l-2 border-outline-variant pl-sm break-words">{s.cita}</p>
                    <p className="text-label-sm text-outline mt-xs">{s.documento_nombre} · {s.seccion}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-lg py-sm text-label-sm text-outline">
        Las sanciones no forman parte del puntaje ESG. Los montos se muestran tal como aparecen en el documento.
      </p>
    </div>
  );
}

function AdvertenciasCard({ advertencias }: Readonly<{ advertencias: AdvertenciaAnalisis[] }>) {
  return (
    <div className={CLS_CARD}>
      <div className="p-lg border-b border-outline-variant bg-surface-bright">
        <h3 className="text-title-lg text-on-surface">Advertencias del análisis</h3>
      </div>
      <ul className="p-lg space-y-sm">
        {advertencias.map((a) => (
          <li key={`${a.codigo}:${a.documento_id ?? ""}:${a.mensaje}`} className="flex items-start gap-sm text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-tertiary">warning</span>
            <span>
              {a.mensaje}
              {a.documento_nombre && <span className="text-label-sm text-outline"> · {a.documento_nombre}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistorialModal({
  abierto,
  empresaId,
  anio,
  onClose,
}: Readonly<{ abierto: boolean; empresaId: string | null; anio: number | null; onClose: () => void }>) {
  const toast = useToast();
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<PaginaHistorialGri | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (abierto) setPagina(1);
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !empresaId || anio == null) return;
    setCargando(true);
    analisisApi
      .consultarHistorial(empresaId, anio, { pagina, tamano: 10 })
      .then(setData)
      .catch((err) => toast(mensajeError(err, "No se pudo cargar el historial."), tipoAviso(err)))
      .finally(() => setCargando(false));
  }, [abierto, empresaId, anio, pagina, toast]);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.tamano)) : 1;
  const items = data?.items ?? [];

  return (
    <Modal open={abierto} onClose={onClose} width="max-w-3xl">
      <div className="p-xl overflow-y-auto">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">history</span> Historial de cambios de estado
        </h3>
        {cargando && (
          <div className="flex items-center gap-sm text-on-surface-variant"><Spinner size={18} /> Cargando…</div>
        )}
        {!cargando && items.length === 0 && (
          <p className="text-body-md text-on-surface-variant">Aún no hay cambios de estado registrados.</p>
        )}
        {!cargando && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  {["Fecha", "Código", "Cambio", "Usuario"].map((h) => (
                    <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-body-md">
                {items.map((h) => (
                  <tr key={h.id} className="border-b border-surface-variant">
                    <td className="py-sm px-md whitespace-nowrap text-on-surface-variant">{fechaHora(h.cambiado_en)}</td>
                    <td className="py-sm px-md whitespace-nowrap">GRI {h.codigo}{h.edicion ? ` (${h.edicion})` : ""}</td>
                    <td className="py-sm px-md">{etiquetaEstadoGri(h.estado_anterior)} → <strong>{etiquetaEstadoGri(h.estado_nuevo)}</strong></td>
                    <td className="py-sm px-md text-on-surface-variant">{h.usuario.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-lg space-y-md">
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} deshabilitado={cargando} />
          <div className="flex justify-end">
            <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low">Cerrar</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
