import type {
  AnioDisponible,
  DisponibilidadTipo,
  EstadoEspacio,
  EstadoAnioReporte,
  EstadoFlujo,
  EstadoGriApi,
  EstadoProgreso,
  MontoVista,
  MotivoNoVigente,
  MotivoSinEvidencia,
  PuntajeEsg,
  ResultadoAnalisis,
  ResumenConfirmacion,
  SectorApi,
  TipoDocumentoApi,
  TipoEventoAuditoria,
} from "../types";

// ---- Sector ----
/** «Otros» va al final: es para las empresas que no caen en los sectores anteriores. */
export const SECTORES_API: SectorApi[] = ["MINERIA", "PETROLEO", "ENERGIA", "OTROS"];
export const SECTOR_LABEL: Record<SectorApi, string> = {
  MINERIA: "Minería",
  PETROLEO: "Petróleo y Gas",
  ENERGIA: "Energía",
  OTROS: "Otros",
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

// ---- Un documento de cada tipo por empresa y año ----
const MOTIVO_ESPACIO: Record<EstadoEspacio, string | null> = {
  DISPONIBLE: null,
  OCUPADO: "ya cargado",
  EN_PROCESO: "en proceso",
  PUBLICACION_PENDIENTE: "en proceso",
  LIMPIEZA_PENDIENTE: "no disponible por ahora",
};

/** Tipos que ya no se pueden cargar para la empresa y el año, con el motivo que acompaña a la opción. */
export function tiposNoCargables(tipos: DisponibilidadTipo[] | null | undefined): Partial<Record<TipoDocumentoApi, string>> {
  const r: Partial<Record<TipoDocumentoApi, string>> = {};
  for (const t of tipos ?? []) {
    if (!t.cargable) r[t.tipo] = MOTIVO_ESPACIO[t.estado] ?? "no disponible";
  }
  return r;
}

// ---- Estado de progreso del documento (RF-024) ----
export const ESTADO_PROGRESO_LABEL: Record<EstadoProgreso, string> = {
  EN_PROCESO: "En proceso",
  CONFIRMACION_PENDIENTE: "Confirmación pendiente",
  PUBLICACION_PENDIENTE: "Publicación pendiente",
  COMPLETADO: "Completado",
  FALLIDO: "Fallido",
  FALLIDO_LIMPIEZA_PENDIENTE: "Fallido (limpieza pendiente)",
};

export function etiquetaEstado(e: EstadoProgreso): string {
  return ESTADO_PROGRESO_LABEL[e] ?? e;
}

const ESTADO_SOLO_OPERACION: Record<string, string> = {
  CREADA: "Creada",
  VALIDANDO: "Validando",
  INTERRUMPIDA: "Interrumpida",
  RECHAZADA: "Rechazada",
};

/** Estado de una operación de carga, que además de los del documento tiene los suyos propios. */
export function etiquetaEstadoOperacion(e: string): string {
  return ESTADO_SOLO_OPERACION[e] ?? etiquetaEstado(e as EstadoProgreso);
}

// En la lista de documentos el estado se resume en tres: el detalle conserva el estado exacto.
export type EstadoBadge = "completado" | "en_proceso" | "fallido";

const ETIQUETA_BADGE: Record<EstadoBadge, string> = {
  completado: "Completado",
  en_proceso: "En proceso",
  fallido: "Fallido",
};

export function badgeDeEstado(estado: string): EstadoBadge {
  switch (estado) {
    case "COMPLETADO":
      return "completado";
    case "FALLIDO":
    case "FALLIDO_LIMPIEZA_PENDIENTE":
      return "fallido";
    default:
      // EN_PROCESO, CONFIRMACION_PENDIENTE, PUBLICACION_PENDIENTE y cualquier estado nuevo: sigue su curso.
      return "en_proceso";
  }
}

export function etiquetaEstadoResumida(estado: string): string {
  return ETIQUETA_BADGE[badgeDeEstado(estado)];
}

/** Filtro de estado de la lista: «Todos» más tres opciones, cada una con los estados del backend que reúne. */
export type FiltroEstado = "" | "completados" | "en_curso" | "fallidos";

export const FILTROS_ESTADO: { valor: Exclude<FiltroEstado, "">; etiqueta: string; estados: EstadoProgreso[] }[] = [
  { valor: "completados", etiqueta: "Completados", estados: ["COMPLETADO"] },
  { valor: "en_curso", etiqueta: "En curso", estados: ["EN_PROCESO", "CONFIRMACION_PENDIENTE", "PUBLICACION_PENDIENTE"] },
  { valor: "fallidos", etiqueta: "Fallidos", estados: ["FALLIDO", "FALLIDO_LIMPIEZA_PENDIENTE"] },
];

/** Estados del backend que pide un filtro; vacío para «Todos». */
export function estadosDeFiltro(filtro: FiltroEstado): EstadoProgreso[] {
  return FILTROS_ESTADO.find((f) => f.valor === filtro)?.estados ?? [];
}

// ---- Doble check de la ingesta: la carga se pausa tras el análisis hasta que alguien decide ----
export const MINUTOS_VIGENCIA_CONFIRMACION = 30;

/** La operación espera que alguien decida continuar o cancelar la ingesta. */
export function necesitaDecision(op: { confirmacion_pendiente?: boolean; estado?: string } | null | undefined): boolean {
  return !!op && (op.confirmacion_pendiente === true || op.estado === "CONFIRMACION_PENDIENTE");
}

/** Cómo terminó una carga que no siguió: cancelada por una persona o vencida sin decisión. */
export function cierreDeCarga(op: { error?: { code?: string | null } | null }): "cancelada" | "vencida" | null {
  if (op.error?.code === "CONFIRMACION_RECHAZADA") return "cancelada";
  if (op.error?.code === "CONFIRMACION_VENCIDA") return "vencida";
  return null;
}

export function etiquetaHallazgos(r: ResultadoAnalisis): string {
  return r === "OBSERVADO" ? "Sin hallazgos" : "Con hallazgos";
}

/** Frase para decidir, armada con los contadores (sin repetir la pregunta que ya hacen los botones). */
export function textoResumenConfirmacion(r: ResumenConfirmacion | null | undefined): string {
  if (!r) return "El análisis terminó. Revisa el resultado y decide si continuar con la ingesta.";
  if (r.resultado === "OBSERVADO") {
    return "El documento no tiene referencias GRI del catálogo ni sanciones económicas. Si continúas, quedará cargado sin hallazgos.";
  }
  return `Se detectaron ${plural(r.referencias_gri, "grupo GRI", "grupos GRI")} y ${plural(r.sanciones, "mención de sanciones", "menciones de sanciones")}.`;
}

const MOTIVO_LEGIBLE: Record<string, string> = {
  referencias_gri_catalogadas: "Tiene referencias GRI del catálogo.",
  sanciones_economicas: "Menciona sanciones económicas.",
  sin_referencias_gri_catalogadas_ni_sanciones_economicas: "No tiene referencias GRI del catálogo ni sanciones económicas.",
};

/** Motivo del análisis en palabras: los conocidos con su frase; el resto, sin guiones bajos. */
export function motivoLegible(codigo: string): string {
  if (MOTIVO_LEGIBLE[codigo]) return MOTIVO_LEGIBLE[codigo];
  const texto = codigo.replace(/_/g, " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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

/** «217 fragmentos» al completarse; solo si quedó a medias se muestra cuántos se procesaron de cuántos. */
export function textoFragmentos(procesados: number | null | undefined, total: number): string {
  if (typeof procesados !== "number" || procesados === total) return plural(total, "fragmento", "fragmentos");
  return `${procesados} de ${plural(total, "fragmento", "fragmentos")}`;
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
      .replace(/!?\[([^[\]]*)\]\([^()]*\)/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=$|[\s.,;:!?)])/g, "$1$2")
      // Títulos que quedaron en medio del texto, filas separadoras de tablas («|---|---|») y
      // separadores como «---» o «--_--».
      .replace(/(^|\s)#{1,6}(?=\s)/g, "$1")
      .replace(/(?:\|\s*:?-{3,}:?\s*)+\|/g, " ")
      .replace(/(^|\s)[-_*~=]{3,}(?=\s|$)/g, "$1"),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Tabla de Markdown encontrada en un fragmento: texto previo, encabezados y filas, ya legibles. */
export interface TablaTexto {
  antes: string;
  encabezados: string[];
  filas: string[][];
}

// Fila separadora de una tabla de Markdown: «|---|:---:|---|».
const SEPARADOR_TABLA = /\|(?:\s*:?-{3,}:?\s*\|){2,}/;

/**
 * Si el fragmento es una tabla de Markdown, la devuelve como datos para mostrarla como tabla. Sirve
 * aunque las filas vengan en una sola línea (separadas por «| |»). Si algo no encaja, devuelve null y
 * el fragmento se muestra como texto.
 */
export function tablaMarkdown(texto: string | null | undefined): TablaTexto | null {
  if (!texto) return null;
  const separador = SEPARADOR_TABLA.exec(texto);
  if (!separador) return null;
  const cabecera = texto.slice(0, separador.index);
  const inicio = cabecera.indexOf("|");
  if (inicio < 0) return null;
  const encabezados = cabecera.slice(inicio).trim().replace(/^\||\|$/g, "").split("|").map(textoLegible);
  const columnas = encabezados.length;
  if (columnas < 2 || separador[0].split("|").length - 2 !== columnas) return null;

  // Celdas del cuerpo: cada fila tiene `columnas` celdas y entre filas queda un hueco vacío («| |»).
  const cuerpo = texto.slice(separador.index + separador[0].length).trim();
  if (!cuerpo.startsWith("|") || !cuerpo.endsWith("|")) return null;
  const celdas = cuerpo.slice(1, -1).split("|");
  const filas: string[][] = [];
  for (let i = 0; i < celdas.length; i += columnas + 1) {
    const fila = celdas.slice(i, i + columnas);
    const hueco = celdas[i + columnas];
    if (fila.length !== columnas || (hueco !== undefined && hueco.trim() !== "")) return null;
    filas.push(fila.map(textoLegible));
  }
  if (filas.length === 0) return null;
  return { antes: textoLegible(texto.slice(0, inicio)), encabezados, filas };
}

/** Texto para comparar sin distinguir mayúsculas ni tildes. */
function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Documentos del sector elegido cuya empresa contiene el texto buscado (basta una parte del nombre). */
export function filtrarDocumentos<T extends { sector: string; empresa_nombre: string; deshabilitado?: boolean }>(
  documentos: T[],
  filtros: { sector?: string; busqueda?: string; habilitacion?: FiltroHabilitacion },
): T[] {
  const buscado = normalizarTexto(filtros.busqueda ?? "");
  return documentos.filter(
    (d) =>
      (!filtros.sector || d.sector === filtros.sector) &&
      normalizarTexto(d.empresa_nombre).includes(buscado) &&
      coincideHabilitacion(d, filtros.habilitacion ?? ""),
  );
}

// ---- Deshabilitar documentos ----
/** Filtro de la lista: todos, solo los que se usan (habilitados) o solo los retirados. */
export type FiltroHabilitacion = "" | "habilitados" | "deshabilitados";

function coincideHabilitacion(d: { deshabilitado?: boolean }, filtro: FiltroHabilitacion): boolean {
  if (filtro === "habilitados") return !d.deshabilitado;
  if (filtro === "deshabilitados") return !!d.deshabilitado;
  return true;
}

/** Solo un documento completado y aún habilitado se puede deshabilitar. */
export function puedeDeshabilitar(d: { estado: string; deshabilitado?: boolean }): boolean {
  return d.estado === "COMPLETADO" && !d.deshabilitado;
}

/** Palabra que hay que escribir para confirmar, como al borrar un repositorio. */
export const PALABRA_DESHABILITAR = "deshabilitar";

/** El backend exige un motivo; la pantalla solo pide confirmar, así que se envía este. */
export const MOTIVO_DESHABILITAR = "Deshabilitado por el SuperAdmin desde Ingesta de documentos.";

export function confirmacionDeshabilitarValida(palabra: string): boolean {
  return palabra.trim() === PALABRA_DESHABILITAR;
}

/**
 * Pone primero los elementos recién creados (en el orden dado: el más reciente primero) y deja el
 * resto en su orden original. Así lo que se acaba de registrar se ve arriba sin buscarlo.
 */
export function conRecientesPrimero<T extends { id: string }>(items: T[], recientes: string[]): T[] {
  const posicion = new Map(recientes.map((id, i) => [id, i]));
  const nuevos = items.filter((x) => posicion.has(x.id)).sort((a, b) => posicion.get(a.id)! - posicion.get(b.id)!);
  return [...nuevos, ...items.filter((x) => !posicion.has(x.id))];
}

/** Elementos cuyo nombre contiene el texto buscado (basta una parte, sin distinguir mayúsculas ni tildes). */
export function filtrarPorNombre<T extends { nombre: string }>(items: T[], busqueda: string): T[] {
  const buscado = normalizarTexto(busqueda);
  if (!buscado) return items;
  return items.filter((i) => normalizarTexto(i.nombre).includes(buscado));
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
/** Nombre de archivo legible y seguro: «reporte-prospeccion-minera-andina-saa-2024-v2.pdf». */
export function nombreArchivoReporte(empresa: string, anio: number, version?: number | null): string {
  const slug = empresa
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-)|(-$)/g, "");
  const sufijo = version ? `-v${version}` : "";
  return `reporte-prospeccion-${slug || "empresa"}-${anio}${sufijo}.pdf`;
}

export type TonoEstadoReporte = "ok" | "pendiente" | "neutro";

/** Qué significa cada estado de un año. El estado lo decide el servidor; aquí solo se explica. */
const INFO_ESTADO_REPORTE: Record<EstadoAnioReporte, { etiqueta: string; mensaje: string; tono: TonoEstadoReporte; irAAnalisis?: boolean }> = {
  PENDIENTE_REVISION: { etiqueta: "Pendiente de revisión", mensaje: "Asigna los estados GRI pendientes antes de emitir el reporte.", tono: "pendiente", irAAnalisis: true },
  PENDIENTE_VALIDACION: { etiqueta: "Sin validar", mensaje: "Valida el análisis GRI antes de emitir el reporte.", tono: "pendiente", irAAnalisis: true },
  VALIDACION_VIGENTE: { etiqueta: "Validado", mensaje: "La validación está lista: ya puedes ver la vista previa y generar el reporte.", tono: "ok" },
  ACTUALIZACION_PENDIENTE: { etiqueta: "Validación nueva sin reporte", mensaje: "Hay una validación nueva sin reporte: ya puedes generar una nueva versión.", tono: "pendiente" },
  REPORTE_GENERADO: { etiqueta: "Reporte actualizado", mensaje: "El reporte está actualizado: no hay una versión nueva que emitir.", tono: "ok" },
  SIN_CODIGOS_GRI: { etiqueta: "Sin códigos GRI", mensaje: "Los documentos de este año no tienen códigos GRI evaluables.", tono: "neutro" },
  SIN_DOCUMENTACION_ELEGIBLE: { etiqueta: "Sin documentos", mensaje: "Este año no tiene documentación elegible para el reporte.", tono: "neutro" },
};

/** Texto de un año en la lista de Reportes. */
export function etiquetaAnioReporte(a: AnioDisponible): string {
  const info = INFO_ESTADO_REPORTE[a.estado];
  return info ? `${a.anio} · ${info.etiqueta}` : String(a.anio);
}

/** Mensaje de la situación de un año y si conviene llevar a Análisis GRI para resolverla. */
export function situacionAnioReporte(a: AnioDisponible): { mensaje: string; tono: TonoEstadoReporte; irAAnalisis: boolean } {
  const info = INFO_ESTADO_REPORTE[a.estado];
  if (!info) return { mensaje: "No se pudo determinar la situación de este año.", tono: "neutro", irAAnalisis: false };
  const mensaje =
    a.estado === "PENDIENTE_VALIDACION" && a.validacion_anterior_no_vigente
      ? "El análisis cambió después de la última validación: revísalo y valídalo de nuevo."
      : info.mensaje;
  return { mensaje, tono: info.tono, irAAnalisis: !!info.irAAnalisis };
}

/** Etapas del recorrido de un reporte, en orden. */
export const ETAPAS_REPORTE = ["Revisión", "Validación", "Emisión", "Al día"] as const;

// Cuántas etapas quedan cumplidas en cada estado. Los estados sin recorrido (sin códigos GRI o sin
// documentación) no tienen tira: lo explica el aviso de la pantalla.
const ETAPAS_CUMPLIDAS: Partial<Record<EstadoAnioReporte, number>> = {
  PENDIENTE_REVISION: 0,
  PENDIENTE_VALIDACION: 1,
  VALIDACION_VIGENTE: 2,
  ACTUALIZACION_PENDIENTE: 2,
  REPORTE_GENERADO: 4,
};

/**
 * Dónde está un año en el recorrido del reporte, según el estado que entrega el servidor.
 * `actual` es la etapa en curso (null si ya está todo al día); `nuevaVersion` indica que la emisión
 * pendiente es una versión nueva de un reporte que ya existe.
 */
export function etapaReporte(a?: AnioDisponible): { cumplidas: number; actual: number | null; nuevaVersion: boolean } | null {
  const cumplidas = a ? ETAPAS_CUMPLIDAS[a.estado] : undefined;
  if (cumplidas === undefined || !a) return null;
  return {
    cumplidas,
    actual: cumplidas < ETAPAS_REPORTE.length ? cumplidas : null,
    nuevaVersion: a.estado === "ACTUALIZACION_PENDIENTE",
  };
}

// En estos estados hay una validación vigente, requisito de la vista previa.
const ESTADOS_CON_VALIDACION: ReadonlySet<EstadoAnioReporte> = new Set<EstadoAnioReporte>(["VALIDACION_VIGENTE", "ACTUALIZACION_PENDIENTE", "REPORTE_GENERADO"]);

/** Qué ofrece la pantalla para un año. Sale siempre de lo que responde el servidor, sin deducirlo. */
export function accionesReporte(a?: AnioDisponible) {
  return {
    vistaPrevia: !!a && ESTADOS_CON_VALIDACION.has(a.estado),
    generar: !!a?.puede_generar,
    etiquetaGenerar: a?.reporte_id ? "Generar nueva versión" : "Generar reporte",
    descargarActualizado: a?.reporte_actualizado === true,
    descargarHistorica: !!a?.reporte_id && a.reporte_actualizado !== true,
    verHistorial: !!a?.reporte_id,
  };
}

/** Cómo presentar la última emisión: «última» y «actualizada» son cosas distintas. */
export function situacionEmision(a: AnioDisponible): string {
  if (a.reporte_actualizado === true) return "Actualizado";
  return a.origen_verificable === false ? "Origen no verificable" : "No actualizado";
}

/** Aviso tras emitir: distingue una versión nueva de la que esa validación ya tenía. */
export function mensajeEmision(e: { version: number; reutilizado: boolean; empresa_nombre: string; anio: number }): string {
  const destino = `${e.empresa_nombre} (${e.anio})`;
  return e.reutilizado
    ? `Esta validación ya tenía un reporte: versión ${e.version} de ${destino}.`
    : `Versión ${e.version} de ${destino} emitida correctamente.`;
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

/** Página válida a partir de lo que escribió el usuario (null si no es un número). */
export function paginaValida(texto: string, total: number): number | null {
  const n = Number.parseInt(texto, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(Math.max(1, n), total);
}
