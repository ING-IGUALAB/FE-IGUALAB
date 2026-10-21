import { api } from "./client";
import type { ConsultaAsistente, SectorApi } from "../types";

/**
 * Pregunta al asistente de IA sobre el corpus indexado (RAG con afirmaciones respaldadas).
 * Sector, empresa y año son obligatorios. Es silenciosa: el chat muestra su propio indicador.
 */
export function consultarAsistente(datos: { pregunta: string; sector: SectorApi; empresaId: string; anio: number }) {
  return api<ConsultaAsistente>("/asistente/consultas", {
    method: "POST",
    silencioso: true,
    body: { pregunta: datos.pregunta, sector: datos.sector, empresa_id: datos.empresaId, anio: datos.anio },
  });
}
