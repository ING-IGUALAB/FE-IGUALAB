import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "../components/ToastProvider";
import * as empresasApi from "../api/empresas";
import { consultarAsistente } from "../api/asistente";
import { mensajeError, tipoAviso } from "../api/client";
import { SECTORES_API, etiquetaSector, textoDescartadas, textoSinEvidencia } from "../lib/dominio";
import { useAniosConDocumentos } from "../components/useAniosConDocumentos";
import type { AfirmacionAsistente, CitaAsistente, EmpresaApi, MotivoSinEvidencia, SectorApi } from "../types";

interface Mensaje {
  id: string;
  autor: "user" | "bot";
  texto: string;
  afirmaciones?: AfirmacionAsistente[];
  citas?: CitaAsistente[];
  sinEvidencia?: boolean;
  motivo?: MotivoSinEvidencia | null;
  aviso?: string | null;
  descartadas?: number;
  error?: boolean;
  typing?: boolean;
}

const SUGERENCIAS: { icono: string; texto: string }[] = [
  { icono: "gavel", texto: "¿Qué sanciones identificas para esta empresa y año?" },
  { icono: "co2", texto: "¿Qué indicadores GRI de emisiones reporta?" },
  { icono: "eco", texto: "Resume el desempeño ambiental del año consultado" },
];
const CLS_CONTROL =
  "rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none";

/** Texto de la lista de años cuando todavía no hay años que ofrecer. */
function textoSinAnios(hayEmpresa: boolean, cargando: boolean): string {
  if (!hayEmpresa) return "—";
  if (cargando) return "Buscando…";
  return "Sin documentos";
}

let msgSeq = 0;
function nuevoId(): string {
  msgSeq += 1;
  return `m${msgSeq}`;
}

function reemplazarTyping(xs: Mensaje[], nuevo: Mensaje): Mensaje[] {
  return [...xs.filter((m) => !m.typing), nuevo];
}

