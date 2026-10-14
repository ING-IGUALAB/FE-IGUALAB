import type {
  EstadoFlujo,
  EstadoGriApi,
  EstadoProgreso,
  MotivoNoVigente,
  PuntajeEsg,
  ResultadoAnalisis,
  SectorApi,
  TipoDocumentoApi,
} from "../types";

// ---- Sector ----
export const SECTORES_API: SectorApi[] = ["MINERIA", "PETROLEO", "ENERGIA"];
export const SECTOR_LABEL: Record<SectorApi, string> = {
  MINERIA: "Minería",
  PETROLEO: "Petróleo y Gas",
  ENERGIA: "Energía",
};

export function etiquetaSector(s: SectorApi): string {
  return SECTOR_LABEL[s] ?? s;
}

// ---- Tipo de documento ----
export const TIPOS_API: TipoDocumentoApi[] = ["MEMORIA_ANUAL", "REPORTE_SOSTENIBILIDAD_GRI"];
export const TIPO_LABEL: Record<TipoDocumentoApi, string> = {
  MEMORIA_ANUAL: "Memoria Anual",
  REPORTE_SOSTENIBILIDAD_GRI: "Reporte de Sostenibilidad GRI",
};

export function etiquetaTipo(t: TipoDocumentoApi): string {
  return TIPO_LABEL[t] ?? t;
}

// ---- Estado de progreso del documento (RF-024) ----
export const ESTADO_PROGRESO_LABEL: Record<EstadoProgreso, string> = {
  EN_PROCESO: "En proceso",
  PUBLICACION_PENDIENTE: "Publicación pendiente",
  COMPLETADO: "Completado",
  FALLIDO: "Fallido",
  FALLIDO_LIMPIEZA_PENDIENTE: "Fallido (limpieza pendiente)",
};

export function etiquetaEstado(e: EstadoProgreso): string {
  return ESTADO_PROGRESO_LABEL[e] ?? e;
}

export function etiquetaAnalisis(r: ResultadoAnalisis | null | undefined): string {
  if (r === "CON_HALLAZGOS") return "Con hallazgos";
  if (r === "OBSERVADO") return "Observado";
  return "—";
}

// ---- Validación de archivo para ingesta ----
// RF-018: sólo Markdown (.md). RNF-014: hasta 50 MB. No se admite vacío.
export const MAX_BYTES_INGESTA = 50 * 1024 * 1024;

export function validarArchivoIngesta(f: { name: string; size: number }): { ok: boolean; motivo?: string } {
  if (!/\.md$/i.test(f.name)) return { ok: false, motivo: "El archivo debe tener extensión .md." };
  if (f.size === 0) return { ok: false, motivo: "El archivo está vacío." };
  if (f.size > MAX_BYTES_INGESTA) return { ok: false, motivo: "El archivo supera los 50 MB." };
  return { ok: true };
}

export function anioIngestaValido(anio: number): boolean {
  return Number.isInteger(anio) && anio >= 2000 && anio <= 9999;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Análisis y validación GRI ----
export const ESTADOS_GRI_API: EstadoGriApi[] = ["OK", "BAJA_SUSTANCIA", "SUB_REPORTADO"];
export const ESTADO_GRI_LABEL: Record<EstadoGriApi, string> = {
  OK: "OK",
  BAJA_SUSTANCIA: "Baja sustancia",
  SUB_REPORTADO: "Sub-reportado",
};

export function etiquetaEstadoGri(e: EstadoGriApi | null | undefined): string {
  if (!e) return "Sin estado";
  return ESTADO_GRI_LABEL[e] ?? e;
}

export const FLUJO_INFO: Record<EstadoFlujo, { etiqueta: string; descripcion: string }> = {
  DOCUMENTACION_INSUFICIENTE: {
    etiqueta: "Sin documentos analizados",
    descripcion: "No hay documentos completados y analizados de esta empresa para el año elegido.",
  },
  SIN_CODIGOS_GRI: {
    etiqueta: "Sin códigos GRI",
    descripcion: "Los documentos de este año no contienen códigos GRI evaluables.",
  },
  PENDIENTE_ESTADOS: {
    etiqueta: "Pendiente de estados",
    descripcion: "Asigna un estado a cada código GRI para poder validar el análisis.",
  },
  LISTO_PARA_VALIDAR: {
    etiqueta: "Listo para validar",
    descripcion: "Todos los códigos tienen estado. Ya puedes validar el análisis.",
  },
  VALIDADO: {
    etiqueta: "Validado",
    descripcion: "El análisis tiene una validación vigente.",
  },
};

export function etiquetaFlujo(e: EstadoFlujo): string {
  return FLUJO_INFO[e]?.etiqueta ?? e;
}

export function puedeValidar(estado: EstadoFlujo): boolean {
  return estado === "LISTO_PARA_VALIDAR";
}

/** Valor del puntaje ESG listo para mostrar ("—" si el backend no lo presenta). */
export function valorPuntaje(p: PuntajeEsg): string {
  if (p.valor_presentacion == null) return "—";
  return p.valor_presentacion.toFixed(p.decimales_presentacion);
}

/** "1 código GRI" / "3 códigos GRI". */
export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** Línea explicativa del puntaje: si es definitivo, preliminar o por qué no se presenta. */
export function detallePuntaje(p: PuntajeEsg): string {
  const codigos = plural(p.filas_contadas, "código GRI", "códigos GRI");
  if (p.estado === "VALIDADO") return `Definitivo · promedio de ${codigos}`;
  if (p.estado === "CALCULADO_SIN_VALIDAR") return `Preliminar · falta validar el análisis (${codigos})`;
  if (p.mensaje) return p.mensaje;
  if (p.estado === "PENDIENTE_ESTADOS") {
    const verbo = p.filas_sin_estado === 1 ? "Falta" : "Faltan";
    return `${verbo} ${plural(p.filas_sin_estado, "código GRI", "códigos GRI")} por asignar estado`;
  }
  return "Aún no disponible";
}

export const MOTIVO_NO_VIGENTE_LABEL: Record<MotivoNoVigente, string> = {
  ESTADOS_CAMBIARON: "cambiaron estados de códigos GRI",
  DOCUMENTOS_CAMBIARON: "cambiaron los documentos analizados",
};

export function textoMotivosNoVigente(motivos: MotivoNoVigente[]): string {
  return motivos.map((m) => MOTIVO_NO_VIGENTE_LABEL[m] ?? m).join(" y ");
}
