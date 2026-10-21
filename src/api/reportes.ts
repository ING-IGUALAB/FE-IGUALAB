import { api, apiArchivo } from "./client";
import type { ReporteResumen } from "../types";

/** Historial de reportes de prospección generados. */
export function listarReportes() {
  return api<ReporteResumen[]>("/reportes");
}

/** Genera y guarda el reporte (PDF) de una empresa y año. */
export function generarReporte(empresaId: string, anio: number) {
  return api<ReporteResumen>("/reportes", { method: "POST", body: { empresa_id: empresaId, anio } });
}

/** PDF de vista previa, sin guardarlo en el historial. */
export function vistaPreviaReporte(empresaId: string, anio: number) {
  return apiArchivo("/reportes/vista-previa", { method: "POST", body: { empresa_id: empresaId, anio } });
}

/** PDF de un reporte ya generado. */
export function descargarReporte(reporteId: string) {
  return apiArchivo(`/reportes/${encodeURIComponent(reporteId)}/archivo`);
}
