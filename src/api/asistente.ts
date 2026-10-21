import { api } from "./client";
import type { ConsultaAsistente, SectorApi } from "../types";

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
