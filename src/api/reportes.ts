import { api, apiArchivo, ApiError, mensajeError } from "./client";
import type { AccionSugeridaReporte, ArchivoApi, DisponibilidadReportes, ReporteEmision, ReporteResumen, ReporteVigente } from "../types";

function consulta(empresaId: string, anio: number): string {
  return new URLSearchParams({ empresa_id: empresaId, anio: String(anio) }).toString();
}

/** Evita guardar como .pdf una respuesta que no lo es (p. ej. una página de error de un proxy). */
function soloPdf(archivo: ArchivoApi): ArchivoApi {
  if (!archivo.blob.type.toLowerCase().includes("application/pdf")) {
    throw new ApiError(502, { code: "RESPUESTA_NO_PDF", message: "El servidor no devolvió un PDF. Vuelve a intentarlo." });
  }
  return archivo;
}

/** Historial completo: todas las versiones, sin agrupar por empresa y año. */
export function listarReportes() {
  return api<ReporteResumen[]>("/reportes");
}

/** Años de la empresa con su estado: decide qué acciones se ofrecen en la pantalla. */
export function disponibilidadReportes(empresaId: string) {
  return api<DisponibilidadReportes>(`/reportes/disponibilidad?${new URLSearchParams({ empresa_id: empresaId })}`);
}

/** Última versión emitida de una empresa y año. Solo consulta: no genera nada. */
export function reporteVigente(empresaId: string, anio: number) {
  return api<ReporteVigente>(`/reportes/vigente?${consulta(empresaId, anio)}`);
}

/** Emite la versión de la validación vigente, o devuelve la que esa validación ya tenía. */
export function generarReporte(empresaId: string, anio: number) {
  return api<ReporteEmision>("/reportes", { method: "POST", body: { empresa_id: empresaId, anio } });
}

/** PDF de vista previa: el ya emitido para esa validación o uno sin emitir. Nunca crea historial. */
export async function vistaPreviaReporte(empresaId: string, anio: number) {
  return soloPdf(await apiArchivo("/reportes/vista-previa", { method: "POST", body: { empresa_id: empresaId, anio } }));
}

/** PDF de una versión concreta, incluso histórica. */
export async function descargarReporte(reporteId: string) {
  return soloPdf(await apiArchivo(`/reportes/${encodeURIComponent(reporteId)}/archivo`));
}

/** PDF de la última versión, solo si el servidor puede demostrar que está actualizada (si no, 409). */
export async function descargarReporteActualizado(empresaId: string, anio: number) {
  return soloPdf(await apiArchivo(`/reportes/vigente/archivo?${consulta(empresaId, anio)}`));
}

const MENSAJES_POR_CODIGO: Record<string, string> = {
  REPORT_SOURCE_CHANGED: "El análisis cambió mientras se generaba el reporte. Revísalo antes de volver a intentarlo.",
  REPORT_VERSION_CONFLICT: "No se pudo asignar la versión del reporte. Vuelve a intentarlo.",
};

const MENSAJES_POR_ACCION: Record<AccionSugeridaReporte, string> = {
  REVISAR: "El reporte ya no está actualizado: revisa el análisis GRI.",
  VALIDAR: "El reporte ya no está actualizado: valida el análisis GRI.",
  EMITIR: "Hay una validación nueva: genera una nueva versión del reporte.",
  DESCARGAR_VERSION_HISTORICA: "No se puede confirmar que este reporte esté actualizado. Puedes descargarlo como versión histórica.",
};

/** Mensaje de un error de reportes: se decide por el código, nunca por el texto del servidor. */
export function mensajeErrorReporte(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  // Sin código no es una respuesta del backend (p. ej. una página de error del proxy).
  if (!err.code) return fallback;
  const porCodigo = MENSAJES_POR_CODIGO[err.code];
  if (porCodigo) return porCodigo;
  const accion = (err.details as { accion_sugerida?: AccionSugeridaReporte } | null)?.accion_sugerida;
  if (accion && MENSAJES_POR_ACCION[accion]) return MENSAJES_POR_ACCION[accion];
  return mensajeError(err, fallback);
}

/** Sin respuesta del servidor no se sabe si el reporte se emitió: no se puede afirmar que falló. */
export function emisionSinConfirmar(err: unknown): boolean {
  return err instanceof ApiError && (err.code === "NETWORK_ERROR" || (err.status >= 500 && !err.code));
}
