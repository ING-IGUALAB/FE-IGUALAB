import { beforeEach, describe, expect, it } from "vitest";
import { getRol, getToken, guardarSesion, leerSesion, limpiarSesion } from "./token";
import type { SesionActual } from "../types";

const sesion: SesionActual = { token: "abc123", rol: "administrador", nombre: "María López" };

describe("token/sesion", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("guarda y lee la sesión", () => {
    guardarSesion(sesion);
    expect(leerSesion()).toEqual(sesion);
  });

  it("getToken y getRol devuelven los valores guardados", () => {
    guardarSesion(sesion);
    expect(getToken()).toBe("abc123");
    expect(getRol()).toBe("administrador");
  });

  it("devuelve null cuando no hay sesión", () => {
    expect(leerSesion()).toBeNull();
    expect(getToken()).toBeNull();
    expect(getRol()).toBeNull();
  });

  it("limpia la sesión", () => {
    guardarSesion(sesion);
    limpiarSesion();
    expect(leerSesion()).toBeNull();
  });

  it("devuelve null si el JSON está corrupto", () => {
    localStorage.setItem("igualab.sesion", "{no-es-json");
    expect(leerSesion()).toBeNull();
  });

  it("devuelve null si falta el token", () => {
    localStorage.setItem("igualab.sesion", JSON.stringify({ rol: "administrador", nombre: "x" }));
    expect(leerSesion()).toBeNull();
  });
});