export default function Asistente() {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [sector, setSector] = useState<"" | SectorApi>("");
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [consultando, setConsultando] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), tipoAviso(err)));
  }, [toast]);

  const empresasSector = empresas.filter((e) => !sector || e.sector === sector);
  const empresa = empresasSector.find((e) => e.id === empresaId) ?? null;
  const { anios, cargando: buscandoAnios } = useAniosConDocumentos(empresa?.id ?? "");
  const sinDocumentos = !!empresa && !buscandoAnios && anios.length === 0;
  const ctxOk = !!(sector && empresa && anio !== null);

  // Al cambiar de empresa, se elige su año más reciente con documentos (o ninguno).
  useEffect(() => {
    setAnio((actual) => (actual !== null && anios.includes(actual) ? actual : anios[0] ?? null));
  }, [anios]);

  const scrollLog = () => {
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 30);
  };

  async function responder(pregunta: string) {
    if (!ctxOk || !empresa || !sector || anio === null) {
      toast("Selecciona sector, empresa y año antes de consultar.", "warn");
      return;
    }
    setConsultando(true);
    setMensajes((xs) => [...xs, { id: nuevoId(), autor: "user", texto: pregunta }, { id: nuevoId(), autor: "bot", texto: "", typing: true }]);
    scrollLog();
    try {
      const r = await consultarAsistente({ pregunta, sector, empresaId: empresa.id, anio });
      setMensajes((xs) =>
        reemplazarTyping(xs, {
          id: nuevoId(),
          autor: "bot",
          texto: r.respuesta,
          afirmaciones: r.afirmaciones ?? [],
          citas: r.citas ?? [],
          sinEvidencia: r.sin_evidencia,
          motivo: r.motivo,
          aviso: r.mensaje,
          descartadas: r.afirmaciones_descartadas ?? 0,
        }),
      );
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
    if (ctxOk) responder(s);
    else toast("Primero elige sector, empresa y año.", "warn");
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-lg md:-m-xl">
      {/* Contexto de la consulta */}
      <div className="bg-surface-container-lowest border-b border-outline-variant px-md sm:px-lg py-md">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-md items-end">
          <div className="hidden md:flex items-center gap-sm mr-sm self-center">
            <span className="w-9 h-9 rounded-full bg-secondary-fixed/50 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">filter_alt</span>
            </span>
            <span className="text-label-md font-bold text-secondary leading-tight">
              Contexto de<br />consulta
            </span>
          </div>
          <Campo label="Sector" className="flex-1 min-w-[150px] sm:flex-none">
            <select value={sector} onChange={(e) => { setSector(e.target.value as "" | SectorApi); setEmpresaId(""); }} className={`${CLS_CONTROL} w-full sm:min-w-[160px]`}>
              <option value="">— Elegir —</option>
              {SECTORES_API.map((s) => <option key={s} value={s}>{etiquetaSector(s)}</option>)}
            </select>
          </Campo>
          <Campo label="Empresa" className="flex-1 min-w-[180px] sm:flex-none">
            <select value={empresa?.id ?? ""} onChange={(e) => setEmpresaId(e.target.value)} className={`${CLS_CONTROL} w-full sm:min-w-[220px]`}>
              <option value="">— Elegir —</option>
              {empresasSector.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Año" className="w-32">
            <select
              value={anio ?? ""}
              onChange={(e) => setAnio(Number(e.target.value))}
              disabled={anios.length === 0}
              className={`${CLS_CONTROL} w-full`}
            >
              {anios.length === 0 && <option value="">{textoSinAnios(!!empresa, buscandoAnios)}</option>}
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>
          <div className="w-full sm:w-auto sm:ml-auto self-center">
            <EstadoContexto ctxOk={ctxOk} sinDocumentos={sinDocumentos} />
          </div>
        </div>
      </div>

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

      {/* Caja de pregunta */}
      <div className="border-t border-outline-variant bg-surface-container-lowest px-md sm:px-lg pt-md pb-sm">
        <div className="max-w-3xl mx-auto">
          <div
            className={`rounded-2xl border bg-surface-container-lowest shadow-sm transition-all ${
              ctxOk ? "border-outline-variant focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20" : "border-outline-variant opacity-70"
            }`}
          >
            <textarea
              rows={2}
              aria-label="Pregunta para el asistente"
              disabled={!ctxOk}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={placeholderPregunta(ctxOk, sinDocumentos)}
              className="w-full bg-transparent border-none rounded-2xl text-body-md text-on-surface px-md sm:px-lg pt-md pb-xs resize-none focus:ring-0 outline-none disabled:cursor-not-allowed placeholder:text-outline"
            />
            <div className="flex items-center justify-between gap-md px-md pb-sm">
              {empresa && ctxOk ? (
                <span className="inline-flex items-center gap-xs rounded-full bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-primary">apartment</span>
                  <span className="truncate">{empresa.nombre} · {anio}</span>
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
                  disabled={!ctxOk || consultando || !texto.trim()}
                  className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-surface-tint transition-colors disabled:bg-surface-variant disabled:text-outline disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{consultando ? "hourglass_top" : "arrow_upward"}</span>
                </button>
              </div>
            </div>
          </div>
          <p className="text-center text-label-sm text-outline mt-sm flex items-center justify-center gap-xs">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">verified</span>
            <span>La IA siempre cita la fuente. Si los documentos no bastan para responder, lo indica.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function placeholderPregunta(ctxOk: boolean, sinDocumentos: boolean): string {
  if (ctxOk) return "Escribe tu pregunta sobre indicadores GRI, sanciones o desempeño ambiental…";
  if (sinDocumentos) return "Esta empresa aún no tiene documentos analizados para consultar.";
  return "Elige sector, empresa y año para empezar a consultar…";
}

function EstadoContexto({ ctxOk, sinDocumentos }: Readonly<{ ctxOk: boolean; sinDocumentos: boolean }>) {
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
            className="flex items-center gap-md text-left rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-sm text-body-md text-on-surface hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-primary" aria-hidden="true">{s.icono}</span>
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
      <span className="material-symbols-outlined text-[18px] text-primary mt-[2px]" aria-hidden="true">check_circle</span>
      <div className="min-w-0">
        <p className="text-body-md text-on-surface">
          {afirmacion.texto}{" "}
          {afirmacion.referencias.map((n) => (
            <sup key={n} className="ml-[2px] inline-flex items-center justify-center rounded bg-primary/10 px-1 text-[10px] font-bold text-primary">[{n}]</sup>
          ))}
        </p>
        <p className="mt-xs rounded-lg bg-surface-container-low px-md py-xs text-label-md text-on-surface-variant italic break-words">«{afirmacion.cita_textual}»</p>
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
        <p className="text-label-sm text-on-surface-variant">{cita.empresa_nombre} · {cita.anio} · {cita.seccion}</p>
        <p className="text-label-sm text-outline italic mt-xs line-clamp-2 break-words">{cita.extracto}</p>
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
