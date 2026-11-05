import type {
  EstadoFlujo,
  EstadoGriApi,
  EstadoProgreso,
  MontoVista,
  MotivoNoVigente,
  MotivoSinEvidencia,
  PuntajeEsg,
  ResultadoAnalisis,
  SectorApi,
  TipoDocumentoApi,
  TipoEventoAuditoria,
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

/** Paginación en el cliente (para filtros que el backend no soporta, p. ej. sector). */
// ---- Texto de los documentos ----
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entidad, cuerpo: string) => {
    const minus = cuerpo.toLowerCase();
    if (minus.startsWith("#x")) return String.fromCodePoint(Number.parseInt(minus.slice(2), 16));
    if (minus.startsWith("#")) return String.fromCodePoint(Number.parseInt(minus.slice(1), 10));
    return ENTIDADES[minus] ?? entidad;
  });
}

/**
 * Texto legible de un fragmento de documento: los documentos son Markdown y pueden traer HTML, y el
 * backend devuelve el fragmento tal cual (es la evidencia exacta). Aquí solo se quitan las marcas para
 * mostrarlo; el resultado se muestra siempre como texto, nunca se interpreta como HTML.
 */
export function textoLegible(texto: string | null | undefined): string {
  if (!texto) return "";
  const lineas = texto
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .split("\n")
    // Marcas de inicio de línea: títulos, citas y viñetas.
    .map((linea) => linea.replace(/^\s*(#{1,6}|>|[-*+])\s+/, ""));
  return decodificarEntidades(
    lineas
      .join("\n")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=$|[\s.,;:!?)])/g, "$1$2")
      // Títulos que quedaron en medio del texto y separadores como «---» o «--_--».
      .replace(/(^|\s)#{1,6}(?=\s)/g, "$1")
      .replace(/(^|\s)[-_*~=]{3,}(?=\s|$)/g, "$1"),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto para comparar sin distinguir mayúsculas ni tildes. */
function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Documentos del sector elegido cuya empresa contiene el texto buscado (basta una parte del nombre). */
export function filtrarDocumentos<T extends { sector: string; empresa_nombre: string }>(
  documentos: T[],
  filtros: { sector?: string; busqueda?: string },
): T[] {
  const buscado = normalizarTexto(filtros.busqueda ?? "");
  return documentos.filter(
    (d) => (!filtros.sector || d.sector === filtros.sector) && normalizarTexto(d.empresa_nombre).includes(buscado),
  );
}

export function paginarLocal<T>(items: T[], pagina: number, tamano: number): { items: T[]; pagina: number; paginas: number } {
  const paginas = Math.max(1, Math.ceil(items.length / tamano));
  const actual = Math.min(Math.max(1, pagina), paginas);
  return { items: items.slice((actual - 1) * tamano, actual * tamano), pagina: actual, paginas };
}

// ---- Sanciones ----
/** Monto con su moneda: si la moneda no está en el texto (p. ej. vino del encabezado de una tabla), se antepone. */
export function textoMonto(m: MontoVista): string {
  const unidad = m.unidad?.trim();
  if (!unidad || m.texto.includes(unidad)) return m.texto;
  return `${unidad} ${m.texto}`;
}

// ---- Reportes ----
/** Nombre de archivo legible y seguro: «reporte-prospeccion-minera-andina-saa-2024.pdf». */
export function nombreArchivoReporte(empresa: string, anio: number): string {
  const slug = empresa
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-)|(-$)/g, "");
  return `reporte-prospeccion-${slug || "empresa"}-${anio}.pdf`;
}

/** Primeros caracteres de una huella SHA-256, para mostrarla sin ocupar toda la tabla. */
export function huellaCorta(sha256: string, largo = 12): string {
  return sha256.length > largo ? `${sha256.slice(0, largo)}…` : sha256;
}

// ---- Auditoría ----
export const TIPOS_EVENTO_AUDITORIA: TipoEventoAuditoria[] = [
  "Inicio de sesión",
  "Cambio de rol",
  "Ingesta de datos",
  "Rechazo de documento",
  "Generación de reporte",
  "Descarga",
];

/** Inicio del día local (AAAA-MM-DD) expresado en UTC ISO, para filtrar «desde». */
export function inicioDiaUtc(fecha: string): string | undefined {
  return fecha ? new Date(`${fecha}T00:00:00`).toISOString() : undefined;
}

/** Fin del día local (AAAA-MM-DD) expresado en UTC ISO, para filtrar «hasta» (incluye todo el día). */
export function finDiaUtc(fecha: string): string | undefined {
  return fecha ? new Date(`${fecha}T23:59:59.999`).toISOString() : undefined;
}

export function totalPaginas(total: number, tamano: number): number {
  return Math.max(1, Math.ceil(total / tamano));
}

/** CSV separado por «;» con comillas y BOM, para que Excel respete tildes y columnas. */
export function aCsv(filas: string[][]): string {
  const cuerpo = filas.map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
  return `\uFEFF${cuerpo}`;
}

// ---- Asistente de IA ----
const MOTIVO_SIN_EVIDENCIA: Record<MotivoSinEvidencia, string> = {
  SIN_FRAGMENTOS: "No hay documentos analizados de esta empresa y año para responder.",
  MODELO_SIN_EVIDENCIA: "Los documentos cargados no contienen información para responder esta pregunta.",
  AFIRMACIONES_NO_VERIFICABLES: "La respuesta no pudo respaldarse con citas literales de los documentos.",
  RESPUESTA_NO_INTERPRETABLE: "No se pudo interpretar la respuesta del asistente. Intenta reformular la pregunta.",
  FUERA_DE_DOMINIO: "Solo respondo sobre sostenibilidad, indicadores GRI y sanciones de las empresas.",
};

/** Explicación legible de por qué el asistente no pudo responder (si el backend no envía `mensaje`). */
export function textoSinEvidencia(motivo?: MotivoSinEvidencia | null): string {
  return (motivo && MOTIVO_SIN_EVIDENCIA[motivo]) || "Los documentos cargados no contienen evidencia suficiente para responder.";
}

/** «Se omitió 1 afirmación…» / «Se omitieron 3 afirmaciones…» (concordancia en singular y plural). */
export function textoDescartadas(n: number): string {
  if (n === 1) return "Se omitió 1 afirmación que no pudo respaldarse con los documentos.";
  return `Se omitieron ${n} afirmaciones que no pudieron respaldarse con los documentos.`;
}

// ---- Años con datos ----
/** Primer año con documentos en la plataforma. Para habilitar años anteriores, cambiar solo esta constante. */
export const ANIO_MIN_DATOS = 2020;

/**
 * Años que se pueden elegir, del más reciente al más antiguo: desde ANIO_MIN_DATOS hasta el año en
 * curso. Se actualiza solo cada año.
 */
export function aniosDisponibles(hoy: Date = new Date()): number[] {
  const ultimo = Math.max(ANIO_MIN_DATOS, hoy.getFullYear());
  return Array.from({ length: ultimo - ANIO_MIN_DATOS + 1 }, (_, i) => ultimo - i);
}

/** Texto de la lista de años cuando todavía no hay años que ofrecer (según los documentos subidos). */
export function textoSinAnios(hayEmpresa: boolean, cargando: boolean): string {
  if (!hayEmpresa) return "—";
  if (cargando) return "Buscando…";
  return "Sin documentos";
}

// ---- Personas ----
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nombre legible de quien hizo algo. El backend suele mandar el ID (UUID) del usuario: se busca su
 * nombre; si el valor ya es un nombre, se muestra tal cual; si es un ID desconocido, no se muestra el ID.
 */
export function nombrePersona(valor: string | null | undefined, nombres: Map<string, string>): string {
  if (!valor) return "—";
  const nombre = nombres.get(valor);
  if (nombre) return nombre;
  return UUID.test(valor) ? "Usuario no identificado" : valor;
}

/**
 * De los años candidatos, deja los que tienen documentos analizados, según el resultado de consultar
 * el análisis de cada año (en el mismo orden). Un año cuya consulta falló no se ofrece.
 */
export function aniosConDocumentos(
  candidatos: number[],
  resultados: PromiseSettledResult<{ documentos: unknown[] }>[],
): number[] {
  return candidatos.filter((_, i) => {
    const r = resultados[i];
    return r?.status === "fulfilled" && r.value.documentos.length > 0;
  });
}

/** Estado del análisis GRI de un año: si ya permite la vista previa y generar el reporte. */
export interface EstadoAnio {
  habilitaReporte: boolean;
  estadoFlujo: EstadoFlujo;
}

/** Estado del análisis de cada año con documentos, a partir de las consultas hechas por año. */
export function estadosPorAnio(
  candidatos: number[],
  resultados: PromiseSettledResult<{ documentos: unknown[]; habilita_reporte: boolean; estado_flujo: EstadoFlujo }>[],
): Record<number, EstadoAnio> {
  const estados: Record<number, EstadoAnio> = {};
  candidatos.forEach((anio, i) => {
    const r = resultados[i];
    if (r?.status === "fulfilled" && r.value.documentos.length > 0) {
      estados[anio] = { habilitaReporte: r.value.habilita_reporte, estadoFlujo: r.value.estado_flujo };
    }
  });
  return estados;
}

/** Texto de un año en la lista de Reportes: si ya tiene reporte o si su análisis está validado. */
export function etiquetaAnioReporte(anio: number, estado?: EstadoAnio, generado = false): string {
  if (generado) return `${anio} · Reporte generado`;
  if (!estado) return String(anio);
  return `${anio} · ${estado.habilitaReporte ? "Validado" : "Sin validar"}`;
}

// ---- Paginación ----
export type ItemPaginacion = number | "…";

/**
 * Números de página a mostrar: siempre la primera y la última, la actual con sus vecinas, y «…»
 * donde se saltan páginas. Ej.: actual 11 de 13 → [1, "…", 10, 11, 12, 13].
 */
export function rangoPaginas(actual: number, total: number, vecinas = 1): ItemPaginacion[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const desde = Math.max(2, actual - vecinas);
  const hasta = Math.min(total - 1, actual + vecinas);
  const items: ItemPaginacion[] = [1];
  if (desde > 2) items.push("…");
  for (let p = desde; p <= hasta; p += 1) items.push(p);
  if (hasta < total - 1) items.push("…");
  items.push(total);
  return items;
}

/**
 * Bloques de la paginación con salto: un grupo de 3 páginas que sigue a la actual, el campo «Ir a»
 * en medio y las 3 últimas fijas. Con 7 páginas o menos se muestran todas y no hace falta el campo.
 * Ej.: actual 1 de 16 → inicio [1, 2, 3], fin [14, 15, 16]; actual 7 → inicio [6, 7, 8].
 */
export function bloquesPaginacion(actual: number, total: number): { inicio: number[]; fin: number[] } {
  if (total <= 7) return { inicio: Array.from({ length: total }, (_, i) => i + 1), fin: [] };
  const fin = [total - 2, total - 1, total];
  if (actual >= total - 2) return { inicio: [1, 2, 3], fin };
  const desde = Math.min(Math.max(1, actual - 1), total - 5);
  return { inicio: [desde, desde + 1, desde + 2], fin };
}

/** Reporte ya generado de una empresa y año (los reportes son únicos e inmutables), si existe. */
export function reporteDe<T extends { empresa_id: string; anio: number }>(reportes: T[], empresaId: string, anio: number): T | undefined {
  return reportes.find((r) => r.empresa_id === empresaId && r.anio === anio);
}

/** Página válida a partir de lo que escribió el usuario (null si no es un número). */
export function paginaValida(texto: string, total: number): number | null {
  const n = Number.parseInt(texto, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(Math.max(1, n), total);
}
