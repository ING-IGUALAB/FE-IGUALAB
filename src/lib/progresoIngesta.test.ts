import { describe, expect, it } from "vitest";
import type { Operacion } from "../types";
import { avanceDePasos, progresoDePasos, type EstadoPaso } from "./progresoIngesta";

const op = (cambios: Partial<Operacion>): Operacion => ({
  operacion_id: "op1",
  estado: "EN_PROCESO",
  terminal: false,
  exitosa: false,
  etapa: null,
  fragmentos_procesados: 0,
  fragmentos_total: null,
  advertencias: [],
  publicacion_reintentable: false,
  creada_en: "2026-11-11T00:00:00Z",
  actualizada_en: "2026-11-11T00:00:00Z",
  ...cambios,
});

const estados = (p: ReturnType<typeof progresoDePasos>): EstadoPaso[] => p.pasos.map((x) => x.estado);
const repetir = (estado: EstadoPaso, n: number): EstadoPaso[] => Array<EstadoPaso>(n).fill(estado);

describe("progresoDePasos", () => {
  it("sin operación: paso 1 en curso al enviar; nada en marcha si no se envió", () => {
    expect(estados(progresoDePasos(null, true))).toEqual(["activo", ...repetir("pendiente", 8)]);
    expect(progresoDePasos(null, true).titulo).toBe("Paso 1 de 9: Validar");
    expect(estados(progresoDePasos(null, false))).toEqual(repetir("pendiente", 9));
    expect(progresoDePasos(null, false).actual).toBeNull();
  });

  it("sigue la etapa real y marca completos los pasos anteriores aunque no se hayan visto", () => {
    const p = progresoDePasos(op({ etapa: "ALMACENANDO_ORIGINAL" }), true);
    expect(estados(p)).toEqual([...repetir("completado", 2), "activo", ...repetir("pendiente", 6)]);
    expect(progresoDePasos(op({ etapa: "COMPLETANDO" }), false).titulo).toBe("Paso 7 de 9: Completar");
    // Validando, sin documento todavía: sigue en el paso 1 sin error.
    expect(progresoDePasos(op({ estado: "VALIDANDO" }), true).actual).toBe(1);
  });

  it("muestra los fragmentos del paso 4 solo cuando se conoce el total", () => {
    expect(progresoDePasos(op({ etapa: "INDEXANDO", fragmentos_procesados: 12, fragmentos_total: 40 }), true).fragmentos).toEqual({ procesados: 12, total: 40 });
    expect(progresoDePasos(op({ etapa: "INDEXANDO", fragmentos_total: null }), true).fragmentos).toBeNull();
    expect(progresoDePasos(op({ etapa: "ANALIZANDO", fragmentos_total: 40 }), true).fragmentos).toBeNull();
  });

  it("en el doble check se detiene en el paso 6, aunque la etapa ya diga CONFIRMANDO sin pausa", () => {
    const pausa = progresoDePasos(op({ estado: "CONFIRMACION_PENDIENTE", etapa: "CONFIRMANDO", confirmacion_pendiente: true }), false);
    expect(estados(pausa)).toEqual([...repetir("completado", 5), "pausado", ...repetir("pendiente", 3)]);
    expect(pausa.titulo).toBe("Paso 6 de 9: esperando tu decisión");
    // Tras «Continuar», la misma etapa ya no es una pausa: el paso 6 está en curso.
    expect(progresoDePasos(op({ etapa: "CONFIRMANDO", confirmacion_pendiente: false }), false).pasos[5].estado).toBe("activo");
  });

  it("completada, publicación pendiente, cancelada y vencida", () => {
    expect(estados(progresoDePasos(op({ estado: "COMPLETADO", terminal: true, exitosa: true }), false))).toEqual(repetir("completado", 9));
    const publicar = progresoDePasos(op({ estado: "PUBLICACION_PENDIENTE", publicacion_reintentable: true }), false);
    expect(estados(publicar)).toEqual([...repetir("completado", 7), "pausado", "pendiente"]);
    const cancelada = progresoDePasos(op({ estado: "FALLIDO", terminal: true, etapa: "CONFIRMANDO", error: { code: "CONFIRMACION_RECHAZADA", message: "x" } }), false);
    expect(cancelada.pasos[5].estado).toBe("cancelado");
    expect(cancelada.titulo).toBe("Cancelada en el paso 6");
    expect(progresoDePasos(op({ estado: "FALLIDO", error: { code: "CONFIRMACION_VENCIDA", message: "x" } }), false).titulo).toBe("Vencida en el paso 6");
  });

  it("marca en rojo el paso donde falló", () => {
    const fallo = progresoDePasos(op({ estado: "FALLIDO", terminal: true, etapa: "ALMACENANDO_ORIGINAL", error: { code: "STORAGE", message: "x" } }), false);
    expect(estados(fallo)).toEqual([...repetir("completado", 2), "fallido", ...repetir("pendiente", 6)]);
    expect(fallo.titulo).toBe("La ingesta se detuvo en el paso 3: Guardar");
    expect(progresoDePasos(op({ estado: "FALLIDO", etapa: null }), false).actual).toBe(1);
    expect(progresoDePasos(op({ estado: "RECHAZADA", terminal: true }), false).pasos[0].estado).toBe("fallido");
    expect(progresoDePasos(op({ estado: "INTERRUMPIDA" }), false).titulo).toBe("No se pudo iniciar la ingesta");
    // La petición falló sin que el servidor diga cómo quedó: en el paso 1, o en el último paso visto.
    expect(progresoDePasos(null, false, true).pasos[0].estado).toBe("fallido");
    expect(progresoDePasos(op({ etapa: "INDEXANDO" }), false, true).pasos[3].estado).toBe("fallido");
  });

  it("la barra avanza por pasos completos y medio paso por el que está en curso", () => {
    expect(avanceDePasos(progresoDePasos(null, false))).toBe(0);
    expect(avanceDePasos(progresoDePasos(op({ etapa: "INDEXANDO" }), true))).toBeCloseTo(3.5 / 9);
    expect(avanceDePasos(progresoDePasos(op({ estado: "COMPLETADO" }), false))).toBe(1);
  });
});
