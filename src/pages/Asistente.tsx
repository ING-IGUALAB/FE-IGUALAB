import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "../components/ToastProvider";
import Spinner from "../components/Spinner";
import * as empresasApi from "../api/empresas";
import { consultarAsistente, continuarConversacion, guardarConversacion, listarConversaciones, obtenerConversacion } from "../api/asistente";
import { mensajeError, tipoAviso } from "../api/client";
import { SECTORES_API, etiquetaSector, plural, textoDescartadas, textoLegible, textoSinEvidencia } from "../lib/dominio";
import { mensajesParaGuardar, motivoNoGuardar, nuevaClave } from "../lib/conversaciones";
import { useAniosConDocumentos } from "../components/useAniosConDocumentos";
import SelectAnioConDocumentos from "../components/SelectAnioConDocumentos";
import TextoDocumento from "../components/TextoDocumento";
import type {
  AfirmacionAsistente,
  CitaAsistente,
  ConsultaAsistente,
  ContextoConversacion,
  ConversacionDetalle,
  ConversacionResumen,
  EmpresaApi,
  MensajeGuardado,
  MotivoSinEvidencia,
  SectorApi,
} from "../types";

interface Mensaje {
  id: string;
  autor: "user" | "bot";
  texto: string;
  /** Respuesta exacta del servidor: es lo que se envía al guardar el chat. */
  respuesta?: ConsultaAsistente;
  afirmaciones?: AfirmacionAsistente[];
  citas?: CitaAsistente[];
  sinEvidencia?: boolean;
  motivo?: MotivoSinEvidencia | null;
  aviso?: string | null;
  descartadas?: number;
  error?: boolean;
  typing?: boolean;
}

/** Conversación guardada que está abierta: su empresa, sector y año ya no cambian. */
interface ConversacionAbierta {
  id: string;
  titulo: string;
  contexto: ContextoConversacion;
}

const SUGERENCIAS: { icono: string; texto: string }[] = [
  { icono: "gavel", texto: "¿Qué sanciones ambientales, sociales y de gobernanza (compliance) identificas para esta empresa y año?" },
  { icono: "fact_check", texto: "¿Qué indicadores GRI de emisiones reporta?" },
  { icono: "eco", texto: "Resume el desempeño ambiental, social y de gobernanza (compliance) del año consultado" },
];
const CLS_CONTROL =
  "rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none disabled:opacity-70 disabled:cursor-not-allowed";

let msgSeq = 0;
function nuevoId(): string {
  msgSeq += 1;
  return `m${msgSeq}`;
}

function reemplazarTyping(xs: Mensaje[], nuevo: Mensaje): Mensaje[] {
  return [...xs.filter((m) => !m.typing), nuevo];
}

function mensajeDeRespuesta(r: ConsultaAsistente): Mensaje {
  return {
    id: nuevoId(),
    autor: "bot",
    texto: r.respuesta,
    respuesta: r,
    afirmaciones: r.afirmaciones ?? [],
    citas: r.citas ?? [],
    sinEvidencia: r.sin_evidencia,
    motivo: r.motivo,
    aviso: r.mensaje,
    descartadas: r.afirmaciones_descartadas ?? 0,
  };
}

/** Mensaje guardado en el historial, tal como se ve en el chat. */
function mensajeDeGuardado(m: MensajeGuardado): Mensaje {
  if (m.rol === "usuario") return { id: nuevoId(), autor: "user", texto: m.contenido };
  return m.respuesta ? mensajeDeRespuesta(m.respuesta) : { id: nuevoId(), autor: "bot", texto: m.contenido };
}

