import type { EstadoProgreso, ResultadoAnalisis, SectorApi, TipoDocumentoApi } from "../types";

// ---- Sector ----
export const SECTORES_API: SectorApi[] = ["MINERIA", "PETROLEO", "ENERGIA"];
export const SECTOR_LABEL: Record<SectorApi, string> = {
  MINERIA: "Minería",
  PETROLEO: "Petróleo y Gas",
  ENERGIA: "Energía",
};

export function etiquetaSector(s: SectorApi): string {
  return SECTOR_LABEL[s] ?? s;
}

// ---- Tipo de documento ----
export const TIPOS_API: TipoDocumentoApi[] = ["MEMORIA_ANUAL", "REPORTE_SOSTENIBILIDAD_GRI"];
export const TIPO_LABEL: Record<TipoDocumentoApi, string> = {
  MEMORIA_ANUAL: "Memoria Anual",
  REPORTE_SOSTENIBILIDAD_GRI: "Reporte de Sostenibilidad GRI",
};

export function etiquetaTipo(t: TipoDocumentoApi): string {
  return TIPO_LABEL[t] ?? t;
}

// ---- Estado de progreso del documento (RF-024) ----
export const ESTADO_PROGRESO_LABEL: Record<EstadoProgreso, string> = {
  EN_PROCESO: "En proceso",
  PUBLICACION_PENDIENTE: "Publicación pendiente",
  COMPLETADO: "Completado",
  FALLIDO: "Fallido",
  FALLIDO_LIMPIEZA_PENDIENTE: "Fallido (limpieza pendiente)",
};

export function etiquetaEstado(e: EstadoProgreso): string {
  return ESTADO_PROGRESO_LABEL[e] ?? e;
}

export function etiquetaAnalisis(r: ResultadoAnalisis | null | undefined): string {
  if (r === "CON_HALLAZGOS") return "Con hallazgos";
  if (r === "OBSERVADO") return "Observado";
  return "—";
}

// ---- Validación de archivo para ingesta ----
// RF-018: sólo Markdown (.md). RNF-014: hasta 50 MB. No se admite vacío.
export const MAX_BYTES_INGESTA = 50 * 1024 * 1024;

export function validarArchivoIngesta(f: { name: string; size: number }): { ok: boolean; motivo?: string } {
  if (!/\.md$/i.test(f.name)) return { ok: false, motivo: "El archivo debe tener extensión .md (RF-018)." };
  if (f.size === 0) return { ok: false, motivo: "El archivo está vacío." };
  if (f.size > MAX_BYTES_INGESTA) return { ok: false, motivo: "El archivo supera los 50 MB (RNF-014)." };
  return { ok: true };
}

export function anioIngestaValido(anio: number): boolean {
  return Number.isInteger(anio) && anio >= 2000 && anio <= 9999;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
