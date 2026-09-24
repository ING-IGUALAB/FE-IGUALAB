import { api } from "./client";
import type { Usuario } from "../types";

export function listarUsuarios() {
  return api<Usuario[]>("/usuarios");
}

export function crearUsuario(payload: { nombre: string; correo: string; password: string }) {
  return api<Usuario>("/usuarios", { method: "POST", body: payload });
}

export function habilitarUsuario(id: string) {
  return api<Usuario>(`/usuarios/${id}/habilitar`, { method: "PATCH" });
}

export function deshabilitarUsuario(id: string) {
  return api<Usuario>(`/usuarios/${id}/deshabilitar`, { method: "PATCH" });
}

export function transferirSuperadmin(cuenta_destino_id: string) {
  return api<null>("/usuarios/transferir-superadmin", {
    method: "POST",
    body: { cuenta_destino_id },
  });
}
