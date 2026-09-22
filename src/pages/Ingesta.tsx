import { useMemo, useRef, useState, type ReactNode } from "react";
import SectionHeader from "../components/SectionHeader";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useToast } from "../components/ToastProvider";
import { useDomain } from "../data/DomainContext";
import { useAuth } from "../auth/AuthContext";
import { SECTORES } from "../data/seed";
import type { Documento, Sector, TipoDocumento } from "../types";

const TIPOS: TipoDocumento[] = ["Memoria Anual", "Reporte de Sostenibilidad GRI"];

export default function Ingesta() {
  const toast = useToast();
  const { sesion } = useAuth();
  const { empresas, documentos, agregarDocumento, agregarEmpresa, pushAudit } = useDomain();

  const [sector, setSector] = useState<Sector>(SECTORES[0]);
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState(2025);
  const [tipo, setTipo] = useState<TipoDocumento>(TIPOS[0]);
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [progreso, setProgreso] = useState<{ label: string; pct: number } | null>(null);
  const [empresaModal, setEmpresaModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const empresasSector = useMemo(() => empresas.filter((e) => e.sector === sector && e.activa), [empresas, sector]);
  const empresaSel = empresasSector.find((e) => e.id === empresaId) || empresasSector[0];

  function rechazar(nombre: string, motivo: string) {
    pushAudit(sesion!.nombre, "Rechazo de documento", `Rechazó '${nombre}': ${motivo}`);
    toast(`Carga rechazada: ${motivo}`, "error");
  }

  function realizarIngesta() {
    if (!pendientes.length) return toast("Selecciona primero un archivo .md.", "warn");
    const empresa = empresaSel;
    if (!empresa) return rechazar(pendientes[0].name, "no se seleccionó una empresa válida.");

    pendientes.forEach((f) => {
      if (!/\.md$/i.test(f.name)) return rechazar(f.name, "el archivo no tiene extensión .md (RF-018).");
      if (f.size > 50 * 1024 * 1024) return rechazar(f.name, "el archivo supera los 50 MB (RNF-014).");
      const dup = documentos.find((d) => d.empresaId === empresa.id && d.tipo === tipo && d.anio === anio && d.estado !== "Rechazado");
      if (dup) return rechazar(f.name, `ya existe un documento '${tipo}' para ${empresa.nombre} (${anio}), cargado por ${dup.cuenta} el ${dup.fecha} (RN-033).`);
      procesar(f, empresa.id, empresa.nombre, empresa.sector);
    });
    setPendientes([]);
  }

  function procesar(f: File, empId: string, empNombre: string, empSector: Sector) {
    const etapas = [
      [20, "Validando Markdown…"],
      [45, "Detectando códigos GRI y sanciones…"],
      [70, "Indexando para el asistente…"],
      [100, "Ejecutando análisis…"],
    ] as const;
    let p = 0;
    let ei = 0;
    const iv = setInterval(() => {
      p += 8;
      if (etapas[ei] && p >= etapas[ei][0]) {
        setProgreso({ label: etapas[ei][1], pct: Math.min(p, 100) });
        ei++;
      } else {
        setProgreso((prev) => ({ label: prev?.label || "Procesando…", pct: Math.min(p, 100) }));
      }
      if (p >= 100) {
        clearInterval(iv);
        finalizar(f, empId, empNombre, empSector);
        setTimeout(() => setProgreso(null), 500);
      }
    }, 120);
  }

  function finalizar(f: File, empId: string, empNombre: string, empSector: Sector) {
    const sinContenido = /vacio|empty/i.test(f.name); // RF-019 (simulado)
    const base: Documento = {
      id: "d" + Date.now(),
      empresaId: empId,
      empresa: empNombre,
      sector: empSector,
      anio,
      tipo,
      estado: sinContenido ? "Rechazado" : "Éxito",
      fecha: new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }),
      cuenta: sesion!.nombre,
      hash: "sha256:" + crypto.randomUUID().replace(/-/g, "").slice(0, 4) + "…" + crypto.randomUUID().replace(/-/g, "").slice(0, 4),
      tamano: (f.size / 1e6).toFixed(1) + " MB",
    };
    if (sinContenido) {
      rechazar(f.name, "no contiene códigos GRI ni menciones de sanción (RF-019).");
      return;
    }
    agregarDocumento(base);
    pushAudit(sesion!.nombre, "Ingesta de documento", `Ingestó '${empNombre} · ${anio}' (${tipo}, ${empSector})`);
    toast(`Documento de ${empNombre} (${anio}) ingestado e indexado.`, "success");
  }

  return (
    <>
      <SectionHeader titulo="Ingesta de documentos" sub="Carga de memorias anuales y reportes de sostenibilidad GRI ya convertidos a Markdown por el cliente (RN-012). Sólo se admite .md." />
      <PendienteBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-1 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow">
            <h3 className="text-title-lg text-on-background mb-md">Nueva carga</h3>
            <div className="space-y-md">
              <Campo label="Sector (RN-019)">
                <select value={sector} onChange={(e) => { setSector(e.target.value as Sector); setEmpresaId(""); }} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  {SECTORES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Campo>
              <Campo label="Empresa (RN-014)">
                <select value={empresaSel?.id || ""} onChange={(e) => setEmpresaId(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  {empresasSector.length ? empresasSector.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>) : <option value="">— Sin empresas en este sector —</option>}
                </select>
              </Campo>
              <div className="grid grid-cols-2 gap-sm">
                <Campo label="Año">
                  <input type="number" min={2000} max={2030} value={anio} onChange={(e) => setAnio(Number.parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </Campo>
                <Campo label="Tipo (RN-011)">
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                    {TIPOS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Campo>
              </div>

              <label
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dropzone-active"); }}
                onDragLeave={(e) => e.currentTarget.classList.remove("dropzone-active")}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("dropzone-active"); if (e.dataTransfer.files.length) setPendientes(Array.from(e.dataTransfer.files)); }}
                className="flex flex-col items-center justify-center gap-sm border-2 border-dashed border-outline-variant rounded-xl p-lg text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="material-symbols-outlined text-[36px] text-primary">cloud_upload</span>
                <span className="text-body-md text-on-background font-medium">Arrastra el .md aquí o haz clic para seleccionar</span>
                <span className="text-label-sm text-outline">Sólo Markdown (.md) · hasta 50 MB (RNF-014)</span>
                <input ref={inputRef} type="file" multiple accept=".md,text/markdown" className="hidden" onChange={(e) => { if (e.target.files?.length) { setPendientes(Array.from(e.target.files)); } e.target.value = ""; }} />
              </label>

              {pendientes.length > 0 && (
                <div className="rounded-lg border border-outline-variant bg-surface-container-low p-sm">
                  <p className="text-label-sm text-on-surface-variant uppercase mb-xs">Archivo(s) por ingestar</p>
                  <ul className="space-y-xs text-body-md text-on-surface">
                    {pendientes.map((f) => (
                      <li key={f.name} className="flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[16px] text-primary">description</span> {f.name}
                        <span className="text-outline">· {(f.size / 1e6).toFixed(1)} MB</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {progreso && (
                <div>
                  <div className="flex justify-between text-label-sm text-on-surface-variant mb-xs"><span>{progreso.label}</span><span>{progreso.pct}%</span></div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-200" style={{ width: `${progreso.pct}%` }} /></div>
                </div>
              )}

              <p className="text-label-sm text-outline flex items-start gap-xs"><span className="material-symbols-outlined text-[14px]">info</span> Procesamiento síncrono: se valida, indexa y ejecuta el análisis al finalizar (RF-022).</p>

              <button onClick={realizarIngesta} disabled={!pendientes.length} className="w-full bg-primary text-on-primary py-md px-lg rounded-lg flex items-center justify-center gap-sm shadow-md hover:bg-surface-tint transition-all text-body-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined">cloud_sync</span> Realizar ingesta
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
          <div className="p-lg border-b border-outline-variant bg-surface-bright flex justify-between items-center gap-md">
            <h3 className="text-title-lg text-on-surface">Documentos ingestados</h3>
            <div className="flex items-center gap-md">
              <span className="hidden sm:inline text-label-sm text-on-surface-variant">Estado, tipo y fecha (RF-024)</span>
              <button onClick={() => setEmpresaModal(true)} className="flex items-center gap-sm px-md py-sm bg-primary text-on-primary rounded-lg text-label-md font-semibold hover:bg-surface-tint transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[18px]">add_business</span> Agregar empresa
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  {["Documento", "Empresa", "Año", "Tipo", "Estado", "Fecha"].map((h) => (
                    <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-body-md">
                {documentos.map((d) => (
                  <tr key={d.id} className="border-b border-surface-variant hover:bg-surface/50 transition-colors">
                    <td className="py-md px-md">
                      <div className="flex items-center gap-sm">
                        <span className={`material-symbols-outlined ${d.tipo === "Reporte de Sostenibilidad GRI" ? "text-secondary" : "text-primary"}`}>{d.tipo === "Reporte de Sostenibilidad GRI" ? "eco" : "description"}</span>
                        <div>
                          <p className="font-medium text-on-background">{d.empresa} · {d.anio}</p>
                          <p className="text-label-sm text-outline">{d.hash} · {d.tamano}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-md px-md">{d.empresa}</td>
                    <td className="py-md px-md text-on-surface-variant">{d.anio}</td>
                    <td className="py-md px-md">{d.tipo}</td>
                    <td className="py-md px-md"><Badge estado={d.estado} /></td>
                    <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{d.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AgregarEmpresaModal open={empresaModal} onClose={() => setEmpresaModal(false)} onCreada={(nombre, sec) => {
        const r = agregarEmpresa(nombre, sec);
        if (!r.ok) { toast(r.error || "No se pudo registrar.", "error"); return false; }
        pushAudit(sesion!.nombre, "Registro de empresa", `Registró la empresa '${nombre}' (sector ${sec})`);
        toast(`Empresa '${nombre}' registrada.`, "success");
        return true;
      }} />
    </>
  );
}

function Campo({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-xs">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}

export function PendienteBanner() {
  return (
    <div className="flex items-start gap-sm rounded-xl border border-tertiary-fixed bg-tertiary-fixed/30 px-md py-sm text-on-tertiary-fixed">
      <span className="material-symbols-outlined text-[18px]">construction</span>
      <p className="text-label-md">Módulo con datos locales de demostración. Pendiente de conexión con el backend (aún no expone estos endpoints).</p>
    </div>
  );
}

function AgregarEmpresaModal({ open, onClose, onCreada }: Readonly<{ open: boolean; onClose: () => void; onCreada: (nombre: string, sector: Sector) => boolean }>) {
  const [nombre, setNombre] = useState("");
  const [sector, setSector] = useState<Sector>(SECTORES[0]);
  const [error, setError] = useState("");

  function guardar() {
    setError("");
    if (!nombre.trim()) return setError("El nombre es obligatorio (RF-053).");
    const ok = onCreada(nombre.trim(), sector);
    if (ok) { setNombre(""); setSector(SECTORES[0]); onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-xl">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm"><span className="material-symbols-outlined text-primary">add_business</span> Agregar empresa</h3>
        <div className="space-y-md">
          <Campo label="Nombre de la empresa">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Ej. Compañía Minera del Norte S.A.A." />
          </Campo>
          <Campo label="Sector (RN-019)">
            <select value={sector} onChange={(e) => setSector(e.target.value as Sector)} className="w-full rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
              {SECTORES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Campo>
          {error && <div className="rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">{error}</div>}
        </div>
        <div className="flex justify-end gap-sm mt-lg">
          <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low">Cancelar</button>
          <button onClick={guardar} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint">Registrar</button>
        </div>
      </div>
    </Modal>
  );
}
