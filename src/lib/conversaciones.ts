import type { ConsultaAsistente, MensajeParaGuardar } from "../types";

/** Una conversación guardada admite hasta 40 mensajes: 20 preguntas con su respuesta. */
export const MAX_MENSAJES_CONVERSACION = 40;

/** Identificador único para que un reintento no guarde dos veces lo mismo. */
export function nuevaClave(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Respaldo: UUID v4 con números aleatorios del navegador.
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface MensajeChat {
  autor: "user" | "bot";
  texto: string;
  respuesta?: ConsultaAsistente;
  error?: boolean;
  typing?: boolean;
}

/**
 * Lo que se guarda del chat: cada pregunta con la respuesta exacta del asistente, en orden. Las
 * preguntas que fallaron o siguen esperando respuesta no se guardan.
 */
export function mensajesParaGuardar(mensajes: MensajeChat[]): MensajeParaGuardar[] {
  const salida: MensajeParaGuardar[] = [];
  for (let i = 0; i < mensajes.length - 1; i++) {
    const pregunta = mensajes[i];
    const respuesta = mensajes[i + 1];
    if (pregunta.autor === "user" && respuesta.autor === "bot" && respuesta.respuesta && !respuesta.error && !respuesta.typing) {
      salida.push({ rol: "usuario", contenido: pregunta.texto }, { rol: "asistente", respuesta: respuesta.respuesta });
      i += 1;
    }
  }
  return salida;
}

/** Por qué no se puede guardar todavía (o null si se puede). */
export function motivoNoGuardar(paraGuardar: MensajeParaGuardar[]): string | null {
  if (paraGuardar.length === 0) return "Haz al menos una pregunta con respuesta para guardar el chat.";
  if (paraGuardar.length > MAX_MENSAJES_CONVERSACION) {
    return `Un chat guardado admite hasta ${MAX_MENSAJES_CONVERSACION / 2} preguntas. Empieza una conversación nueva.`;
  }
  return null;
}
