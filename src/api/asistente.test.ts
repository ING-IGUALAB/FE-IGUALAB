import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarAsistente } from "./asistente";
import { LOADING_START } from "./client";

const ok = (data: unknown) => ({ status: 200, ok: true, json: async () => data }) as unknown as Response;

describe("api/asistente", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("envía pregunta, empresa y año a /asistente/consultas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ respuesta: "r", citas: [], sin_evidencia: false }));
    vi.stubGlobal("fetch", fetchMock);
    await consultarAsistente({ pregunta: "¿Sanciones?", empresaId: "e1", anio: 2024 });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/asistente/consultas");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ pregunta: "¿Sanciones?", empresa_id: "e1", anio: 2024 });
  });

  it("sin contexto envía empresa y año como null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ respuesta: "r", citas: [], sin_evidencia: true }));
    vi.stubGlobal("fetch", fetchMock);
    await consultarAsistente({ pregunta: "Hola" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ pregunta: "Hola", empresa_id: null, anio: null });
  });

  it("es silenciosa: no dispara el indicador de carga global", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ respuesta: "r", citas: [], sin_evidencia: false })));
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await consultarAsistente({ pregunta: "x", empresaId: "e1", anio: 2024 });
    globalThis.removeEventListener(LOADING_START, handler);
    expect(handler).not.toHaveBeenCalled();
  });
});
