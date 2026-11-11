import { api } from "./client";
import type {
  DisponibilidadIngesta,
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

/** Paso 2: sube el archivo .md a la operación (multipart). Procesamiento síncrono (RF-022). */
export function ingerirDocumento(
  operacionId: string,
  datos: { archivo: File; empresaId: string; anio: number; tipoDocumento: TipoDocumentoApi },
) {
  const form = new FormData();
  form.append("archivo", datos.archivo);
  form.append("empresa_id", datos.empresaId);
  form.append("anio", String(datos.anio));
  form.append("tipo_documento", datos.tipoDocumento);
  return api<ResultadoIngesta>(`/documentos/operaciones/${operacionId}/ingesta`, {
    method: "POST",
    body: form,
  });
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
  return listas.flat().sort((a, b) => b.creado_en.localeCompare(a.creado_en));
}

export function detalleDocumento(id: string) {
  return api<DocumentoDetalle>(`/documentos/${id}`);
}
