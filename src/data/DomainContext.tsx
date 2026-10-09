import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Analisis, Documento, Empresa, EstadoGri, EventoAuditoria, Reporte } from "../types";
import {
  ANALISIS_SEED,
  AUDIT_SEED,
  DOCUMENTOS_SEED,
  EMPRESAS_SEED,
  REPORTES_SEED,
  analisisKey,
} from "./seed";

interface DomainCtx {
  empresas: Empresa[];
  documentos: Documento[];
  reportes: Reporte[];
  analisis: Record<string, Analisis>;
  audit: EventoAuditoria[];
  setEstadoGri: (empresaId: string, anio: number, index: number, estado: EstadoGri) => void;
  agregarReporte: (r: Reporte) => void;
  pushAudit: (usuario: string, tipo: string, accion: string) => void;
  empresasConDocumentos: () => Empresa[];
  aniosDeEmpresa: (empresaId: string) => number[];
  getAnalisis: (empresaId: string, anio: number) => Analisis | null;
}

const Ctx = createContext<DomainCtx | null>(null);

// Secuencia incremental para ids de auditoría (evita PRNG / Math.random).
let auditSeq = 1000;
function siguienteAuditId(): number {
  auditSeq += 1;
  return auditSeq;
}

export function DomainProvider({ children }: Readonly<{ children: ReactNode }>) {
  // Empresas y documentos de demostración para los módulos que aún no tienen backend
  // (Asistente de IA, Reportes y Descargas). La Ingesta ya NO usa estos datos: consume
  // /empresas y /documentos del backend real.
  const [empresas] = useState<Empresa[]>(() => structuredClone(EMPRESAS_SEED));
  const [documentos] = useState<Documento[]>(() => structuredClone(DOCUMENTOS_SEED));
  const [reportes, setReportes] = useState<Reporte[]>(() => structuredClone(REPORTES_SEED));
  const [analisis, setAnalisis] = useState<Record<string, Analisis>>(() => structuredClone(ANALISIS_SEED));
  const [audit, setAudit] = useState<EventoAuditoria[]>(() => structuredClone(AUDIT_SEED));

  function pushAudit(usuario: string, tipo: string, accion: string) {
    setAudit((xs) => [
      ...xs,
      {
        id: siguienteAuditId(),
        fecha: new Date().toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", ""),
        usuario,
        tipo,
        accion,
      },
    ]);
  }

  function setEstadoGri(empresaId: string, anio: number, index: number, estado: EstadoGri) {
    setAnalisis((prev) => {
      const key = analisisKey(empresaId, anio);
      const a = prev[key];
      if (!a) return prev;
      const gri = a.gri.map((g, i) => (i === index ? { ...g, estado } : g));
      return { ...prev, [key]: { ...a, gri } };
    });
  }

  function agregarReporte(r: Reporte) {
    setReportes((xs) => [r, ...xs]);
  }

  function empresasConDocumentos() {
    const ids = new Set(documentos.filter((d) => d.estado === "Éxito").map((d) => d.empresaId));
    return empresas.filter((e) => ids.has(e.id));
  }

  function aniosDeEmpresa(empresaId: string) {
    const anios = documentos
      .filter((d) => d.empresaId === empresaId && d.estado === "Éxito")
      .map((d) => d.anio);
    return [...new Set(anios)].sort((a, b) => b - a);
  }

  function getAnalisis(empresaId: string, anio: number) {
    return analisis[analisisKey(empresaId, anio)] || null;
  }

  const value = useMemo<DomainCtx>(
    () => ({
      empresas,
      documentos,
      reportes,
      analisis,
      audit,
      setEstadoGri,
      agregarReporte,
      pushAudit,
      empresasConDocumentos,
      aniosDeEmpresa,
      getAnalisis,
    }),
    [empresas, documentos, reportes, analisis, audit]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDomain() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDomain debe usarse dentro de <DomainProvider>");
  return ctx;
}
