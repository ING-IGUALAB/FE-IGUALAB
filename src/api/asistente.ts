import { api } from "./client";
import type {
  ConsultaAsistente,
  ConversacionDetalle,
  ConversacionGuardada,
  IntercambioGuardado,
  MensajeParaGuardar,
  PaginaConversaciones,
  SectorApi,
} from "../types";

/**
 * Pregunta al asistente de IA sobre el corpus indexado (RAG con afirmaciones respaldadas).
 * Sector, empresa y año son obligatorios. El chat muestra su propio indicador («Buscando…»).
 */
export function consultarAsistente(datos: { pregunta: string; sector: SectorApi; empresaId: string; anio: number }) {
  return api<ConsultaAsistente>("/asistente/consultas", {
    method: "POST",
    body: { pregunta: datos.pregunta, sector: datos.sector, empresa_id: datos.empresaId, anio: datos.anio },
  });
}

/**
 * Guarda el chat en el historial del usuario. La clave se reutiliza en los reintentos: con el mismo
 * contenido devuelve la conversación ya guardada en lugar de crear otra.
 */
export function guardarConversacion(datos: {
  clave: string;
  sector: SectorApi;
  empresaId: string;
  anio: number;
  mensajes: MensajeParaGuardar[];
}) {
  return api<ConversacionGuardada>("/asistente/conversaciones", {
    method: "POST",
    body: { clave_idempotencia: datos.clave, empresa_id: datos.empresaId, sector: datos.sector, anio: datos.anio, mensajes: datos.mensajes },
  });
}

/** Conversaciones guardadas del usuario, de la más reciente a la más antigua (sin los mensajes). */
export function listarConversaciones(pagina = 1, tamano = 20) {
  return api<PaginaConversaciones>(`/asistente/conversaciones?${new URLSearchParams({ pagina: String(pagina), tamano: String(tamano) })}`);
}

export function obtenerConversacion(id: string) {
  return api<ConversacionDetalle>(`/asistente/conversaciones/${id}`);
}

/** Pregunta dentro de una conversación guardada: el servidor guarda la pregunta y la respuesta. */
export function continuarConversacion(id: string, clave: string, pregunta: string) {
  return api<IntercambioGuardado>(`/asistente/conversaciones/${id}/consultas`, {
    method: "POST",
    body: { clave_idempotencia: clave, pregunta },
  });
}
