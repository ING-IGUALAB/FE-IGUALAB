import { api, apiConEstado } from "./client";
import type {
  DisponibilidadIngesta,
  DocumentoDeshabilitado,
  DocumentoDetalle,
  DocumentoResumen,
  EstadoProgreso,
  Operacion,
  OperacionCreada,
  PaginaDocumentos,
  ResultadoIngesta,
  TipoDocumentoApi,
} from "../types";

/** Paso 1: crea la operación de ingesta (devuelve el id al que se sube el archivo). */
export function crearOperacion() {
  return api<OperacionCreada>("/documentos/operaciones", { method: "POST" });
}

/**
 * Respuesta de la carga: 201 si terminó de una vez; 202 si quedó en pausa esperando que alguien
 * decida continuar o cancelar (doble check). El 202 no es un error.
 */
export type RespuestaIngesta = { status: 201; data: ResultadoIngesta } | { status: 202; data: Operacion };

/** Paso 2: sube el archivo .md a la operación (multipart). Procesamiento síncrono (RF-022). */
export async function ingerirDocumento(
  operacionId: string,
  datos: { archivo: File; empresaId: string; anio: number; tipoDocumento: TipoDocumentoApi },
): Promise<RespuestaIngesta> {
  const form = new FormData();
  form.append("archivo", datos.archivo);
  form.append("empresa_id", datos.empresaId);
  form.append("anio", String(datos.anio));
  form.append("tipo_documento", datos.tipoDocumento);
  const { status, data } = await apiConEstado<ResultadoIngesta | Operacion>(`/documentos/operaciones/${operacionId}/ingesta`, {
    method: "POST",
    body: form,
  });
  return status === 202 ? { status: 202, data: data as Operacion } : { status: 201, data: data as ResultadoIngesta };
}

/** Doble check: continúa una ingesta en pausa (indexa y publica). */
export function confirmarOperacion(operacionId: string) {
  return api<ResultadoIngesta>(`/documentos/operaciones/${operacionId}/confirmar`, { method: "POST" });
}

/** Doble check: cancela una ingesta en pausa; se eliminan el original y los fragmentos. */
export function cancelarOperacion(operacionId: string) {
  return api<Operacion>(`/documentos/operaciones/${operacionId}/cancelar`, { method: "POST" });
}

/** Consulta el progreso/resultado de una operación (polling si no fue terminal). */
export function consultarOperacion(operacionId: string) {
  return api<Operacion>(`/documentos/operaciones/${operacionId}`);
}

export function reintentarPublicacion(operacionId: string) {
  // Sin indicador propio en pantalla: usa el indicador central.
  return api<Operacion>(`/documentos/operaciones/${operacionId}/reintentar-publicacion`, { method: "POST", indicadorGlobal: true });
}

export interface FiltrosDocumentos {
  empresaId?: string;
  anio?: number;
  tipo?: TipoDocumentoApi;
  estado?: EstadoProgreso;
  pagina?: number;
  tamano?: number;
}

export function listarDocumentos(filtros: FiltrosDocumentos = {}) {
  const qs = new URLSearchParams();
  if (filtros.empresaId) qs.set("empresa_id", filtros.empresaId);
  if (filtros.anio) qs.set("anio", String(filtros.anio));
  if (filtros.tipo) qs.set("tipo", filtros.tipo);
  if (filtros.estado) qs.set("estado", filtros.estado);
  qs.set("pagina", String(filtros.pagina ?? 1));
  qs.set("tamano", String(filtros.tamano ?? 20));
  return api<PaginaDocumentos>(`/documentos?${qs.toString()}`);
}

/**
 * Trae TODAS las páginas que cumplen los filtros (de 100 en 100). Se usa cuando hay que filtrar
 * por algo que el backend no soporta en `GET /documentos` (p. ej. sector) y paginar en el cliente.
 */
export async function listarTodosDocumentos(filtros: Omit<FiltrosDocumentos, "pagina" | "tamano"> = {}) {
  const todos: DocumentoResumen[] = [];
  let pagina = 1;
  let paginas = 1;
  do {
    const data = await listarDocumentos({ ...filtros, pagina, tamano: 100 });
    todos.push(...data.items);
    paginas = data.paginas;
    pagina += 1;
  } while (pagina <= paginas);
  return todos;
}

/** Qué tipos de documento se pueden cargar aún para esa empresa y año (uno de cada tipo por año). */
export function disponibilidadIngesta(empresaId: string, anio: number) {
  const qs = new URLSearchParams({ empresa_id: empresaId, anio: String(anio) });
  return api<DisponibilidadIngesta>(`/documentos/disponibilidad?${qs.toString()}`);
}

/**
 * Documentos de varios estados a la vez. El backend filtra un estado por petición, así que se pide
 * cada uno y se unen, del más reciente al más antiguo. Sin estados, trae todos.
 */
export async function listarPorEstados(
  estados: EstadoProgreso[],
  filtros: Omit<FiltrosDocumentos, "estado" | "pagina" | "tamano"> = {},
) {
  if (estados.length <= 1) return listarTodosDocumentos({ ...filtros, estado: estados[0] });
  const listas = await Promise.all(estados.map((estado) => listarTodosDocumentos({ ...filtros, estado })));
  // Sin repetidos: un documento puede cambiar de estado entre una consulta y otra.
  const porId = new Map(listas.flat().map((d) => [d.id, d]));
  return [...porId.values()].sort((a, b) => b.creado_en.localeCompare(a.creado_en));
}

/**
 * Retira un documento completado: deja de usarse en el análisis, los reportes nuevos y el asistente,
 * y libera su lugar para un reemplazo. No borra nada y no se puede revertir. El motivo es obligatorio.
 */
export function deshabilitarDocumento(id: string, motivo: string) {
  return api<DocumentoDeshabilitado>(`/documentos/${id}/deshabilitar`, { method: "POST", body: { motivo } });
}

export function detalleDocumento(id: string) {
  return api<DocumentoDetalle>(`/documentos/${id}`);
}
