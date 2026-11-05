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

  it("descargarReporte pide el archivo de esa versión", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pdf(null));
    vi.stubGlobal("fetch", fetchMock);
    const r = await reportesApi.descargarReporte("r1");
    expect(fetchMock.mock.calls[0][0]).toContain("/reportes/r1/archivo");
    expect(r.blob.type).toBe("application/pdf");
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

  it("consulta la disponibilidad y la última emisión con empresa y año", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal("fetch", fetchMock);
    await reportesApi.disponibilidadReportes("e 1");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/reportes\/disponibilidad\?empresa_id=e\+1$/);
    await reportesApi.reporteVigente("e1", 2024);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/reportes\/vigente\?empresa_id=e1&anio=2024$/);
  });

  it("descargarReporteActualizado usa su ruta propia, distinta de la de una versión concreta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pdf(null));
    vi.stubGlobal("fetch", fetchMock);
    await reportesApi.descargarReporteActualizado("e1", 2024);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/reportes\/vigente\/archivo\?empresa_id=e1&anio=2024$/);
  });

  it("no acepta como PDF una respuesta correcta que no lo es", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: { get: () => null },
        blob: async () => new Blob(["<html>"], { type: "text/html" }),
      }),
    );
    await expect(reportesApi.descargarReporte("r1")).rejects.toMatchObject({ code: "RESPUESTA_NO_PDF" });
    await expect(reportesApi.descargarReporteActualizado("e1", 2024)).rejects.toMatchObject({ code: "RESPUESTA_NO_PDF" });
    await expect(reportesApi.vistaPreviaReporte("e1", 2024)).rejects.toMatchObject({ code: "RESPUESTA_NO_PDF" });
  });

  it("mensajeErrorReporte decide por el código y por la acción sugerida, no por el texto", async () => {
    const { ApiError } = await import("./client");
    const fallback = "No se pudo.";
    const conAccion = (accion_sugerida: string) => new ApiError(409, { code: "REPORT_UPDATE_PENDING", message: "texto", details: { accion_sugerida } });
    expect(reportesApi.mensajeErrorReporte(new ApiError(409, { code: "REPORT_SOURCE_CHANGED", message: "texto" }), fallback)).toContain("cambió mientras se generaba");
    expect(reportesApi.mensajeErrorReporte(new ApiError(409, { code: "REPORT_VERSION_CONFLICT", message: "texto" }), fallback)).toContain("Vuelve a intentarlo");
    expect(reportesApi.mensajeErrorReporte(conAccion("EMITIR"), fallback)).toContain("genera una nueva versión");
    expect(reportesApi.mensajeErrorReporte(conAccion("REVISAR"), fallback)).toContain("revisa el análisis");
    expect(reportesApi.mensajeErrorReporte(conAccion("VALIDAR"), fallback)).toContain("valida el análisis");
    expect(reportesApi.mensajeErrorReporte(conAccion("DESCARGAR_VERSION_HISTORICA"), fallback)).toContain("versión histórica");
    expect(reportesApi.mensajeErrorReporte(new ApiError(409, { code: "ANALYSIS_NOT_VALIDATED", message: "Falta validar." }), fallback)).toBe("Falta validar.");
    // Una página de error del proxy no trae código: no se muestra su texto técnico.
    expect(reportesApi.mensajeErrorReporte(new ApiError(502), fallback)).toBe(fallback);
    expect(reportesApi.mensajeErrorReporte(new Error("x"), fallback)).toBe(fallback);
  });

  it("emisionSinConfirmar reconoce cuando no se sabe si el reporte se emitió", async () => {
    const { ApiError } = await import("./client");
    expect(reportesApi.emisionSinConfirmar(new ApiError(0, { code: "NETWORK_ERROR" }))).toBe(true);
    expect(reportesApi.emisionSinConfirmar(new ApiError(504))).toBe(true);
    expect(reportesApi.emisionSinConfirmar(new ApiError(502, { code: "PDF_GENERATION_ERROR" }))).toBe(false);
    expect(reportesApi.emisionSinConfirmar(new ApiError(409, { code: "ANALYSIS_NOT_VALIDATED" }))).toBe(false);
    expect(reportesApi.emisionSinConfirmar(new Error("x"))).toBe(false);
  });
});
