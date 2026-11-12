import { describe, expect, it } from "vitest";
import { AYUDA_REQUIERE_REVISION, CATALOGO_ADVERTENCIAS, ayudaAdvertencia, ayudasDeAdvertencias } from "./catalogoAdvertencias";

describe("catálogo de advertencias", () => {
  it("cada entrada explica qué significa, por qué aparece y qué hacer", () => {
    for (const entrada of [AYUDA_REQUIERE_REVISION, ...Object.values(CATALOGO_ADVERTENCIAS)]) {
      expect(entrada.titulo).not.toBe("");
      expect(entrada.significado).not.toBe("");
      expect(entrada.motivo).not.toBe("");
      expect(entrada.accion).not.toBe("");
    }
  });

  it("busca por el código que manda el backend y, si no lo conoce, da la explicación general", () => {
    expect(ayudaAdvertencia("GRI_EDICION_AMBIGUA").titulo).toBe("Edición del estándar sin precisar");
    expect(ayudaAdvertencia("CODIGO_NUEVO")).toBe(AYUDA_REQUIERE_REVISION);
  });

  it("no repite explicaciones y sin advertencias usa la general", () => {
    expect(ayudasDeAdvertencias(["GRI_EDICION_AMBIGUA", "GRI_EDICION_AMBIGUA"])).toEqual([CATALOGO_ADVERTENCIAS.GRI_EDICION_AMBIGUA]);
    expect(ayudasDeAdvertencias(["X", "Y"])).toEqual([AYUDA_REQUIERE_REVISION]);
    expect(ayudasDeAdvertencias([])).toEqual([AYUDA_REQUIERE_REVISION]);
  });
});
