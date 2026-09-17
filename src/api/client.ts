import { getToken, limpiarSesion } from "../lib/token";
import { config } from "../config";
import type { BackendError, BackendErrorResponse } from "../types";

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
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  window.dispatchEvent(new CustomEvent(LOADING_START));
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "No se pudo conectar con el servidor." });
  } finally {
    window.dispatchEvent(new CustomEvent(LOADING_END));
  }

  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const be: BackendError | null =
      data && typeof data === "object" && "error" in data ? (data as BackendErrorResponse).error : null;
    const apiErr = new ApiError(res.status, {
      code: be?.code ?? null,
      message: be?.message,
      details: be?.details ?? null,
      requestId: be?.request_id ?? null,
    });
    // Cierre de sesión SOLO ante sesión inválida o expirada (no ante cualquier 401).
    if (be?.code && CODIGOS_CIERRE_SESION.has(be.code)) {
      limpiarSesion();
      window.dispatchEvent(new CustomEvent(AUTH_401_EVENT));
    }
    throw apiErr;
  }

  return data as T;
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
