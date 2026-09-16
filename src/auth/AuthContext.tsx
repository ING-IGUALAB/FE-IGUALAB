import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Rol, SesionActual } from "../types";
import { guardarSesion, leerSesion, limpiarSesion } from "../lib/token";
import { AUTH_401_EVENT } from "../api/client";
import * as authApi from "../api/auth";

interface AuthCtx {
  sesion: SesionActual | null;
  autenticado: boolean;
  rol: Rol | null;
  iniciarSesion: (correo: string, password: string) => Promise<SesionActual>;
  cerrarSesion: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionActual | null>(() => leerSesion());

  useEffect(() => {
    function onExpira() {
      setSesion(null);
    }
    window.addEventListener(AUTH_401_EVENT, onExpira);
    return () => window.removeEventListener(AUTH_401_EVENT, onExpira);
  }, []);

  async function iniciarSesion(correo: string, password: string) {
    const r = await authApi.login(correo, password);
    const s: SesionActual = { token: r.access_token, rol: r.rol, nombre: r.nombre };
    guardarSesion(s);
    setSesion(s);
    return s;
  }

  async function cerrarSesion() {
    try {
      await authApi.logout();
    } catch {
      /* aunque falle, limpiamos localmente */
    }
    limpiarSesion();
    setSesion(null);
  }

  return (
    <Ctx.Provider
      value={{
        sesion,
        autenticado: !!sesion,
        rol: sesion?.rol ?? null,
        iniciarSesion,
        cerrarSesion,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
