import { useMemo, useRef, useState, type ReactNode } from "react";
import { useDomain } from "../data/DomainContext";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { SECTORES, conteoEstados, esgScore, resumenSanciones } from "../data/seed";
import { money } from "../lib/format";
import { PendienteBanner } from "./Ingesta";
import type { Analisis } from "../types";

interface Mensaje {
  id: string;
  autor: "user" | "bot";
  texto: string;
  fuentes?: string[];
  typing?: boolean;
}

const SUGERENCIAS = [
  "¿Qué sanciones identificas para esta empresa y año?",
  "Señala las brechas GRI sub-reportadas",
  "Resume el desempeño ambiental del año consultado",
];

const DOMINIO = ["sanci", "gri", "brecha", "emision", "sosten", "esg", "reporte", "memoria", "residuo", "agua", "comunidad", "energ", "resumen", "desempeñ", "ambiental", "gobernanza", "multa", "biodivers"];

let msgSeq = 0;
const nuevoId = () => `m${(msgSeq += 1)}`;

function esDominio(t: string): boolean {
  return DOMINIO.some((k) => t.includes(k));
}

type Respuesta = { texto: string; fuentes: string[] };

function respSanciones(a: Analisis, nombre: string, anio: number): Respuesta {
  if (a.sanciones.length === 0) {
    return { texto: `No identifico sanciones para ${nombre} en ${anio} dentro del corpus. La ausencia de hallazgo no equivale a ausencia de evidencia (RN-031).`, fuentes: [] };
  }
  const res = resumenSanciones(a.sanciones);
  const detalle = a.sanciones.map((s) => `${s.entidad} — ${s.monto == null ? "no cuantificada" : money(s.monto)}`).join("; ");
  const extra = res.sinMonto ? `, con ${res.sinMonto} sin monto determinado` : "";
  const texto = `Para ${nombre} (${anio}) identifico ${a.sanciones.length} sanción(es): ${detalle}. Total cuantificado: ${money(res.total)}${extra}.`;
  return { texto, fuentes: [...new Set(a.sanciones.map((s) => s.doc))] };
}

function respBrechas(a: Analisis, nombre: string, anio: number): Respuesta {
  const brechas = a.gri.filter((g) => g.estado !== "OK");
  if (brechas.length === 0) {
    return { texto: `Todos los códigos GRI evaluados de ${nombre} (${anio}) están en estado OK.`, fuentes: [] };
  }
  const detalle = brechas.map((g) => `${g.codigo} (${g.tema}) — ${g.estado}`).join("; ");
  return { texto: `Brechas GRI de ${nombre} (${anio}): ${detalle}.`, fuentes: [...new Set(brechas.map((g) => g.doc))] };
}

function respResumen(a: Analisis, nombre: string, anio: number): Respuesta {
  const e = esgScore(a.gri);
  const c = conteoEstados(a.gri);
  const sanc = a.sanciones.length ? `Con ${a.sanciones.length} sanción(es) registrada(s).` : "Sin sanciones registradas.";
  const texto = `Resumen de ${nombre} (${anio}): puntaje ESG ${e}/100; ${c["OK"]} códigos OK, ${c["Baja sustancia"]} de baja sustancia y ${c["Sub-reportado"]} sub-reportados. ${sanc}`;
  return { texto, fuentes: [...new Set(a.gri.map((g) => g.doc))] };
}

function construirRespuesta(a: Analisis | null, nombre: string, anio: number, t: string): Respuesta {
  if (!a) return { texto: "No hay análisis persistido para este contexto.", fuentes: [] };
  if (!esDominio(t)) return { texto: "Solo puedo responder consultas sobre sostenibilidad empresarial, indicadores GRI, sanciones económicas o el contenido de los documentos ingestados (RN-037).", fuentes: [] };
  if (t.includes("sanci") || t.includes("multa")) return respSanciones(a, nombre, anio);
  if (t.includes("brecha") || t.includes("gri") || t.includes("sub-reportad") || t.includes("sub reportad")) return respBrechas(a, nombre, anio);
  return respResumen(a, nombre, anio);
}

function reemplazarTyping(xs: Mensaje[], nuevo: Mensaje): Mensaje[] {
  return [...xs.filter((m) => !m.typing), nuevo];
}

