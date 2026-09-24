import { describe, expect, it } from "vitest";
import {
  analisisKey,
  conteoEstados,
  esgScore,
  resumenSanciones,
  riesgoDesdeEsg,
} from "./seed";
import type { EstadoGri } from "../types";

const gri = (estados: EstadoGri[]) => estados.map((estado) => ({ estado }));

describe("esgScore", () => {
  it("devuelve null si no hay códigos", () => {
    expect(esgScore([])).toBeNull();
  });

  it("promedia los puntajes (OK=100, Baja=50, Sub=0)", () => {
    expect(esgScore(gri(["OK", "Sub-reportado"]))).toBe(50);
    expect(esgScore(gri(["OK", "OK"]))).toBe(100);
    expect(esgScore(gri(["OK", "Baja sustancia", "Sub-reportado"]))).toBe(50);
  });
});

describe("riesgoDesdeEsg", () => {
  it("mapea el puntaje a nivel de riesgo", () => {
    expect(riesgoDesdeEsg(null)).toBe("Sin datos");
    expect(riesgoDesdeEsg(80)).toBe("Bajo");
    expect(riesgoDesdeEsg(50)).toBe("Medio");
    expect(riesgoDesdeEsg(10)).toBe("Alto");
  });
});

describe("conteoEstados", () => {
  it("cuenta por estado", () => {
    expect(conteoEstados(gri(["OK", "OK", "Baja sustancia"]))).toEqual({
      OK: 2,
      "Baja sustancia": 1,
      "Sub-reportado": 0,
    });
  });
});

describe("resumenSanciones", () => {
  it("suma cuantificadas y cuenta las sin monto", () => {
    expect(resumenSanciones([{ monto: 100 }, { monto: null }, { monto: 50 }])).toEqual({
      total: 150,
      sinMonto: 1,
      cantidad: 3,
    });
  });

  it("maneja lista vacía", () => {
    expect(resumenSanciones([])).toEqual({ total: 0, sinMonto: 0, cantidad: 0 });
  });
});

describe("analisisKey", () => {
  it("arma la clave empresa|año", () => {
    expect(analisisKey("andina", 2024)).toBe("andina|2024");
  });
});
