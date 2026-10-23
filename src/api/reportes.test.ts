import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as reportesApi from "./reportes";

const ok = (data: unknown, status = 200) => ({ status, ok: true, json: async () => data }) as unknown as Response;
const pdf = (disposicion: string | null) =>
  ({
    status: 200,
    ok: true,
    headers: { get: (h: string) => (h.toLowerCase() === "content-disposition" ? disposicion : null) },
    blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
  }) as unknown as Response;

describe("api/reportes", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("listarReportes hace GET a /reportes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await reportesApi.listarReportes();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/reportes$/);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("generarReporte hace POST con empresa_id y anio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "r1" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await reportesApi.generarReporte("e1", 2024);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/reportes$/);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ empresa_id: "e1", anio: 2024 });
  });

  it("vistaPreviaReporte devuelve el PDF como archivo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pdf(null));
    vi.stubGlobal("fetch", fetchMock);
    const r = await reportesApi.vistaPreviaReporte("e1", 2024);
    expect(fetchMock.mock.calls[0][0]).toContain("/reportes/vista-previa");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ empresa_id: "e1", anio: 2024 });
    expect(r.blob.type).toBe("application/pdf");
    expect(r.nombre).toBeNull();
  });

  it("descargarReporte usa el nombre que manda el backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pdf('attachment; filename="reporte-andina-2024.pdf"'));
    vi.stubGlobal("fetch", fetchMock);
    const r = await reportesApi.descargarReporte("r1");
    expect(fetchMock.mock.calls[0][0]).toContain("/reportes/r1/archivo");
    expect(r.nombre).toBe("reporte-andina-2024.pdf");
  });

  it("si el backend rechaza la generación, lanza el error de negocio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 409,
        ok: false,
        json: async () => ({ error: { code: "ANALYSIS_NOT_VALIDATED", message: "El análisis no está validado.", details: null, request_id: "r" } }),
      }),
    );
    await expect(reportesApi.vistaPreviaReporte("e1", 2024)).rejects.toMatchObject({ status: 409, code: "ANALYSIS_NOT_VALIDATED" });
  });

  it("reporteYaExistente reconoce el 409 «ya existe» y devuelve el id del reporte", async () => {
    const { ApiError } = await import("./client");
    expect(reportesApi.reporteYaExistente(new ApiError(409, { code: "REPORT_ALREADY_EXISTS", details: { reporte_id: "r9" } }))).toEqual({ reporteId: "r9" });
    expect(reportesApi.reporteYaExistente(new ApiError(409, { code: "REPORT_ALREADY_EXISTS" }))).toEqual({});
    expect(reportesApi.reporteYaExistente(new ApiError(409, { code: "ANALYSIS_NOT_VALIDATED" }))).toBeNull();
    expect(reportesApi.reporteYaExistente(new Error("red"))).toBeNull();
  });
});
