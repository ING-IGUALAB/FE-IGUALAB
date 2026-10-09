import { api } from "./client";
import type { EmpresaApi, SectorApi } from "../types";

export function listarEmpresas(filtros: { soloActivas?: boolean; sector?: SectorApi } = {}) {
  const qs = new URLSearchParams();
  if (filtros.soloActivas) qs.set("solo_activas", "true");
  if (filtros.sector) qs.set("sector", filtros.sector);
  const query = qs.toString();
  const sufijo = query ? `?${query}` : "";
  return api<EmpresaApi[]>(`/empresas${sufijo}`);
}

export function crearEmpresa(payload: { nombre: string; sector: SectorApi }) {
  return api<EmpresaApi>("/empresas", { method: "POST", body: payload });
}

export function obtenerEmpresa(id: string) {
  return api<EmpresaApi>(`/empresas/${id}`);
}

export function editarEmpresa(id: string, payload: { nombre?: string; sector?: SectorApi }) {
  return api<EmpresaApi>(`/empresas/${id}`, { method: "PATCH", body: payload });
}

export function activarEmpresa(id: string) {
  return api<EmpresaApi>(`/empresas/${id}/activar`, { method: "PATCH" });
}

export function desactivarEmpresa(id: string) {
  return api<EmpresaApi>(`/empresas/${id}/desactivar`, { method: "PATCH" });
}
