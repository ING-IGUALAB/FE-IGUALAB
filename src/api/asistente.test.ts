import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarAsistente, continuarConversacion, guardarConversacion, listarConversaciones, obtenerConversacion } from "./asistente";
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

describe("api/asistente: conversaciones guardadas", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("guarda el chat con su clave, contexto y mensajes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "c1" }));
    vi.stubGlobal("fetch", fetchMock);
    const mensajes = [{ rol: "usuario" as const, contenido: "¿Sanciones?" }, { rol: "asistente" as const, respuesta: { respuesta: "r", sin_evidencia: false } }];
    await guardarConversacion({ clave: "k1", sector: "MINERIA", empresaId: "e1", anio: 2024, mensajes });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/asistente\/conversaciones$/);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ clave_idempotencia: "k1", empresa_id: "e1", sector: "MINERIA", anio: 2024, mensajes });
  });

  it("lista por páginas, abre una conversación y continúa con una clave por pregunta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal("fetch", fetchMock);
    await listarConversaciones(2, 10);
    await listarConversaciones();
    await obtenerConversacion("c1");
    await continuarConversacion("c1", "k2", "¿Y el año?");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/asistente\/conversaciones\?pagina=2&tamano=10$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/pagina=1&tamano=20$/);
    expect(fetchMock.mock.calls[2][0]).toMatch(/\/asistente\/conversaciones\/c1$/);
    const [url, opts] = fetchMock.mock.calls[3];
    expect(url).toMatch(/\/asistente\/conversaciones\/c1\/consultas$/);
    expect(JSON.parse(opts.body)).toEqual({ clave_idempotencia: "k2", pregunta: "¿Y el año?" });
  });
});
