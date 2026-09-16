import { getToken, limpiarSesion } from "../lib/token";
import { config } from "../config";

const API = config.apiUrl;

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

// Evento global para que el AuthContext reaccione a expiraciones (401).
export const AUTH_401_EVENT = "igualab:auth-401";

// Eventos de carga para la barra de progreso superior.
export const LOADING_START = "igualab:loading-start";
export const LOADING_END = "igualab:loading-end";

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
    throw new ApiError(0, { mensaje: "No se pudo conectar con el servidor." });
  } finally {
    window.dispatchEvent(new CustomEvent(LOADING_END));
  }

  if (res.status === 401) {
    limpiarSesion();
    window.dispatchEvent(new CustomEvent(AUTH_401_EVENT));
    const data = await res.json().catch(() => null);
    throw new ApiError(401, data?.detail ?? "Sesión inválida o expirada.");
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? null);
  return data as T;
}

// Traduce el `detail` del backend a un mensaje legible.
export function mensajeError(err: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (err instanceof ApiError) {
    const d = err.detail as any;
    if (typeof d === "string") return d;
    if (d && Array.isArray(d.errores)) return d.errores.join(" ");
    if (Array.isArray(d)) {
      // Errores de validación de Pydantic (422)
      return d.map((e: any) => e?.msg).filter(Boolean).join(" · ") || fallback;
    }
    if (d && typeof d.mensaje === "string") return d.mensaje;
  }
  return fallback;
}
