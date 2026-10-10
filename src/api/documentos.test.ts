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

  it("reintentarPublicacion hace POST a la ruta de reintento", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ operacion_id: "op1", exitosa: true }));
    vi.stubGlobal("fetch", fetchMock);
    await documentosApi.reintentarPublicacion("op1");
    expect(fetchMock.mock.calls[0][0]).toContain("/documentos/operaciones/op1/reintentar-publicacion");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
