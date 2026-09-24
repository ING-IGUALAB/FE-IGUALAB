import { describe, expect, it } from "vitest";
import { esCorreoValido } from "./validacion";

describe("esCorreoValido", () => {
  it("acepta correos válidos", () => {
    expect(esCorreoValido("ana@igualab.com")).toBe(true);
    expect(esCorreoValido("  admin@igualab.com  ")).toBe(true);
    expect(esCorreoValido("a.b@sub.dominio.pe")).toBe(true);
  });

  it("rechaza sin @ o con @ al inicio", () => {
    expect(esCorreoValido("anaigualab.com")).toBe(false);
    expect(esCorreoValido("@igualab.com")).toBe(false);
  });

  it("rechaza con más de un @", () => {
    expect(esCorreoValido("ana@@igualab.com")).toBe(false);
    expect(esCorreoValido("ana@x@igualab.com")).toBe(false);
  });

  it("rechaza dominio sin punto o con punto al borde", () => {
    expect(esCorreoValido("ana@igualab")).toBe(false);
    expect(esCorreoValido("ana@.com")).toBe(false);
    expect(esCorreoValido("ana@igualab.")).toBe(false);
  });

  it("rechaza vacío o con espacios internos", () => {
    expect(esCorreoValido("")).toBe(false);
    expect(esCorreoValido("an a@igualab.com")).toBe(false);
  });
});
