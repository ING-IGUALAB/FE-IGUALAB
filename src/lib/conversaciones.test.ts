import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsultaAsistente } from "../types";
import { mensajesParaGuardar, motivoNoGuardar, nuevaClave } from "./conversaciones";

const r = (respuesta: string): ConsultaAsistente => ({ respuesta, sin_evidencia: false });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("conversaciones guardadas", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("genera claves únicas con formato UUID, también sin randomUUID", () => {
    expect(nuevaClave()).toMatch(UUID);
    expect(nuevaClave()).not.toBe(nuevaClave());
    vi.stubGlobal("crypto", { getRandomValues: (b: Uint8Array) => b.fill(255) });
    expect(nuevaClave()).toMatch(UUID);
  });

  it("guarda pares pregunta-respuesta y descarta los que fallaron o siguen esperando", () => {
    const res = mensajesParaGuardar([
      { autor: "user", texto: "¿Sanciones?" },
      { autor: "bot", texto: "Multa", respuesta: r("Multa") },
      { autor: "user", texto: "¿Y emisiones?" },
      { autor: "bot", texto: "Sin conexión", error: true },
      { autor: "user", texto: "¿Agua?" },
      { autor: "bot", texto: "Consumo", respuesta: r("Consumo") },
      { autor: "user", texto: "¿Residuos?" },
      { autor: "bot", texto: "", typing: true },
    ]);
    expect(res).toEqual([
      { rol: "usuario", contenido: "¿Sanciones?" },
      { rol: "asistente", respuesta: r("Multa") },
      { rol: "usuario", contenido: "¿Agua?" },
      { rol: "asistente", respuesta: r("Consumo") },
    ]);
  });

  it("explica por qué no se puede guardar", () => {
    expect(motivoNoGuardar([])).toMatch(/al menos una pregunta/);
    const par = mensajesParaGuardar([{ autor: "user", texto: "a" }, { autor: "bot", texto: "b", respuesta: r("b") }]);
    expect(motivoNoGuardar(par)).toBeNull();
    expect(motivoNoGuardar(Array.from({ length: 21 }, () => par).flat())).toMatch(/hasta 20 preguntas/);
  });
});
