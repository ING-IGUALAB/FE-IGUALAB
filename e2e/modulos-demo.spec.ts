import { test, expect, entrarComo } from "./support/fixtures";

// Módulos que aún usan datos de demostración (el backend no expone sus endpoints).
// Solo se comprueba que cargan; cuando tengan backend, se amplían como el resto.
test.describe("Módulos en demostración: cargan sin errores", () => {
  test("Reportes de prospección", async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/reportes");
    await expect(page.getByRole("heading", { name: "Reportes de prospección" })).toBeVisible();
  });

  test("Descargar reportes", async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/descargas");
    await expect(page.getByRole("heading", { name: "Descargar reportes" })).toBeVisible();
  });

  test("Auditoría de eventos", async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/auditoria");
    await expect(page.getByRole("heading", { name: "Auditoría de eventos" })).toBeVisible();
  });
});
