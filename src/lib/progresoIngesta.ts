import type { Operacion } from "../types";
import { cierreDeCarga, necesitaDecision } from "./dominio";

/**
 * Los 9 pasos de la ingesta tal como los ve la persona. El paso 1 es la validación previa (sin
 * etapa en el backend); del 2 al 9 corresponden a las etapas reales que informa la operación. El
 * paso 6 es el doble check: ahí la carga se detiene hasta que alguien decide.
 */
export type EstadoPaso = "pendiente" | "activo" | "completado" | "pausado" | "fallido" | "cancelado";

export interface PasoIngesta {
  numero: number;
  titulo: string;
  detalle: string;
}

export const PASOS_INGESTA: PasoIngesta[] = [
  { numero: 1, titulo: "Validar", detalle: "Archivo y empresa" },
  { numero: 2, titulo: "Reservar", detalle: "Lugar del documento" },
  { numero: 3, titulo: "Guardar", detalle: "Archivo original" },
  { numero: 4, titulo: "Fragmentar", detalle: "Dividir el texto" },
  { numero: 5, titulo: "Analizar", detalle: "GRI y sanciones" },
  { numero: 6, titulo: "Confirmar", detalle: "Tu decisión" },
  { numero: 7, titulo: "Completar", detalle: "Registrar la carga" },
  { numero: 8, titulo: "Publicar", detalle: "Para el asistente" },
  { numero: 9, titulo: "Finalizar", detalle: "Cierre" },
];

export const PASO_CONFIRMAR = 6;
const TOTAL = PASOS_INGESTA.length;

/** Paso de cada etapa real del backend. */
const PASO_DE_ETAPA: Record<string, number> = {
  RESERVADO: 2,
  ALMACENANDO_ORIGINAL: 3,
  INDEXANDO: 4,
  ANALIZANDO: 5,
  CONFIRMANDO: 6,
  COMPLETANDO: 7,
  PUBLICANDO: 8,
  FINALIZADO: 9,
};

export interface ProgresoPasos {
  /** Paso en curso, en pausa o donde terminó la carga; null si no empezó o terminó bien. */
  actual: number | null;
  /** Cuántos pasos están completos (los primeros `completados`). */
  completados: number;
  /** Frase del momento, para el encabezado (se anuncia a lectores de pantalla). */
  titulo: string;
  /** Fragmentos del paso 4, solo cuando el backend ya conoce el total. */
  fragmentos: { procesados: number; total: number } | null;
  pasos: { paso: PasoIngesta; estado: EstadoPaso }[];
}

function construir(
  actual: number | null,
  completados: number,
  estadoActual: EstadoPaso,
  titulo: string,
  fragmentos: ProgresoPasos["fragmentos"] = null,
): ProgresoPasos {
  const pasos = PASOS_INGESTA.map((paso) => {
    let estado: EstadoPaso = "pendiente";
    if (paso.numero <= completados) estado = "completado";
    else if (paso.numero === actual) estado = estadoActual;
    return { paso, estado };
  });
  return { actual, completados, titulo, fragmentos, pasos };
}

function enCurso(paso: number, fragmentos: ProgresoPasos["fragmentos"]): ProgresoPasos {
  return construir(paso, paso - 1, "activo", `Paso ${paso} de ${TOTAL}: ${PASOS_INGESTA[paso - 1].titulo}`, fragmentos);
}

function detenidaEn(paso: number): ProgresoPasos {
  return construir(paso, paso - 1, "fallido", `La ingesta se detuvo en el paso ${paso}: ${PASOS_INGESTA[paso - 1].titulo}`);
}

function pasoDeEtapa(operacion: Operacion): number {
  return (operacion.etapa && PASO_DE_ETAPA[operacion.etapa]) || 1;
}

/** Estados en los que la carga ya no avanza sola: terminada, por publicar, rechazada o fallida. */
function segunEstado(operacion: Operacion): ProgresoPasos | null {
  switch (operacion.estado) {
    case "COMPLETADO":
      return construir(null, TOTAL, "completado", `Completada: ${TOTAL} de ${TOTAL} pasos`);
    case "PUBLICACION_PENDIENTE":
      // El documento ya está registrado; solo falta publicarlo y se puede reintentar.
      return construir(8, 7, "pausado", `Paso 8 de ${TOTAL}: falta publicar`);
    case "RECHAZADA":
    case "INTERRUMPIDA":
      return construir(1, 0, "fallido", "No se pudo iniciar la ingesta");
    case "FALLIDO":
    case "FALLIDO_LIMPIEZA_PENDIENTE":
      return detenidaEn(pasoDeEtapa(operacion));
    default:
      return null;
  }
}

/**
 * Cómo va la carga según la operación que informa el backend. `enviando` indica que la carga ya
 * se pidió aunque aún no haya datos de la operación; `fallo` que la petición terminó con error.
 * Nunca avanza por tiempo: solo por lo que dice el servidor.
 */
export function progresoDePasos(operacion: Operacion | null, enviando: boolean, fallo = false): ProgresoPasos {
  if (!operacion) {
    if (fallo) return construir(1, 0, "fallido", "No se pudo iniciar la ingesta");
    return enviando ? enCurso(1, null) : construir(null, 0, "pendiente", "Sin iniciar");
  }

  // Doble check: se detiene en el paso 6 hasta que alguien decide (la etapa sola no basta).
  if (necesitaDecision(operacion)) {
    return construir(PASO_CONFIRMAR, PASO_CONFIRMAR - 1, "pausado", `Paso ${PASO_CONFIRMAR} de ${TOTAL}: esperando tu decisión`);
  }
  const cierre = cierreDeCarga(operacion);
  if (cierre) {
    const titulo = cierre === "cancelada" ? `Cancelada en el paso ${PASO_CONFIRMAR}` : `Vencida en el paso ${PASO_CONFIRMAR}`;
    return construir(PASO_CONFIRMAR, PASO_CONFIRMAR - 1, "cancelado", titulo);
  }

  const final = segunEstado(operacion);
  if (final) return final;

  const paso = pasoDeEtapa(operacion);
  if (fallo) return detenidaEn(paso);
  const total = operacion.fragmentos_total;
  const fragmentos = paso === 4 && typeof total === "number" ? { procesados: operacion.fragmentos_procesados ?? 0, total } : null;
  return enCurso(paso, fragmentos);
}

/** Fracción de la barra: pasos completos más medio paso por el que está en curso. */
export function avanceDePasos(p: ProgresoPasos): number {
  const enMarcha = p.pasos.some((x) => x.estado === "activo") ? 0.5 : 0;
  return Math.min(1, (p.completados + enMarcha) / TOTAL);
}
