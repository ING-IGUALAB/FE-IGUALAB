import { describe, expect, it } from "vitest";
import {
  MAX_BYTES_INGESTA,
  anioIngestaValido,
  etiquetaAnalisis,
  etiquetaEstado,
  etiquetaSector,
  etiquetaTipo,
  formatearTamano,
  validarArchivoIngesta,
} from "./dominio";

describe("etiquetas de dominio", () => {
  it("traduce sectores del backend", () => {
    expect(etiquetaSector("MINERIA")).toBe("Minería");
    expect(etiquetaSector("PETROLEO")).toBe("Petróleo y Gas");
    expect(etiquetaSector("ENERGIA")).toBe("Energía");
  });

  it("traduce tipos de documento", () => {
    expect(etiquetaTipo("MEMORIA_ANUAL")).toBe("Memoria Anual");
    expect(etiquetaTipo("REPORTE_SOSTENIBILIDAD_GRI")).toBe("Reporte de Sostenibilidad GRI");
  });

  it("traduce estados de progreso", () => {
    expect(etiquetaEstado("COMPLETADO")).toBe("Completado");
    expect(etiquetaEstado("EN_PROCESO")).toBe("En proceso");
    expect(etiquetaEstado("PUBLICACION_PENDIENTE")).toBe("Publicación pendiente");
    expect(etiquetaEstado("FALLIDO")).toBe("Fallido");
    expect(etiquetaEstado("FALLIDO_LIMPIEZA_PENDIENTE")).toBe("Fallido (limpieza pendiente)");
  });

  it("traduce el resultado de análisis, con guion si falta", () => {
    expect(etiquetaAnalisis("CON_HALLAZGOS")).toBe("Con hallazgos");
    expect(etiquetaAnalisis("OBSERVADO")).toBe("Observado");
    expect(etiquetaAnalisis(null)).toBe("—");
    expect(etiquetaAnalisis(undefined)).toBe("—");
  });
});

describe("validarArchivoIngesta", () => {
  it("acepta un .md con contenido y dentro del límite", () => {
    expect(validarArchivoIngesta({ name: "memoria.md", size: 1024 })).toEqual({ ok: true });
    expect(validarArchivoIngesta({ name: "MEMORIA.MD", size: 10 })).toEqual({ ok: true });
  });

  it("rechaza extensión distinta de .md (RF-018)", () => {
    const r = validarArchivoIngesta({ name: "memoria.pdf", size: 1024 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("RF-018");
  });

  it("rechaza archivo vacío", () => {
    const r = validarArchivoIngesta({ name: "vacio.md", size: 0 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("vacío");
  });

  it("rechaza si supera 50 MB (RNF-014)", () => {
    const r = validarArchivoIngesta({ name: "grande.md", size: MAX_BYTES_INGESTA + 1 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("RNF-014");
  });
});

describe("anioIngestaValido", () => {
  it("acepta años en rango", () => {
    expect(anioIngestaValido(2000)).toBe(true);
    expect(anioIngestaValido(2025)).toBe(true);
  });
  it("rechaza fuera de rango o no entero", () => {
    expect(anioIngestaValido(1999)).toBe(false);
    expect(anioIngestaValido(10000)).toBe(false);
    expect(anioIngestaValido(2024.5)).toBe(false);
  });
});

describe("formatearTamano", () => {
  it("formatea bytes, KB y MB", () => {
    expect(formatearTamano(512)).toBe("512 B");
    expect(formatearTamano(2048)).toBe("2.0 KB");
    expect(formatearTamano(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
