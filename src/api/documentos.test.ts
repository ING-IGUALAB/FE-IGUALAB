import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as documentosApi from "./documentos";

function ok(data: unknown, status = 200): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => data } as unknown as Response;
}

describe("api/documentos", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("crearOperacion hace POST a /documentos/operaciones", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ operacion_id: "op1" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.crearOperacion();
    expect(fetchMock.mock.calls[0][0]).toContain("/documentos/operaciones");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("ingerirDocumento envía multipart con los campos del backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ operacion_id: "op1", terminal: true, exitosa: true }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const archivo = new File(["# hola"], "memoria.md", { type: "text/markdown" });
    await documentosApi.ingerirDocumento("op1", {
      archivo,
      empresaId: "e1",
      anio: 2024,
      tipoDocumento: "MEMORIA_ANUAL",
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/documentos/operaciones/op1/ingesta");
    expect(opts.body).toBeInstanceOf(FormData);
    const fd = opts.body as FormData;
    expect(fd.get("empresa_id")).toBe("e1");
    expect(fd.get("anio")).toBe("2024");
    expect(fd.get("tipo_documento")).toBe("MEMORIA_ANUAL");
    expect((fd.get("archivo") as File).name).toBe("memoria.md");
    // En multipart NO se fija Content-Type manualmente (lo pone el navegador con boundary).
    expect(opts.headers["Content-Type"]).toBeUndefined();
  });

  const archivoMd = () => new File(["# hola"], "memoria.md", { type: "text/markdown" });
  const datosCarga = () => ({ archivo: archivoMd(), empresaId: "e1", anio: 2024, tipoDocumento: "MEMORIA_ANUAL" as const });

  it("ingerirDocumento con 201 devuelve el resultado de la carga terminada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ operacion_id: "op1", terminal: true, exitosa: true }, 201)));
    const res = await documentosApi.ingerirDocumento("op1", datosCarga());
    expect(res).toEqual({ status: 201, data: { operacion_id: "op1", terminal: true, exitosa: true } });
  });

  it("ingerirDocumento con 202 devuelve la operación en pausa (no es un error)", async () => {
    const pausa = { operacion_id: "op1", estado: "CONFIRMACION_PENDIENTE", terminal: false, confirmacion_pendiente: true };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(pausa, 202)));
    const res = await documentosApi.ingerirDocumento("op1", datosCarga());
    expect(res.status).toBe(202);
    expect(res.data.confirmacion_pendiente).toBe(true);
  });

  it("ingerirDocumento lanza el error del backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ error: { code: "DUPLICATE_DOCUMENT", message: "Ya existe." } }, 409)));
    await expect(documentosApi.ingerirDocumento("op1", datosCarga())).rejects.toMatchObject({ status: 409, code: "DUPLICATE_DOCUMENT" });
  });

  it("confirmarOperacion y cancelarOperacion hacen POST a …/confirmar y …/cancelar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ operacion_id: "op1" }));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.confirmarOperacion("op1");
    await documentosApi.cancelarOperacion("op1");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/documentos\/operaciones\/op1\/confirmar$/);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/documentos\/operaciones\/op1\/cancelar$/);
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });

  it("listarPorEstados no repite un documento que aparece en dos estados", async () => {
    const pagina = (items: unknown[]) => ok({ items, total: items.length, pagina: 1, tamano: 100, paginas: 1 });
    const doc = { id: "d1", creado_en: "2026-10-01T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(pagina([doc])).mockResolvedValueOnce(pagina([doc])));
    const docs = await documentosApi.listarPorEstados(["EN_PROCESO", "CONFIRMACION_PENDIENTE"]);
    expect(docs.map((d) => d.id)).toEqual(["d1"]);
  });

  it("listarDocumentos arma los filtros y paginación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, pagina: 1, tamano: 10, paginas: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.listarDocumentos({ estado: "COMPLETADO", tipo: "MEMORIA_ANUAL", pagina: 2, tamano: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("estado=COMPLETADO");
    expect(url).toContain("tipo=MEMORIA_ANUAL");
    expect(url).toContain("pagina=2");
    expect(url).toContain("tamano=10");
  });

  it("listarDocumentos usa pagina=1 y tamano=20 por defecto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, pagina: 1, tamano: 20, paginas: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.listarDocumentos();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("pagina=1");
    expect(url).toContain("tamano=20");
  });

  it("consultarOperacion hace GET a la operación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ operacion_id: "op1", terminal: false }));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.consultarOperacion("op1");
    expect(fetchMock.mock.calls[0][0]).toContain("/documentos/operaciones/op1");
    expect(fetchMock.mock.calls[0][1].method ?? "GET").toBe("GET");
  });

  it("detalleDocumento hace GET a /documentos/{id}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "d1" }));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.detalleDocumento("d1");
    expect(fetchMock.mock.calls[0][0]).toContain("/documentos/d1");
    expect(fetchMock.mock.calls[0][1].method ?? "GET").toBe("GET");
  });

  it("detalleDocumento no usa el indicador central (el modal muestra su propio «Cargando…»)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ id: "d1" })));
    const { LOADING_START } = await import("./client");
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await documentosApi.detalleDocumento("d1");
    globalThis.removeEventListener(LOADING_START, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("disponibilidadIngesta consulta por empresa y año, sin el indicador central", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ tipos: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { LOADING_START } = await import("./client");
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await documentosApi.disponibilidadIngesta("e1", 2025);
    globalThis.removeEventListener(LOADING_START, handler);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/documentos\/disponibilidad\?empresa_id=e1&anio=2025$/);
    expect(handler).not.toHaveBeenCalled();
  });

  it("listarPorEstados pide cada estado por separado y los une del más reciente al más antiguo", async () => {
    const pagina = (items: unknown[]) => ok({ items, total: items.length, pagina: 1, tamano: 100, paginas: 1 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pagina([{ id: "a", creado_en: "2026-10-01T00:00:00Z" }]))
      .mockResolvedValueOnce(pagina([{ id: "b", creado_en: "2026-10-03T00:00:00Z" }, { id: "c", creado_en: "2026-09-01T00:00:00Z" }]));
    vi.stubGlobal("fetch", fetchMock);
    const docs = await documentosApi.listarPorEstados(["FALLIDO", "FALLIDO_LIMPIEZA_PENDIENTE"], { tipo: "MEMORIA_ANUAL" });
    expect(docs.map((d) => d.id)).toEqual(["b", "a", "c"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("estado=FALLIDO&");
    expect(fetchMock.mock.calls[1][0]).toContain("estado=FALLIDO_LIMPIEZA_PENDIENTE");
    expect(fetchMock.mock.calls[1][0]).toContain("tipo=MEMORIA_ANUAL");
  });

  it("listarPorEstados con un estado o ninguno hace una sola consulta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, pagina: 1, tamano: 100, paginas: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.listarPorEstados([]);
    expect(fetchMock.mock.calls[0][0]).not.toContain("estado=");
    await documentosApi.listarPorEstados(["COMPLETADO"]);
    expect(fetchMock.mock.calls[1][0]).toContain("estado=COMPLETADO");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("listarTodosDocumentos recorre todas las páginas de 100 en 100", async () => {
    const pagina = (n: number) => ({ items: [{ id: `d${n}` }], total: 2, pagina: n, tamano: 100, paginas: 2 });
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(pagina(1))).mockResolvedValueOnce(ok(pagina(2)));
    vi.stubGlobal("fetch", fetchMock);
    const todos = await documentosApi.listarTodosDocumentos({ tipo: "MEMORIA_ANUAL" });
    expect(todos.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("pagina=1");
    expect(fetchMock.mock.calls[1][0]).toContain("pagina=2");
    expect(fetchMock.mock.calls[0][0]).toContain("tamano=100");
    expect(fetchMock.mock.calls[0][0]).toContain("tipo=MEMORIA_ANUAL");
  });

  it("listarTodosDocumentos hace una sola llamada si hay una página", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, pagina: 1, tamano: 100, paginas: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(documentosApi.listarTodosDocumentos()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reintentarPublicacion hace POST a la ruta de reintento y muestra el indicador central", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ operacion_id: "op1", exitosa: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { LOADING_START } = await import("./client");
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await documentosApi.reintentarPublicacion("op1");
    globalThis.removeEventListener(LOADING_START, handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/documentos/operaciones/op1/reintentar-publicacion");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
