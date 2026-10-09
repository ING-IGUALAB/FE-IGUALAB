import { api } from "./client";
import type {
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
  return api<Operacion>(`/documentos/operaciones/${operacionId}/reintentar-publicacion`, { method: "POST" });
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

export function detalleDocumento(id: string) {
  return api<DocumentoResumen>(`/documentos/${id}`);
}
