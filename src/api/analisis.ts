import { api } from "./client";
import type {
  AnalisisGri,
  AsignarEstadoResponse,
  EstadoGriApi,
  PaginaHistorialGri,
  ValidarAnalisisResponse,
} from "../types";

function base(empresaId: string, anio: number) {
  return `/analisis-gri/empresas/${encodeURIComponent(empresaId)}/anios/${anio}`;
}

/** Filas GRI con evidencia, sanciones, puntaje ESG, pendientes y estado de la validación. */
export function consultarAnalisis(empresaId: string, anio: number, opts: { silencioso?: boolean } = {}) {
  return api<AnalisisGri>(base(empresaId, anio), { silencioso: opts.silencioso });
}

/**
 * Asigna el estado manual de una fila. `versionFilaEsperada` es la `version_fila` que se vio
 * (0 si no tenía estado); si cambió entretanto, el backend responde 409.
 */
export function asignarEstado(
  empresaId: string,
  anio: number,
  identidad: string,
  estado: EstadoGriApi,
  versionFilaEsperada: number,
) {
  const ruta = `${base(empresaId, anio)}/codigos/${encodeURIComponent(identidad)}/estado`;
  return api<AsignarEstadoResponse>(ruta, {
    method: "PUT",
    body: { estado, version_fila_esperada: versionFilaEsperada },
  });
}

export function consultarHistorial(
  empresaId: string,
  anio: number,
  filtros: { identidad?: string; pagina?: number; tamano?: number } = {},
) {
  const qs = new URLSearchParams();
  if (filtros.identidad) qs.set("identidad", filtros.identidad);
  qs.set("pagina", String(filtros.pagina ?? 1));
  qs.set("tamano", String(filtros.tamano ?? 20));
  return api<PaginaHistorialGri>(`${base(empresaId, anio)}/historial?${qs.toString()}`);
}

/** Confirmación explícita del análisis sobre la versión y documentos consultados. */
export function validarAnalisis(empresaId: string, anio: number, version: number, huellaDocumentos: string) {
  return api<ValidarAnalisisResponse>(`${base(empresaId, anio)}/validacion`, {
    method: "POST",
    body: { version, huella_documentos: huellaDocumentos },
  });
}
