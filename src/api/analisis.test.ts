import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as analisisApi from "./analisis";

function ok(data: unknown, status = 200): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => data } as unknown as Response;
}

describe("api/analisis", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("consultarAnalisis hace GET a empresa + año", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ filas: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await analisisApi.consultarAnalisis("e1", 2024);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/analisis-gri\/empresas\/e1\/anios\/2024$/);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("consultarAnalisis puede ser silenciosa (sin indicador de carga)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ filas: [], documentos: [] })));
    const { LOADING_START } = await import("./client");
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await analisisApi.consultarAnalisis("e1", 2024, { silencioso: true });
    globalThis.removeEventListener(LOADING_START, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("asignarEstado hace PUT con estado y version_fila_esperada, codificando la identidad", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ cambio: true }));
    vi.stubGlobal("fetch", fetchMock);
    await analisisApi.asignarEstado("e1", 2024, "305:2016", "BAJA_SUSTANCIA", 3);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/analisis-gri/empresas/e1/anios/2024/codigos/305%3A2016/estado");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ estado: "BAJA_SUSTANCIA", version_fila_esperada: 3 });
  });

  it("consultarHistorial usa pagina=1 y tamano=20 por defecto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, pagina: 1, tamano: 20 }));
    vi.stubGlobal("fetch", fetchMock);
    await analisisApi.consultarHistorial("e1", 2024);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/analisis-gri/empresas/e1/anios/2024/historial?");
    expect(url).toContain("pagina=1");
    expect(url).toContain("tamano=20");
    expect(url).not.toContain("identidad=");
  });

  it("consultarHistorial filtra por identidad y paginación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, pagina: 2, tamano: 10 }));
    vi.stubGlobal("fetch", fetchMock);
    await analisisApi.consultarHistorial("e1", 2024, { identidad: "305:2016", pagina: 2, tamano: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("identidad=305%3A2016");
    expect(url).toContain("pagina=2");
    expect(url).toContain("tamano=10");
  });

  it("consultarHistorial puede ser silencioso y no envía la opción como parámetro", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, pagina: 1, tamano: 10 }));
    vi.stubGlobal("fetch", fetchMock);
    const { LOADING_START } = await import("./client");
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await analisisApi.consultarHistorial("e1", 2024, { pagina: 1, tamano: 10, silencioso: true });
    globalThis.removeEventListener(LOADING_START, handler);
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).not.toContain("silencioso");
  });

  it("validarAnalisis hace POST con version y huella_documentos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ estado_flujo: "VALIDADO" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await analisisApi.validarAnalisis("e1", 2024, 7, "abc123");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/analisis-gri/empresas/e1/anios/2024/validacion");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ version: 7, huella_documentos: "abc123" });
  });

  it("propaga el 409 de conflicto de versión como ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ok({ error: { code: "ANALYSIS_ROW_VERSION_CONFLICT", message: "La fila cambió.", details: null, request_id: "r" } }, 409),
      ),
    );
    await expect(analisisApi.asignarEstado("e1", 2024, "305:2016", "OK", 0)).rejects.toMatchObject({
      status: 409,
      code: "ANALYSIS_ROW_VERSION_CONFLICT",
    });
  });
});
