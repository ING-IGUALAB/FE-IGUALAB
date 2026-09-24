import { describe, expect, it } from "vitest";
import { passwordValida, REGLAS_PASSWORD } from "./password";

describe("passwordValida", () => {
  it("acepta una contrasena que cumple todas las reglas", () => {
    expect(passwordValida("ClaveSegura1!", "usuario@igualab.pe")).toBe(true);
  });

  it("rechaza una contrasena igual al correo sin distinguir mayusculas", () => {
    expect(passwordValida("Usuario@Igualab.Pe", "usuario@igualab.pe")).toBe(false);
  });

  it("rechaza por longitud menor a 8", () => {
    expect(passwordValida("Ab1!", "u@i.pe")).toBe(false);
  });

  it("rechaza si falta una mayuscula", () => {
    expect(passwordValida("clavesegura1!")).toBe(false);
  });

  it("rechaza si falta una minuscula", () => {
    expect(passwordValida("CLAVESEGURA1!")).toBe(false);
  });

  it("rechaza si falta un digito", () => {
    expect(passwordValida("ClaveSegura!")).toBe(false);
  });

  it("rechaza si falta un caracter especial", () => {
    expect(passwordValida("ClaveSegura1")).toBe(false);
  });

  it("acepta sin correo de referencia", () => {
    expect(passwordValida("ClaveSegura1!")).toBe(true);
  });

  it("expone 6 reglas de validacion", () => {
    expect(REGLAS_PASSWORD).toHaveLength(6);
  });
});
