import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, AUTH_401_EVENT, mensajeError } from "./client";

function resp(status: number, data: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  } as unknown as Response;
}

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

  it("lanza NETWORK_ERROR si fetch falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(api("/x")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
