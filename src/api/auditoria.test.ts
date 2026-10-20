import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as auditoriaApi from "./auditoria";

const ok = (data: unknown) => ({ status: 200, ok: true, json: async () => data }) as unknown as Response;
const evento = (id: string) => ({ id, usuario_id: null, tipo_evento: "Descarga", detalle: "d", fecha_hora_utc: "2026-10-01T10:00:00Z" });

describe("api/auditoria", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("arma todos los filtros y la paginación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], pagina: 2, tamano: 10, total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await auditoriaApi.listarEventos({
      tipoEvento: "Inicio de sesión",
      usuarioId: "u1",
      desde: "2026-10-01T05:00:00.000Z",
      hasta: "2026-10-02T04:59:59.999Z",
      pagina: 2,
      tamano: 10,
    });
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://x");
    expect(url.pathname).toMatch(/\/auditoria$/);
    expect(url.searchParams.get("tipo_evento")).toBe("Inicio de sesión");
    expect(url.searchParams.get("usuario_id")).toBe("u1");
    expect(url.searchParams.get("desde")).toBe("2026-10-01T05:00:00.000Z");
    expect(url.searchParams.get("hasta")).toBe("2026-10-02T04:59:59.999Z");
    expect(url.searchParams.get("pagina")).toBe("2");
    expect(url.searchParams.get("tamano")).toBe("10");
  });

  it("sin filtros usa página 1 y tamaño 20", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], pagina: 1, tamano: 20, total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await auditoriaApi.listarEventos();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("pagina=1");
    expect(url).toContain("tamano=20");
    expect(url).not.toContain("tipo_evento");
  });

  it("listarTodosEventos recorre las páginas hasta completar el total", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ items: [evento("a"), evento("b")], pagina: 1, tamano: 100, total: 3 }))
      .mockResolvedValueOnce(ok({ items: [evento("c")], pagina: 2, tamano: 100, total: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const todos = await auditoriaApi.listarTodosEventos({ tipoEvento: "Descarga" });
    expect(todos.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("pagina=2");
  });

  it("listarTodosEventos se detiene si una página llega vacía", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], pagina: 1, tamano: 100, total: 5 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(auditoriaApi.listarTodosEventos()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
