import { api } from "./client";
import type { LoginResponse } from "../types";

export function login(correo: string, password: string) {
  return api<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { correo, password },
  });
}

export function logout() {
  return api<null>("/auth/logout", { method: "POST" });
}

export function recuperarContrasena(correo: string) {
  return api<{ mensaje: string }>("/auth/recuperar-contrasena", {
    method: "POST",
    auth: false,
    body: { correo },
  });
}

export function restablecerContrasena(
  token: string,
  password_nueva: string,
  password_nueva_confirmacion: string
) {
  return api<{ mensaje: string }>("/auth/restablecer-contrasena", {
    method: "POST",
    auth: false,
    body: { token, password_nueva, password_nueva_confirmacion },
  });
}

export function cambiarMiContrasena(password_actual: string, password_nueva: string) {
  return api<{ mensaje: string }>("/auth/mi-contrasena", {
    method: "PATCH",
    body: { password_actual, password_nueva },
  });
}
