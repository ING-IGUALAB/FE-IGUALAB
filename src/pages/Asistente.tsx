import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "../components/ToastProvider";
import * as empresasApi from "../api/empresas";
import { consultarAsistente } from "../api/asistente";
import { mensajeError } from "../api/client";
import { SECTORES_API, anioIngestaValido, etiquetaSector } from "../lib/dominio";
import type { CitaAsistente, EmpresaApi, SectorApi } from "../types";

interface Mensaje {
  id: string;
  autor: "user" | "bot";
  texto: string;
  citas?: CitaAsistente[];
  sinEvidencia?: boolean;
  aviso?: string | null;
  error?: boolean;
  typing?: boolean;
}

const SUGERENCIAS = [
  "¿Qué sanciones identificas para esta empresa y año?",
  "¿Qué indicadores GRI de emisiones reporta?",
  "Resume el desempeño ambiental del año consultado",
];
const ANIO_ACTUAL = new Date().getFullYear();

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
  const [anio, setAnio] = useState(ANIO_ACTUAL - 1);
  const [texto, setTexto] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [consultando, setConsultando] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    empresasApi
      .listarEmpresas({ soloActivas: true })
      .then(setEmpresas)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar las empresas."), "error"));
  }, [toast]);

  const empresasSector = empresas.filter((e) => !sector || e.sector === sector);
  const empresa = empresasSector.find((e) => e.id === empresaId) ?? null;
  const ctxOk = !!(sector && empresa && anioIngestaValido(anio));
  const nombreEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nombre ?? "Empresa";

  const scrollLog = () => {
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }), 30);
  };

  async function responder(pregunta: string) {
    if (!ctxOk || !empresa) {
      toast("Selecciona sector, empresa y año antes de consultar.", "warn");
      return;
    }
    setConsultando(true);
    setMensajes((xs) => [...xs, { id: nuevoId(), autor: "user", texto: pregunta }, { id: nuevoId(), autor: "bot", texto: "", typing: true }]);
    scrollLog();
    try {
      const r = await consultarAsistente({ pregunta, empresaId: empresa.id, anio });
      setMensajes((xs) =>
        reemplazarTyping(xs, {
          id: nuevoId(),
          autor: "bot",
          texto: r.respuesta,
          citas: r.citas ?? [],
          sinEvidencia: r.sin_evidencia,
          aviso: r.mensaje,
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

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -m-lg md:-m-xl">
      <div className="bg-surface-container-lowest border-b border-outline-variant px-lg py-md flex flex-wrap gap-md items-end">
        <div className="flex items-center gap-xs text-secondary mr-sm">
          <span className="material-symbols-outlined">filter_alt</span>
          <span className="text-label-md font-bold">Contexto de consulta</span>
        </div>
        <Campo label="Sector">
          <select value={sector} onChange={(e) => { setSector(e.target.value as "" | SectorApi); setEmpresaId(""); }} className={CLS_CONTROL}>
            <option value="">— Elegir —</option>
            {SECTORES_API.map((s) => <option key={s} value={s}>{etiquetaSector(s)}</option>)}
          </select>
        </Campo>
        <Campo label="Empresa">
          <select value={empresa?.id ?? ""} onChange={(e) => setEmpresaId(e.target.value)} className={CLS_CONTROL}>
            <option value="">— Elegir —</option>
            {empresasSector.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Año">
          <input type="number" min={2000} max={ANIO_ACTUAL} value={anio} onChange={(e) => setAnio(Number.parseInt(e.target.value, 10) || 0)} className={`${CLS_CONTROL} min-w-[110px]`} />
        </Campo>
        {ctxOk && (
          <span className="ml-auto inline-flex items-center gap-xs px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container text-label-sm">
            <span className="material-symbols-outlined text-[16px]">check_circle</span> Contexto listo
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col bg-surface overflow-hidden">
        <div ref={logRef} className="flex-1 overflow-y-auto chat-scroll p-xl flex flex-col gap-xl">
          <div className="flex gap-lg max-w-4xl">
            <Avatar />
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl rounded-tl-sm shadow-sm">
              <p className="text-body-md text-on-surface mb-md">Hola, soy el asistente de IA de Igualab. Respondo únicamente con base en los documentos cargados y siempre cito la fuente.</p>
              <p className="text-body-md text-on-surface mb-md"><strong>Para consultar, primero selecciona sector, empresa y año.</strong> Respondo sobre sostenibilidad, indicadores GRI y sanciones.</p>
              <div className="mt-md flex flex-wrap gap-sm">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    disabled={consultando}
                    onClick={() => { if (ctxOk) responder(s); else toast("Primero elige sector, empresa y año.", "warn"); }}
                    className="px-4 py-2 bg-surface-container-low hover:bg-surface-variant rounded-full text-label-md text-on-surface-variant transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mensajes.map((m) => <MensajeItem key={m.id} m={m} nombreEmpresa={nombreEmpresa} />)}
        </div>

        <div className="p-xl bg-surface border-t border-outline-variant">
          <div className="max-w-4xl mx-auto">
            <div className={`bg-surface-container-lowest border-2 border-outline-variant rounded-xl transition-all ${ctxOk ? "" : "opacity-60"}`}>
              <textarea
                rows={2}
                aria-label="Pregunta para el asistente"
                disabled={!ctxOk}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder={ctxOk ? "Pregunta sobre indicadores GRI, sanciones, desempeño ambiental…" : "Selecciona sector, empresa y año para habilitar la consulta…"}
                className="w-full bg-transparent border-none rounded-xl text-body-md text-on-surface p-lg resize-none focus:ring-0 outline-none disabled:cursor-not-allowed"
              />
              <div className="flex justify-between items-center px-md pb-md">
                <span className="text-label-sm text-outline">{empresa && ctxOk ? `Contexto: ${empresa.nombre} · ${anio}` : "Sin contexto seleccionado"}</span>
                <button onClick={enviar} disabled={!ctxOk || consultando || !texto.trim()} className="bg-primary hover:bg-surface-tint text-on-primary px-lg py-2 rounded-lg text-label-md font-semibold flex items-center gap-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <span>Consultar</span>
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
            <p className="text-center text-label-sm text-outline mt-sm">La IA siempre cita la fuente. Si los documentos no bastan para responder, lo indica.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const CLS_CONTROL =
  "rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[160px]";

function Avatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-on-primary">psychology</span>
    </div>
  );
}

function MensajeItem({ m, nombreEmpresa }: Readonly<{ m: Mensaje; nombreEmpresa: (id: string) => string }>) {
  if (m.autor === "user") {
    return (
      <div className="flex gap-lg max-w-4xl self-end flex-row-reverse">
        <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant">person</span>
        </div>
        <div className="bg-primary-container p-lg rounded-xl rounded-tr-sm shadow-sm text-on-primary-container"><p className="text-body-md">{m.texto}</p></div>
      </div>
    );
  }
  if (m.typing) {
    return (
      <div className="flex gap-lg" aria-label="El asistente está escribiendo">
        <Avatar />
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl rounded-tl-sm shadow-sm flex gap-xs items-center h-[56px]">
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </div>
      </div>
    );
  }
  if (m.error) {
    return (
      <div className="flex gap-lg max-w-4xl">
        <Avatar />
        <div className="bg-error-container text-on-error-container p-lg rounded-xl rounded-tl-sm shadow-sm flex items-start gap-sm">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <p className="text-body-md">{m.texto}</p>
        </div>
      </div>
    );
  }
  const citas = m.citas ?? [];
  return (
    <div className="flex gap-lg max-w-4xl">
      <Avatar />
      <div className="bg-surface-container-lowest border border-secondary-fixed p-lg rounded-xl rounded-tl-sm shadow-sm relative overflow-hidden w-full">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary-fixed" />
        <p className="text-body-md text-on-surface whitespace-pre-line">{m.texto}</p>
        {m.sinEvidencia && (
          <div className="mt-md flex items-start gap-sm rounded-lg bg-tertiary-fixed/40 text-on-tertiary-fixed px-md py-sm text-label-md">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>{m.aviso || "Los documentos cargados no contienen evidencia suficiente para responder."}</span>
          </div>
        )}
        {citas.length > 0 && (
          <div className="mt-lg pt-md border-t border-outline-variant space-y-sm">
            <p className="text-label-sm text-on-surface-variant uppercase">Fuentes citadas</p>
            {citas.map((c) => (
              <Fuente key={`${c.documento_id}:${c.seccion}:${c.extracto.slice(0, 24)}`} cita={c} empresa={nombreEmpresa(c.empresa_id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Fuente({ cita, empresa }: Readonly<{ cita: CitaAsistente; empresa: string }>) {
  return (
    <div className="rounded-lg bg-surface-container-low px-md py-sm">
      <p className="text-label-sm text-on-surface-variant flex items-center gap-xs">
        <span className="material-symbols-outlined text-[16px]">description</span>
        <span>{empresa} · {cita.anio} · {cita.seccion}</span>
      </p>
      <p className="text-body-md text-on-surface-variant italic mt-xs break-words">“{cita.extracto}”</p>
    </div>
  );
}

function Campo({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-label-sm text-on-surface-variant uppercase">{label}</span>
      {children}
    </label>
  );
}
