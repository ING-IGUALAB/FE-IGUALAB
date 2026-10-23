import { getToken, limpiarSesion } from "../lib/token";
import { config } from "../config";
import type { ArchivoApi, BackendError, BackendErrorResponse } from "../types";

const API = config.apiUrl;

/**
 * Error de la API. Modela el nuevo contrato del backend:
 * { error: { code, message, details, request_id } }
 */
export class ApiError extends Error {
  status: number;
  code: string | null;
  details: unknown;
  requestId: string | null;
  constructor(status: number, opts: { code?: string | null; message?: string; details?: unknown; requestId?: string | null } = {}) {
    super(opts.message || `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = opts.code ?? null;
    this.details = opts.details ?? null;
    this.requestId = opts.requestId ?? null;
  }
}

// Evento global para que el AuthContext reaccione a expiraciones/sesiones inválidas.
export const AUTH_401_EVENT = "igualab:auth-401";

// Eventos de carga para el indicador de progreso.
export const LOADING_START = "igualab:loading-start";
export const LOADING_END = "igualab:loading-end";

// Solo estos códigos cierran la sesión automáticamente. Un 401 con otro código
// (p. ej. CURRENT_PASSWORD_INVALID) NO debe cerrar la sesión del usuario.
const CODIGOS_CIERRE_SESION = new Set(["INVALID_SESSION", "SESSION_EXPIRED"]);

interface Opts {
  method?: string;
  body?: unknown;
  auth?: boolean;
  /**
   * Muestra el indicador de carga central. Solo para acciones que no tienen indicador propio
   * (esqueleto, spinner en el botón, «Cargando…» del modal): así nunca se ven dos a la vez.
   */
  indicadorGlobal?: boolean;
}

// Construye el ApiError desde el contrato del backend y, si corresponde, cierra la sesión.
function lanzarErrorApi(status: number, data: unknown): never {
  const be: BackendError | null =
    data && typeof data === "object" && "error" in data ? (data as BackendErrorResponse).error : null;
  const apiErr = new ApiError(status, {
    code: be?.code ?? null,
    message: be?.message,
    details: be?.details ?? null,
    requestId: be?.request_id ?? null,
  });
  // Cierre de sesión SOLO ante sesión inválida o expirada (no ante cualquier 401).
  if (be?.code && CODIGOS_CIERRE_SESION.has(be.code)) {
    limpiarSesion();
    globalThis.dispatchEvent(new CustomEvent(AUTH_401_EVENT));
  }
  throw apiErr;
}

// Arma método, cabeceras (token) y cuerpo. En multipart (FormData) el navegador fija el
// Content-Type con su boundary, por eso no se envía a mano.
function prepararPeticion(opts: Opts): RequestInit {
  const { method = "GET", body, auth = true } = opts;
  const esFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!esFormData) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body === undefined) payload = undefined;
  else if (esFormData) payload = body as FormData;
  else payload = JSON.stringify(body);
  return { method, headers, body: payload };
}

// Ejecuta la petición avisando al indicador de carga y traduce la falta de red a ApiError.
async function ejecutar(path: string, opts: Opts): Promise<Response> {
  const avisar = opts.indicadorGlobal === true;
  if (avisar) globalThis.dispatchEvent(new CustomEvent(LOADING_START));
  try {
    return await fetch(`${API}${path}`, prepararPeticion(opts));
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "No se pudo conectar con el servidor." });
  } finally {
    if (avisar) globalThis.dispatchEvent(new CustomEvent(LOADING_END));
  }
}

/** Petición JSON: devuelve la respuesta tipada como T o lanza ApiError con el contrato del backend. */
export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const res = await ejecutar(path, opts);
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) lanzarErrorApi(res.status, data);
  return data as T;
}

/** Petición que devuelve un archivo (p. ej. el PDF de un reporte). Los errores llegan igual en JSON. */
export async function apiArchivo(path: string, opts: Opts = {}): Promise<ArchivoApi> {
  const res = await ejecutar(path, opts);
  if (!res.ok) lanzarErrorApi(res.status, await res.json().catch(() => null));
  return { blob: await res.blob(), nombre: nombreArchivoDe(res.headers.get("content-disposition")) };
}

/** Nombre del archivo indicado por el backend en Content-Disposition, si lo hay. */
export function nombreArchivoDe(disposicion: string | null): string | null {
  if (!disposicion) return null;
  let nombre: string | null = null;
  for (const parte of disposicion.split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    const valor = resto.join("=").trim().replace(/"/g, "");
    if (!valor) continue;
    if (clave.toLowerCase() === "filename*") return decodeURIComponent(valor.replace(/^utf-8''/i, ""));
    if (clave.toLowerCase() === "filename") nombre = valor;
  }
  return nombre;
}

// Extrae una lista de mensajes legibles desde error.details (validaciones).
function detallesToStrings(details: unknown): string[] {
  if (!details) return [];
  if (typeof details === "string") return [details];
  if (Array.isArray(details)) {
    return details
      .map((d) => (typeof d === "string" ? d : (d?.msg || d?.message || "")))
      .filter(Boolean);
  }
  if (typeof details === "object") {
    const errores = (details as { errores?: unknown }).errores;
    if (Array.isArray(errores)) return errores.map(String);
  }
  return [];
}

/** Traduce un error de la API a un mensaje legible para el usuario. */
/**
 * Cómo avisar un error de la API: un 409 indica que falta cumplir una condición o que los datos
 * cambiaron (p. ej. análisis sin validar, reporte ya generado), así que es una advertencia (amarillo).
 * Todo lo demás —caídas del servidor, red, permisos, no encontrado— es un error (rojo).
 */
export function tipoAviso(err: unknown): "warn" | "error" {
  return err instanceof ApiError && err.status === 409 ? "warn" : "error";
}

export function mensajeError(err: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (err instanceof ApiError) {
    const detalles = detallesToStrings(err.details);
    let msg = detalles.length ? detalles.join(" · ") : err.message || fallback;
    // En errores del servidor, incluir el request_id para soporte/diagnóstico.
    if (err.status >= 500 && err.requestId) msg += ` (ID: ${err.requestId})`;
    return msg;
  }
  return fallback;
}
