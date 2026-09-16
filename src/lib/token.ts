import type { SesionActual, Rol } from "../types";

const KEY = "igualab.sesion";

export function guardarSesion(s: SesionActual) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export function leerSesion(): SesionActual | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SesionActual;
    if (!s.token) return null;
    return s;
  } catch {
    return null;
  }
}

export function limpiarSesion() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function getToken(): string | null {
  return leerSesion()?.token ?? null;
}

export function getRol(): Rol | null {
  return leerSesion()?.rol ?? null;
}
