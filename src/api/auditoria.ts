import { api } from "./client";
import type { EventoAuditoriaApi, PaginaEventos, TipoEventoAuditoria } from "../types";

export interface FiltrosAuditoria {
  tipoEvento?: TipoEventoAuditoria;
  usuarioId?: string;
  /** ISO 8601 en UTC. */
  desde?: string;
  /** ISO 8601 en UTC. */
  hasta?: string;
  pagina?: number;
  tamano?: number;
}

export function listarEventos(filtros: FiltrosAuditoria = {}) {
  const qs = new URLSearchParams();
  if (filtros.tipoEvento) qs.set("tipo_evento", filtros.tipoEvento);
  if (filtros.usuarioId) qs.set("usuario_id", filtros.usuarioId);
  if (filtros.desde) qs.set("desde", filtros.desde);
  if (filtros.hasta) qs.set("hasta", filtros.hasta);
  qs.set("pagina", String(filtros.pagina ?? 1));
  qs.set("tamano", String(filtros.tamano ?? 20));
  return api<PaginaEventos>(`/auditoria?${qs.toString()}`);
}

/** Todos los eventos que cumplen los filtros (de 100 en 100), para exportarlos. */
export async function listarTodosEventos(filtros: Omit<FiltrosAuditoria, "pagina" | "tamano"> = {}) {
  const todos: EventoAuditoriaApi[] = [];
  let pagina = 1;
  let total = 0;
  do {
    const data = await listarEventos({ ...filtros, pagina, tamano: 100 });
    todos.push(...data.items);
    total = data.total;
    pagina += 1;
    if (data.items.length === 0) break;
  } while (todos.length < total);
  return todos;
}
