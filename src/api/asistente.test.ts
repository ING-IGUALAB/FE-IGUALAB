import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarAsistente } from "./asistente";
import { LOADING_START } from "./client";

const ok = (data: unknown) => ({ status: 200, ok: true, json: async () => data }) as unknown as Response;
const consulta = { pregunta: "¿Sanciones?", sector: "MINERIA" as const, empresaId: "e1", anio: 2024 };

describe("api/asistente", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("envía pregunta, sector, empresa y año (los cuatro son obligatorios)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ respuesta: "r", afirmaciones: [], citas: [], sin_evidencia: false }));
    vi.stubGlobal("fetch", fetchMock);
    await consultarAsistente(consulta);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/asistente/consultas");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ pregunta: "¿Sanciones?", sector: "MINERIA", empresa_id: "e1", anio: 2024 });
  });

  it("propaga el 422 de validación del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 422,
        ok: false,
        json: async () => ({ error: { code: "REQUEST_VALIDATION_ERROR", message: "Datos inválidos", details: [{ msg: "Field required" }], request_id: "r" } }),
      }),
    );
    await expect(consultarAsistente(consulta)).rejects.toMatchObject({ status: 422, code: "REQUEST_VALIDATION_ERROR" });
  });

  it("no usa el indicador central: el chat muestra su propio «Buscando…»", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ respuesta: "r", citas: [], sin_evidencia: false })));
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await consultarAsistente(consulta);
    globalThis.removeEventListener(LOADING_START, handler);
    expect(handler).not.toHaveBeenCalled();
  });
});
