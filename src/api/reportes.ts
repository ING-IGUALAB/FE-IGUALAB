import { api, apiArchivo, ApiError } from "./client";
import type { ReporteResumen } from "../types";

/** Historial de reportes de prospección generados. */
export function listarReportes() {
  return api<ReporteResumen[]>("/reportes");
}

/** Genera y guarda el reporte (PDF) de una empresa y año. */
export function generarReporte(empresaId: string, anio: number) {
  return api<ReporteResumen>("/reportes", { method: "POST", body: { empresa_id: empresaId, anio } });
}

/**
 * Si el error es «ya existe un reporte de esa empresa y año» (409 REPORT_ALREADY_EXISTS), devuelve
 * el id de ese reporte (puede faltar); si es otro error, null.
 */
export function reporteYaExistente(err: unknown): { reporteId?: string } | null {
  if (!(err instanceof ApiError) || err.code !== "REPORT_ALREADY_EXISTS") return null;
  const id = (err.details as { reporte_id?: unknown } | null)?.reporte_id;
  return typeof id === "string" ? { reporteId: id } : {};
}

/** PDF de vista previa, sin guardarlo en el historial. */
export function vistaPreviaReporte(empresaId: string, anio: number) {
  return apiArchivo("/reportes/vista-previa", { method: "POST", body: { empresa_id: empresaId, anio } });
}

/** PDF de un reporte ya generado. */
export function descargarReporte(reporteId: string) {
  return apiArchivo(`/reportes/${encodeURIComponent(reporteId)}/archivo`);
}
