import { describe, expect, it } from "vitest";
import { ahora, fechaCorta, iniciales, money } from "./format";

describe("money", () => {
  it("devuelve — para null o undefined", () => {
    expect(money(null)).toBe("—");
    expect(money(undefined)).toBe("—");
  });

  it("formatea un número con prefijo S/", () => {
    const r = money(1000);
    expect(r.startsWith("S/")).toBe(true);
    expect(r).toContain("1");
  });

  it("formatea el cero", () => {
    expect(money(0)).toContain("S/");
  });
});

describe("iniciales", () => {
  it("toma las dos primeras iniciales en mayúscula", () => {
    expect(iniciales("María López")).toBe("ML");
  });

  it("funciona con un solo nombre", () => {
    expect(iniciales("Oscar")).toBe("O");
  });

  it("ignora espacios extra", () => {
    expect(iniciales("  ana  ")).toBe("A");
  });
});

describe("fechaCorta", () => {
  it("devuelve cadena vacía si no hay valor", () => {
    expect(fechaCorta()).toBe("");
    expect(fechaCorta("")).toBe("");
  });

  it("devuelve el mismo texto si la fecha es inválida", () => {
    expect(fechaCorta("no-es-fecha")).toBe("no-es-fecha");
  });

  it("formatea una fecha ISO válida", () => {
    expect(fechaCorta("2026-09-20T10:00:00Z")).not.toBe("");
  });
});

describe("ahora", () => {
  it("devuelve una cadena no vacía", () => {
    expect(typeof ahora()).toBe("string");
    expect(ahora().length).toBeGreaterThan(0);
  });
});
