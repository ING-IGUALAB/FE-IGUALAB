import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as empresasApi from "./empresas";

function ok(data: unknown): Response {
  return { status: 200, ok: true, json: async () => data } as unknown as Response;
}

describe("api/empresas", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("listarEmpresas sin filtros no agrega query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await empresasApi.listarEmpresas();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/empresas$/);
  });

  it("listarEmpresas agrega solo_activas y sector", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await empresasApi.listarEmpresas({ soloActivas: true, sector: "MINERIA" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("solo_activas=true");
    expect(url).toContain("sector=MINERIA");
  });

  it("crearEmpresa envía POST con nombre y sector", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);
    await empresasApi.crearEmpresa({ nombre: "Minera X", sector: "ENERGIA" });
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ nombre: "Minera X", sector: "ENERGIA" });
  });

  it("obtenerEmpresa hace GET a /empresas/{id}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);
    await empresasApi.obtenerEmpresa("e1");
    expect(fetchMock.mock.calls[0][0]).toContain("/empresas/e1");
    expect(fetchMock.mock.calls[0][1].method ?? "GET").toBe("GET");
  });

  it("editarEmpresa hace PATCH con el payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);
    await empresasApi.editarEmpresa("e1", { nombre: "Nuevo", sector: "PETROLEO" });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/empresas/e1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual({ nombre: "Nuevo", sector: "PETROLEO" });
  });

  it("activar/desactivar usan PATCH en la ruta correcta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);
    await empresasApi.activarEmpresa("e1");
    await empresasApi.desactivarEmpresa("e1");
    expect(fetchMock.mock.calls[0][0]).toContain("/empresas/e1/activar");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(fetchMock.mock.calls[1][0]).toContain("/empresas/e1/desactivar");
  });
});
