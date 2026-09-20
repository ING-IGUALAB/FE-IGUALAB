import { describe, expect, it } from "vitest";
import { passwordValida } from "./password";

describe("passwordValida", () => {
  it("acepta una contrasena que cumple todas las reglas", () => {
    expect(passwordValida("ClaveSegura1!", "usuario@igualab.pe")).toBe(true);
  });

  it("rechaza una contrasena igual al correo sin distinguir mayusculas", () => {
    expect(passwordValida("Usuario@Igualab.Pe", "usuario@igualab.pe")).toBe(false);
  });
});
