import { api } from "./client";
import type { ConsultaAsistente } from "../types";

/**
 * Pregunta al asistente de IA sobre el corpus indexado (RAG con citas).
 * Es silenciosa: el chat muestra su propio indicador de "escribiendo".
 */
export function consultarAsistente(datos: { pregunta: string; empresaId?: string; anio?: number }) {
  return api<ConsultaAsistente>("/asistente/consultas", {
    method: "POST",
    silencioso: true,
    body: { pregunta: datos.pregunta, empresa_id: datos.empresaId ?? null, anio: datos.anio ?? null },
  });
}