function mensajesDeConversacion(c: ConversacionDetalle): Mensaje[] {
  return [...c.mensajes].sort((a, b) => a.orden - b.orden).map(mensajeDeGuardado);
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

export default function Asistente() {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [sector, setSector] = useState<"" | SectorApi>("");
  const [empresaId, setEmpresaId] = useState("");
  const [anioPreferido, setAnioPreferido] = useState<number | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [consultando, setConsultando] = useState(false);
  const [conversacion, setConversacion] = useState<ConversacionAbierta | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [vueltaHistorial, setVueltaHistorial] = useState(0);
  // Se reutiliza en los reintentos del mismo chat; cambia cuando cambian los mensajes.
  const claveGuardado = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), tipoAviso(err)));
  }, [toast]);

  useEffect(() => {
    claveGuardado.current = null;
  }, [mensajes]);

  const empresasSector = empresas.filter((e) => !sector || e.sector === sector);
  const empresa = empresasSector.find((e) => e.id === empresaId) ?? null;
  const aniosEmpresa = useAniosConDocumentos(empresa?.id ?? "", anioPreferido);
  const { anio, sinDocumentos } = aniosEmpresa;
  const ctxOk = !!(sector && empresa && anio !== null);
  // Un chat es de una sola empresa y año: con mensajes, el contexto queda fijo hasta empezar otro.
  const contextoFijo = mensajes.length > 0 || consultando;
  const soloLectura = !!conversacion && !conversacion.contexto.empresa_activa;
  const puedePreguntar = conversacion ? !soloLectura : ctxOk;
  const paraGuardar = mensajesParaGuardar(mensajes);
  const motivoSinGuardar = motivoNoGuardar(paraGuardar);

  const scrollLog = () => {
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 30);
  };

  async function obtenerRespuesta(pregunta: string): Promise<Mensaje> {
    if (conversacion) {
      // En un chat guardado, el servidor guarda la pregunta y la respuesta.
      const intercambio = await continuarConversacion(conversacion.id, nuevaClave(), pregunta);
      setVueltaHistorial((v) => v + 1);
      return mensajeDeGuardado(intercambio.respuesta);
    }
    if (!sector || !empresa || anio === null) throw new Error("Sin contexto");
    return mensajeDeRespuesta(await consultarAsistente({ pregunta, sector, empresaId: empresa.id, anio }));
  }

  async function responder(pregunta: string) {
    if (!puedePreguntar) {
      toast(soloLectura ? "La empresa de este chat está desactivada: solo se puede leer." : "Selecciona sector, empresa y año antes de consultar.", "warn");
      return;
    }
    setConsultando(true);
    setMensajes((xs) => [...xs, { id: nuevoId(), autor: "user", texto: pregunta }, { id: nuevoId(), autor: "bot", texto: "", typing: true }]);
    scrollLog();
    try {
      const nuevo = await obtenerRespuesta(pregunta);
      setMensajes((xs) => reemplazarTyping(xs, nuevo));
    } catch (err) {
      const detalle = mensajeError(err, "No se pudo consultar al asistente. Intenta nuevamente.");
      setMensajes((xs) => reemplazarTyping(xs, { id: nuevoId(), autor: "bot", texto: detalle, error: true }));
    } finally {
      setConsultando(false);
      scrollLog();
    }
  }

  function enviar() {
    const t = texto.trim();
    if (!t || consultando) return;
    setTexto("");
    responder(t);
  }

  function sugerir(s: string) {
    if (puedePreguntar) responder(s);
    else toast("Primero elige sector, empresa y año.", "warn");
  }

  async function guardar() {
    if (conversacion || motivoSinGuardar || guardando || !sector || !empresa || anio === null) return;
    claveGuardado.current ??= nuevaClave();
    setGuardando(true);
    try {
      const c = await guardarConversacion({ clave: claveGuardado.current, sector, empresaId: empresa.id, anio, mensajes: paraGuardar });
      setConversacion({ id: c.id, titulo: c.titulo, contexto: c.contexto });
      setVueltaHistorial((v) => v + 1);
      toast(c.reutilizada ? "Este chat ya estaba guardado." : "Chat guardado en tu historial.", "success");
    } catch (err) {
      toast(mensajeError(err, "No se pudo guardar el chat."), tipoAviso(err));
    } finally {
      setGuardando(false);
    }
  }

  function nuevaConversacion() {
    if (consultando) return;
    setMensajes([]);
    setConversacion(null);
    setTexto("");
  }

  async function abrirConversacion(id: string) {
    try {
      const c = await obtenerConversacion(id);
      setConversacion({ id: c.id, titulo: c.titulo, contexto: c.contexto });
      setMensajes(mensajesDeConversacion(c));
      // Al empezar otra conversación, se parte del mismo contexto.
      setSector(c.contexto.sector);
      setEmpresaId(c.contexto.empresa_id);
      setAnioPreferido(c.contexto.anio);
      setTexto("");
      scrollLog();
    } catch (err) {
      toast(mensajeError(err, "No se pudo abrir el chat."), tipoAviso(err));
    }
  }

  // Lo que muestran los campos: el contexto del chat guardado o el elegido.
  const sectorVisto = conversacion?.contexto.sector ?? sector;
  const empresaVista = conversacion?.contexto.empresa_id ?? empresa?.id ?? "";
  const empresaFuera = conversacion && !empresasSector.some((e) => e.id === conversacion.contexto.empresa_id) ? conversacion.contexto : null;
  const nombreEmpresa = conversacion?.contexto.empresa_nombre ?? empresa?.nombre;
  const anioVisto = conversacion?.contexto.anio ?? anio;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-lg md:-m-xl">
      {/* Contexto de la consulta */}
      <div className="bg-surface-container-lowest border-b border-outline-variant px-md sm:px-lg py-md">
        <div data-testid="barra-contexto" className="max-w-5xl mx-auto flex flex-wrap lg:flex-nowrap gap-md items-end">
          <div className="hidden xl:flex shrink-0 items-center gap-sm mr-sm self-center">
            <span className="w-9 h-9 rounded-full bg-secondary-fixed/50 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">{contextoFijo ? "lock" : "filter_alt"}</span>
            </span>
            <span className="text-label-md font-bold text-secondary leading-tight">
              Contexto de<br />consulta
            </span>
          </div>
          <Campo label="Sector" className="flex-1 min-w-[150px] lg:flex-none lg:w-40">
            <select value={sectorVisto} disabled={contextoFijo} onChange={(e) => { setSector(e.target.value as "" | SectorApi); setEmpresaId(""); }} className={`${CLS_CONTROL} w-full`}>
              <option value="">— Elegir —</option>
              {SECTORES_API.map((s) => <option key={s} value={s}>{etiquetaSector(s)}</option>)}
            </select>
          </Campo>
          {/* El ancho no depende del nombre: si es largo se recorta y se lee completo en la lista o en el «title». */}
          <Campo label="Empresa" className="flex-1 min-w-[180px] lg:min-w-0">
            <select value={empresaVista} title={nombreEmpresa} disabled={contextoFijo} onChange={(e) => setEmpresaId(e.target.value)} className={`${CLS_CONTROL} w-full truncate`}>
              <option value="">— Elegir —</option>
              {empresaFuera && <option value={empresaFuera.empresa_id}>{empresaFuera.empresa_nombre}</option>}
              {empresasSector.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Año" className="w-32 shrink-0">
            {contextoFijo ? (
              <select value={anioVisto ?? ""} disabled className={`${CLS_CONTROL} w-full`}>
                <option value={anioVisto ?? ""}>{anioVisto ?? "—"}</option>
              </select>
            ) : (
              <SelectAnioConDocumentos seleccion={aniosEmpresa} className={`${CLS_CONTROL} w-full`} />
            )}
          </Campo>
          <div className="w-full lg:w-auto lg:shrink-0 self-center whitespace-nowrap">
            <EstadoContexto ctxOk={puedePreguntar} sinDocumentos={sinDocumentos} soloLectura={soloLectura} />
          </div>
        </div>
      </div>

      {/* Acciones del chat: guardar, historial y empezar otro */}
      <BarraChat
        titulo={conversacion?.titulo ?? null}
        guardado={!!conversacion}
        hayMensajes={mensajes.length > 0}
        motivoSinGuardar={motivoSinGuardar}
        guardando={guardando}
        consultando={consultando}
        historialAbierto={historialAbierto}
        onGuardar={guardar}
        onHistorial={() => setHistorialAbierto((v) => !v)}
        onNueva={nuevaConversacion}
      />

      <div className="flex-1 min-h-0 flex">
      {/* Conversación */}
      <div ref={logRef} className="flex-1 overflow-y-auto chat-scroll bg-surface">
        <div className="max-w-3xl mx-auto w-full px-md sm:px-lg py-lg sm:py-xl flex flex-col gap-lg">
          {mensajes.length === 0 ? (
            <Bienvenida ctxOk={ctxOk} consultando={consultando} onSugerir={sugerir} />
          ) : (
            mensajes.map((m) => <MensajeItem key={m.id} m={m} />)
          )}
        </div>
      </div>
      {historialAbierto && (
        <PanelHistorial
          vuelta={vueltaHistorial}
          abiertaId={conversacion?.id ?? null}
          chatSinGuardar={!conversacion && paraGuardar.length > 0}
          onAbrir={abrirConversacion}
          onCerrar={() => setHistorialAbierto(false)}
        />
      )}
      </div>

      {/* Caja de pregunta */}
      <div className="border-t border-outline-variant bg-surface-container-lowest px-md sm:px-lg pt-md pb-sm">
        <div className="max-w-3xl mx-auto">
          <div
            className={`rounded-2xl border bg-surface-container-lowest shadow-sm transition-all ${
              puedePreguntar ? "border-outline-variant focus-within:border-primary-ink focus-within:ring-2 focus-within:ring-primary/20" : "border-outline-variant opacity-70"
            }`}
          >
            <textarea
              rows={2}
              aria-label="Pregunta para el asistente"
              disabled={!puedePreguntar}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={soloLectura ? "La empresa de este chat está desactivada: puedes leerlo, pero no hacer preguntas nuevas." : placeholderPregunta(ctxOk, sinDocumentos)}
              className="w-full bg-transparent border-none rounded-2xl text-body-md text-on-surface px-md sm:px-lg pt-md pb-xs resize-none focus:ring-0 outline-none disabled:cursor-not-allowed placeholder:text-outline"
            />
            <div className="flex items-center justify-between gap-md px-md pb-sm">
              {nombreEmpresa && (puedePreguntar || conversacion) ? (
                <span className="inline-flex items-center gap-xs rounded-full bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-primary-ink">apartment</span>
                  <span className="truncate">{nombreEmpresa} · {anioVisto}</span>
                </span>
              ) : (
                <span className="text-label-sm text-outline">Sin contexto seleccionado</span>
              )}
              <div className="flex items-center gap-md shrink-0">
                <span className="hidden sm:inline text-label-sm text-outline">Enter para enviar · Shift + Enter, nueva línea</span>
                <button
                  onClick={enviar}
                  aria-label="Consultar"
                  title="Consultar"
                  disabled={!puedePreguntar || consultando || !texto.trim()}
                  className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-surface-tint transition-colors disabled:bg-surface-variant disabled:text-outline disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{consultando ? "hourglass_top" : "arrow_upward"}</span>
                </button>
              </div>
            </div>
          </div>
          <p className="text-center text-label-sm text-outline mt-sm text-balance max-w-[640px] mx-auto">
            <span className="material-symbols-outlined text-[14px] align-[-3px] mr-xs" aria-hidden="true">verified</span>
            <span>Responde solo con los documentos de la empresa y el año seleccionados, y cita la fuente de cada dato. Si no hay evidencia suficiente, lo indica en lugar de inventar una respuesta.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Título del chat y sus acciones: guardar en el historial, ver el historial y empezar otro. */
function BarraChat({
  titulo,
  guardado,
  hayMensajes,
  motivoSinGuardar,
  guardando,
  consultando,
  historialAbierto,
  onGuardar,
  onHistorial,
  onNueva,
}: Readonly<{
  titulo: string | null;
  guardado: boolean;
  hayMensajes: boolean;
  motivoSinGuardar: string | null;
  guardando: boolean;
  consultando: boolean;
  historialAbierto: boolean;
  onGuardar: () => void;
  onHistorial: () => void;
  onNueva: () => void;
}>) {
  const CLS_BOTON =
    "inline-flex items-center gap-xs px-md py-xs rounded-lg border text-label-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <div className="bg-surface-container-lowest border-b border-outline-variant px-md sm:px-lg py-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-md">
        <div className="min-w-0 flex items-center gap-sm">
          <p className="truncate text-label-md font-semibold text-on-surface" title={titulo ?? undefined}>
            {titulo ?? (hayMensajes ? "Chat sin guardar" : "Conversación nueva")}
          </p>
          {guardado && (
            <span className="shrink-0 inline-flex items-center gap-xs px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container text-label-sm">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">cloud_done</span>
              <span>Guardado</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-sm shrink-0">
          {!guardado && (
            <button
              type="button"
              onClick={onGuardar}
              disabled={!!motivoSinGuardar || guardando || consultando}
              title={motivoSinGuardar ?? "Guardar este chat en tu historial"}
              className={`${CLS_BOTON} border-primary-ink bg-primary text-on-primary hover:bg-surface-tint`}
            >
              {guardando ? <><Spinner size={14} /> Guardando…</> : <><span className="material-symbols-outlined text-[18px]" aria-hidden="true">bookmark_add</span> Guardar chat</>}
            </button>
          )}
          <button
            type="button"
            onClick={onNueva}
            disabled={!hayMensajes || consultando}
            className={`${CLS_BOTON} border-outline-variant text-on-surface-variant hover:bg-surface-container-low`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_comment</span> Nueva conversación
          </button>
          <button
            type="button"
            onClick={onHistorial}
            aria-expanded={historialAbierto}
            className={`${CLS_BOTON} ${historialAbierto ? "border-primary-ink text-primary-ink bg-primary/10" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">history</span> Historial
          </button>
        </div>
      </div>
    </div>
  );
}

const TAM_HISTORIAL = 20;

/** Chats guardados del usuario, del más reciente al más antiguo. Al elegir uno se abre en el chat. */
function PanelHistorial({
  vuelta,
  abiertaId,
  chatSinGuardar,
  onAbrir,
  onCerrar,
}: Readonly<{ vuelta: number; abiertaId: string | null; chatSinGuardar: boolean; onAbrir: (id: string) => Promise<void>; onCerrar: () => void }>) {
  const toast = useToast();
  const [items, setItems] = useState<ConversacionResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [porConfirmar, setPorConfirmar] = useState<ConversacionResumen | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    listarConversaciones(1, TAM_HISTORIAL)
      .then((p) => {
        if (!vigente) return;
        setItems(p.items);
        setTotal(p.total);
        setPagina(1);
      })
      .catch((err) => {
        if (vigente) toast(mensajeError(err, "No se pudo cargar el historial."), tipoAviso(err));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [vuelta, toast]);

  async function verMas() {
    setCargando(true);
    try {
      const p = await listarConversaciones(pagina + 1, TAM_HISTORIAL);
      setItems((xs) => [...xs, ...p.items.filter((n) => !xs.some((x) => x.id === n.id))]);
      setTotal(p.total);
      setPagina(p.pagina);
    } catch (err) {
      toast(mensajeError(err, "No se pudo cargar el historial."), tipoAviso(err));
    } finally {
      setCargando(false);
    }
  }

  async function abrir(c: ConversacionResumen, confirmado = false) {
    if (c.id === abiertaId || abriendo) return;
    if (chatSinGuardar && !confirmado) {
      setPorConfirmar(c);
      return;
    }
    setPorConfirmar(null);
    setAbriendo(c.id);
    await onAbrir(c.id);
    setAbriendo(null);
  }

  return (
    <aside aria-label="Historial de chats" className="w-[340px] shrink-0 border-l border-outline-variant bg-surface-container-lowest flex flex-col">
      <div className="flex items-center justify-between gap-sm px-md py-sm border-b border-outline-variant">
        <h3 className="text-title-sm font-semibold text-on-surface">Historial</h3>
        <button type="button" onClick={onCerrar} aria-label="Cerrar historial" className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      </div>

      {porConfirmar && (
        <div role="alert" className="m-sm rounded-lg border border-tertiary/40 bg-tertiary-fixed/30 p-sm space-y-sm">
          <p className="text-label-md text-on-surface">Tu chat actual no está guardado y se perderá si abres otro.</p>
          <div className="flex justify-end gap-sm">
            <button type="button" onClick={() => setPorConfirmar(null)} className="px-sm py-xs rounded-lg border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container-low">
              Cancelar
            </button>
            <button type="button" onClick={() => abrir(porConfirmar, true)} className="px-sm py-xs rounded-lg bg-primary text-on-primary text-label-md font-semibold">
              Abrir igual
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!cargando && items.length === 0 && (
          <p className="p-lg text-center text-body-md text-on-surface-variant">Aún no tienes chats guardados. Usa «Guardar chat» para encontrarlos aquí.</p>
        )}
        <ul className="divide-y divide-surface-variant">
          {items.map((c) => {
            const actual = c.id === abiertaId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => abrir(c)}
                  aria-current={actual ? "true" : undefined}
                  className={`w-full text-left px-md py-sm space-y-[2px] transition-colors ${actual ? "bg-primary/10" : "hover:bg-surface-container-low"}`}
                >
                  <span className="flex items-start justify-between gap-sm">
                    <span className="text-label-md font-semibold text-on-surface line-clamp-2">{c.titulo}</span>
                    {abriendo === c.id && <Spinner size={14} />}
                  </span>
                  <span className="block text-label-sm text-on-surface-variant truncate">
                    {c.contexto.empresa_nombre} · {c.contexto.anio}
                    {!c.contexto.empresa_activa && " · Empresa desactivada"}
                  </span>
                  <span className="block text-label-sm text-outline">
                    {fechaHora(c.actualizada_en)} · {plural(c.total_mensajes / 2, "pregunta", "preguntas")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {cargando && (
          <p className="flex items-center justify-center gap-sm p-md text-label-md text-on-surface-variant"><Spinner size={14} /> Cargando…</p>
        )}
        {!cargando && items.length < total && (
          <div className="p-sm">
            <button type="button" onClick={verMas} className="w-full px-md py-xs rounded-lg border border-outline-variant text-label-md text-primary-ink hover:bg-surface-container-low">
              Ver más
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function placeholderPregunta(ctxOk: boolean, sinDocumentos: boolean): string {
  if (ctxOk) return "Escribe tu pregunta sobre indicadores GRI, sanciones o desempeño ambiental…";
  if (sinDocumentos) return "Esta empresa aún no tiene documentos analizados para consultar.";
  return "Elige sector, empresa y año para empezar a consultar…";
}

function EstadoContexto({ ctxOk, sinDocumentos, soloLectura = false }: Readonly<{ ctxOk: boolean; sinDocumentos: boolean; soloLectura?: boolean }>) {
  if (soloLectura) {
    return (
      <span className="inline-flex items-center gap-xs px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant text-label-sm">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">visibility</span>
        <span>Solo lectura</span>
      </span>
    );
  }
  if (ctxOk) {
    return (
      <span className="inline-flex items-center gap-xs px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container text-label-sm">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span>
        <span>Contexto listo</span>
      </span>
    );
  }
  if (sinDocumentos) {
    return (
      <span className="inline-flex items-center gap-xs px-3 py-1.5 rounded-full bg-tertiary-fixed/60 text-on-tertiary-fixed text-label-sm">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">folder_off</span>
        <span>Sin documentos analizados</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-xs px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant text-label-sm">
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">info</span>
      <span>Elige sector y empresa</span>
    </span>
  );
}

function Bienvenida({ ctxOk, consultando, onSugerir }: Readonly<{ ctxOk: boolean; consultando: boolean; onSugerir: (s: string) => void }>) {
  return (
    <div className="flex flex-col items-center text-center py-xl">
      <span className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md">
        <span className="material-symbols-outlined text-[32px]">psychology</span>
      </span>
      <h2 className="text-headline-md text-on-background mt-md">¿Qué quieres saber?</h2>
      <p className="text-body-md text-on-surface-variant mt-sm max-w-xl">
        Hola, soy el asistente de IA de Igualab. Respondo únicamente con base en los documentos cargados y siempre cito la fuente.
      </p>
      {!ctxOk && (
        <p className="text-label-md text-secondary mt-sm">Para empezar, elige arriba el sector, la empresa y el año.</p>
      )}
      <div className="mt-lg grid gap-sm w-full max-w-xl">
        {SUGERENCIAS.map((s) => (
          <button
            key={s.texto}
            disabled={consultando}
            onClick={() => onSugerir(s.texto)}
            className="flex items-center gap-md text-left rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-sm text-body-md text-on-surface hover:border-primary-ink hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-primary-ink" aria-hidden="true">{s.icono}</span>
            <span>{s.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AvatarBot() {
  return (
    <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 mt-xs">
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">psychology</span>
    </span>
  );
}

function MensajeItem({ m }: Readonly<{ m: Mensaje }>) {
  if (m.autor === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] sm:max-w-[80%] bg-primary text-on-primary px-lg py-md rounded-2xl rounded-br-md shadow-sm">
          <p className="text-body-md whitespace-pre-line">{m.texto}</p>
        </div>
      </div>
    );
  }
  if (m.typing) {
    return (
      <div className="flex gap-md" aria-label="El asistente está escribiendo">
        <AvatarBot />
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl rounded-tl-md px-lg py-md shadow-sm flex items-center gap-sm">
          <span className="flex gap-xs items-center"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>
          <span className="text-label-md text-on-surface-variant">Buscando en los documentos…</span>
        </div>
      </div>
    );
  }
  if (m.error) {
    return (
      <div className="flex gap-md">
        <AvatarBot />
        <div className="bg-error-container text-on-error-container rounded-2xl rounded-tl-md px-lg py-md shadow-sm flex items-start gap-sm">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>
          <p className="text-body-md">{m.texto}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-md">
      <AvatarBot />
      <div className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-2xl rounded-tl-md p-lg shadow-sm">
        <CuerpoRespuesta m={m} />
      </div>
    </div>
  );
}

/** Afirmaciones verificadas (o el texto de respuesta), aviso sin evidencia y fuentes citadas. */
function CuerpoRespuesta({ m }: Readonly<{ m: Mensaje }>) {
  const afirmaciones = m.afirmaciones ?? [];
  const citas = m.citas ?? [];
  const descartadas = m.descartadas ?? 0;
  return (
    <>
      {afirmaciones.length > 0 ? (
        <ul className="space-y-md">
          {afirmaciones.map((a) => <AfirmacionItem key={a.cita_textual + a.texto} afirmacion={a} />)}
        </ul>
      ) : (
        m.texto && <p className="text-body-md text-on-surface whitespace-pre-line">{m.texto}</p>
      )}
      {m.sinEvidencia && (
        <div className="mt-md first:mt-0 flex items-start gap-sm rounded-xl bg-tertiary-fixed/40 text-on-tertiary-fixed px-md py-sm text-body-md">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">info</span>
          <span>{m.aviso || textoSinEvidencia(m.motivo)}</span>
        </div>
      )}
      {descartadas > 0 && (
        <p className="mt-md text-label-sm text-outline flex items-center gap-xs">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">filter_list</span>
          <span>{textoDescartadas(descartadas)}</span>
        </p>
      )}
      {citas.length > 0 && (
        <div className="mt-lg pt-md border-t border-outline-variant">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-sm">Fuentes citadas</p>
          <div className="grid gap-sm">
            {citas.map((c) => <Fuente key={c.referencia} cita={c} />)}
          </div>
        </div>
      )}
    </>
  );
}

function AfirmacionItem({ afirmacion }: Readonly<{ afirmacion: AfirmacionAsistente }>) {
  return (
    <li className="flex gap-sm">
      <span className="material-symbols-outlined text-[18px] text-primary-ink mt-[2px]" aria-hidden="true">check_circle</span>
      <div className="min-w-0">
        <p className="text-body-md text-on-surface">
          {textoLegible(afirmacion.texto)}{" "}
          {afirmacion.referencias.map((n) => (
            <sup key={n} className="ml-[2px] inline-flex items-center justify-center rounded bg-primary/10 px-1 text-[10px] font-bold text-primary-ink">[{n}]</sup>
          ))}
        </p>
        <TextoDocumento
          texto={afirmacion.cita_textual}
          comillas
          className="mt-xs rounded-lg bg-surface-container-low px-md py-xs text-label-md text-on-surface-variant italic break-words"
        />
      </div>
    </li>
  );
}

function Fuente({ cita }: Readonly<{ cita: CitaAsistente }>) {
  return (
    <div className="flex gap-sm rounded-xl border border-outline-variant bg-surface-container-low/60 px-md py-sm">
      <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-sm font-bold flex items-center justify-center shrink-0">{cita.referencia}</span>
      <div className="min-w-0">
        <p className="text-label-md font-semibold text-on-surface break-all">{cita.documento_nombre}</p>
        <p className="text-label-sm text-on-surface-variant">{cita.empresa_nombre} · {cita.anio} · {textoLegible(cita.seccion)}</p>
        <TextoDocumento texto={cita.extracto} maxFilas={3} className="text-label-sm text-outline italic mt-xs line-clamp-2 break-words" />
      </div>
    </div>
  );
}

function Campo({ label, children, className = "" }: Readonly<{ label: string; children: ReactNode; className?: string }>) {
  return (
    <label className={`flex flex-col gap-xs ${className}`}>
      <span className="text-label-sm text-on-surface-variant uppercase">{label}</span>
      {children}
    </label>
  );
}
