import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiArchivo, ApiError, AUTH_401_EVENT, LOADING_START, mensajeError, nombreArchivoDe, tipoAviso } from "./client";

function resp(status: number, data: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  } as unknown as Response;
}

describe("tipoAviso", () => {
  it("un 409 (condición pendiente o datos cambiados) es advertencia", () => {
    expect(tipoAviso(new ApiError(409, { code: "ANALYSIS_NOT_VALIDATED" }))).toBe("warn");
  });
  it("lo demás es error: servidor, permisos, no encontrado o fallas de red", () => {
    expect(tipoAviso(new ApiError(502, { code: "PDF_GENERATION_ERROR" }))).toBe("error");
    expect(tipoAviso(new ApiError(404))).toBe("error");
    expect(tipoAviso(new Error("red"))).toBe("error");
  });
});

describe("mensajeError", () => {
  it("usa message del backend", () => {
    expect(mensajeError(new ApiError(401, { message: "Credenciales inválidas." }))).toBe("Credenciales inválidas.");
  });

  it("prioriza details como lista de strings", () => {
    expect(mensajeError(new ApiError(400, { message: "x", details: ["a", "b"] }))).toBe("a · b");
  });

  it("soporta details como string", () => {
    expect(mensajeError(new ApiError(400, { details: "solo texto" }))).toBe("solo texto");
  });

  it("soporta details con {errores}", () => {
    expect(mensajeError(new ApiError(400, { details: { errores: ["e1", "e2"] } }))).toBe("e1 · e2");
  });

  it("soporta details como array de objetos", () => {
    expect(mensajeError(new ApiError(400, { details: [{ msg: "m1" }, { message: "m2" }] }))).toBe("m1 · m2");
  });

  it("añade request_id en errores 500", () => {
    expect(mensajeError(new ApiError(500, { message: "Error interno", requestId: "abc" }))).toBe("Error interno (ID: abc)");
  });

  it("usa el fallback si no es ApiError", () => {
    expect(mensajeError(new Error("x"), "fallback")).toBe("fallback");
  });
});

describe("api", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve null en 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(204, null)));
    await expect(api("/x", { method: "POST" })).resolves.toBeNull();
  });

  it("devuelve el json en 200 (con body)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/x", { method: "POST", body: { a: 1 } })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lanza ApiError con code/message del contrato del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        resp(400, { error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas.", details: null, request_id: "r1" } })
      )
    );
    await expect(api("/auth/login", { auth: false })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_CREDENTIALS",
      requestId: "r1",
    });
  });

  it("cierra sesión ante SESSION_EXPIRED (401)", async () => {
    localStorage.setItem("igualab.sesion", JSON.stringify({ token: "t", rol: "administrador", nombre: "x" }));
    const handler = vi.fn();
    window.addEventListener(AUTH_401_EVENT, handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(resp(401, { error: { code: "SESSION_EXPIRED", message: "Expiró", details: null, request_id: "r" } }))
    );
    await expect(api("/usuarios")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalled();
    expect(localStorage.getItem("igualab.sesion")).toBeNull();
    window.removeEventListener(AUTH_401_EVENT, handler);
  });

  it("NO cierra sesión ante otros 401 (CURRENT_PASSWORD_INVALID)", async () => {
    localStorage.setItem("igualab.sesion", JSON.stringify({ token: "t", rol: "administrador", nombre: "x" }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(resp(401, { error: { code: "CURRENT_PASSWORD_INVALID", message: "mal", details: null, request_id: "r" } }))
    );
    await expect(api("/auth/mi-contrasena", { method: "PATCH" })).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem("igualab.sesion")).not.toBeNull();
  });

  it("envía FormData sin fijar Content-Type manual", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const fd = new FormData();
    fd.append("a", "1");
    await api("/x", { method: "POST", body: fd });
    const opts = fetchMock.mock.calls[0][1];
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.headers["Content-Type"]).toBeUndefined();
  });

  it("lanza NETWORK_ERROR si fetch falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(api("/x")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});

describe("apiArchivo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve el binario y el nombre del archivo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: { get: () => 'attachment; filename="r.pdf"' },
        blob: async () => new Blob(["%PDF"], { type: "application/pdf" }),
      }),
    );
    const r = await apiArchivo("/reportes/1/archivo");
    expect(r.nombre).toBe("r.pdf");
    expect(r.blob.type).toBe("application/pdf");
  });

  it("si falla, lanza ApiError con el contrato del backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(404, { error: { code: "REPORT_NOT_FOUND", message: "No existe", details: null, request_id: "r" } })));
    await expect(apiArchivo("/reportes/x/archivo")).rejects.toMatchObject({ status: 404, code: "REPORT_NOT_FOUND" });
  });
});

describe("opción indicadorGlobal", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("por defecto no muestra el indicador central; solo cuando se pide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(200, {})));
    const handler = vi.fn();
    globalThis.addEventListener(LOADING_START, handler);
    await api("/x");
    await api("/x", { indicadorGlobal: true });
    globalThis.removeEventListener(LOADING_START, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("nombreArchivoDe", () => {
  it("lee filename y prioriza filename* (UTF-8)", () => {
    expect(nombreArchivoDe('attachment; filename="a.pdf"')).toBe("a.pdf");
    expect(nombreArchivoDe("attachment; filename=b.pdf")).toBe("b.pdf");
    expect(nombreArchivoDe("attachment; filename=\"x.pdf\"; filename*=UTF-8''reporte%20%C3%B1.pdf")).toBe("reporte ñ.pdf");
  });

  it("devuelve null si no hay nombre", () => {
    expect(nombreArchivoDe(null)).toBeNull();
    expect(nombreArchivoDe("inline")).toBeNull();
    expect(nombreArchivoDe("attachment; filename=")).toBeNull();
  });
});