export default function Asistente() {
  const { empresasConDocumentos, aniosDeEmpresa, getAnalisis, pushAudit } = useDomain();
  const { sesion } = useAuth();
  const toast = useToast();

  const empresasDocs = empresasConDocumentos();
  const [sector, setSector] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const empresasSector = useMemo(() => empresasDocs.filter((e) => !sector || e.sector === sector), [empresasDocs, sector]);
  const empresa = empresasSector.find((e) => e.id === empresaId) || null;
  const anios = empresa ? aniosDeEmpresa(empresa.id) : [];
  const ctxOk = !!(sector && empresa && anio);

  const scrollLog = () => {
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }), 30);
  };

  function responder(pregunta: string) {
    if (!ctxOk || !empresa || !anio) {
      toast("Selecciona sector, empresa y año antes de consultar (RF-037).", "warn");
      return;
    }
    const nombre = empresa.nombre;
    const empId = empresa.id;
    const anioActual = anio;
    const t = pregunta.toLowerCase();
    setMensajes((xs) => [...xs, { id: nuevoId(), autor: "user", texto: pregunta }, { id: nuevoId(), autor: "bot", texto: "", typing: true }]);
    scrollLog();

    setTimeout(() => {
      const a = getAnalisis(empId, anioActual);
      const { texto: respuesta, fuentes } = construirRespuesta(a, nombre, anioActual, t);
      setMensajes((xs) => reemplazarTyping(xs, { id: nuevoId(), autor: "bot", texto: respuesta, fuentes }));
      pushAudit(sesion!.nombre, "Consulta IA", `Consulta RAG · ${nombre} (${anioActual}): '${pregunta.slice(0, 50)}'`);
      scrollLog();
    }, 1000);
  }

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    responder(t);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -m-lg md:-m-xl">
      <div className="px-lg pt-lg"><PendienteBanner /></div>

      {/* Contexto obligatorio (RF-037 / RN-038) */}
      <div className="bg-surface-container-lowest border-y border-outline-variant px-lg py-md flex flex-wrap gap-md items-end mt-md">
        <div className="flex items-center gap-xs text-secondary mr-sm"><span className="material-symbols-outlined">filter_alt</span><span className="text-label-md font-bold">Contexto de consulta</span></div>
        <Sel label="Sector" value={sector} onChange={(v) => { setSector(v); setEmpresaId(""); setAnio(null); }}>
          <option value="">— Elegir —</option>
          {SECTORES.map((s) => <option key={s}>{s}</option>)}
        </Sel>
        <Sel label="Empresa" value={empresa?.id || ""} onChange={(v) => { setEmpresaId(v); setAnio(null); }}>
          <option value="">— Elegir —</option>
          {empresasSector.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </Sel>
        <Sel label="Año" value={anio ? String(anio) : ""} onChange={(v) => setAnio(v ? Number.parseInt(v, 10) : null)}>
          <option value="">—</option>
          {anios.map((a) => <option key={a}>{a}</option>)}
        </Sel>
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
              <p className="text-body-md text-on-surface mb-md">Hola, soy el asistente de IA de Igualab. Respondo únicamente con base en los documentos ingestados (RN-021) y siempre cito la fuente.</p>
              <p className="text-body-md text-on-surface mb-md"><strong>Para consultar, primero selecciona sector, empresa y año</strong> (RF-037). Sólo respondo sobre sostenibilidad, indicadores GRI, sanciones o el contenido del corpus (RN-037).</p>
              <div className="mt-md flex flex-wrap gap-sm">
                {SUGERENCIAS.map((s) => (
                  <button key={s} onClick={() => { if (ctxOk) responder(s); else toast("Primero elige sector, empresa y año (RF-037).", "warn"); }} className="px-4 py-2 bg-surface-container-low hover:bg-surface-variant rounded-full text-label-md text-on-surface-variant transition-colors">{s}</button>
                ))}
              </div>
            </div>
          </div>

          {mensajes.map((m) => <MensajeItem key={m.id} m={m} />)}
        </div>

        <div className="p-xl bg-surface border-t border-outline-variant">
          <div className="max-w-4xl mx-auto">
            <div className={`bg-surface-container-lowest border-2 border-outline-variant rounded-xl transition-all ${ctxOk ? "" : "opacity-60"}`}>
              <textarea
                rows={2}
                disabled={!ctxOk}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder={ctxOk ? "Pregunta sobre brechas GRI, sanciones, desempeño ambiental…" : "Selecciona sector, empresa y año para habilitar la consulta…"}
                className="w-full bg-transparent border-none rounded-xl text-body-md text-on-surface p-lg resize-none focus:ring-0 outline-none disabled:cursor-not-allowed"
              />
              <div className="flex justify-between items-center px-md pb-md">
                <span className="text-label-sm text-outline">{empresa && anio ? `Contexto: ${empresa.nombre} · ${anio}` : "Sin contexto seleccionado"}</span>
                <button onClick={enviar} disabled={!ctxOk} className="bg-primary hover:bg-surface-tint text-on-primary px-lg py-2 rounded-lg text-label-md font-semibold flex items-center gap-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><span>Analizar</span><span className="material-symbols-outlined">send</span></button>
              </div>
            </div>
            <p className="text-center text-label-sm text-outline mt-sm">La IA siempre cita la fuente (RF-031). Si el corpus no basta, lo declara explícitamente (RF-033).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-on-primary">psychology</span></div>
  );
}

function MensajeItem({ m }: Readonly<{ m: Mensaje }>) {
  if (m.autor === "user") {
    return (
      <div className="flex gap-lg max-w-4xl self-end flex-row-reverse">
        <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-on-surface-variant">person</span></div>
        <div className="bg-primary-container p-lg rounded-xl rounded-tr-sm shadow-sm text-on-primary-container"><p className="text-body-md">{m.texto}</p></div>
      </div>
    );
  }
  if (m.typing) {
    return (
      <div className="flex gap-lg">
        <Avatar />
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl rounded-tl-sm shadow-sm flex gap-xs items-center h-[56px]"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
      </div>
    );
  }
  return (
    <div className="flex gap-lg max-w-4xl">
      <Avatar />
      <div className="bg-surface-container-lowest border border-secondary-fixed p-lg rounded-xl rounded-tl-sm shadow-sm relative overflow-hidden w-full">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary-fixed" />
        <p className="text-body-md text-on-surface whitespace-pre-line">{m.texto}</p>
        {m.fuentes && m.fuentes.length > 0 && (
          <div className="flex items-center gap-sm mt-lg pt-md border-t border-outline-variant flex-wrap">
            <span className="text-label-sm text-on-surface-variant uppercase">Fuentes citadas:</span>
            {m.fuentes.map((f) => (
              <span key={f} className="px-3 py-1 bg-surface-container-highest rounded-full text-label-md text-on-surface flex items-center gap-xs"><span className="material-symbols-outlined text-[16px]">description</span> {f}</span>
            ))}
          </div>
        )}
        <div className="mt-md text-label-sm text-outline">Fundamentada en el corpus · sin datos inventados (RN-022)</div>
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, children }: Readonly<{ label: string; value: string; onChange: (v: string) => void; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-label-sm text-on-surface-variant uppercase">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[160px]">
        {children}
      </select>
    </label>
  );
}
