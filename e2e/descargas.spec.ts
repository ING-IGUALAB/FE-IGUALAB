import { test, expect, entrarComo } from "./support/fixtures";

test.describe("Caso de uso: Descargar reportes", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/descargas");
    await expect(page.getByRole("heading", { name: "Descargar reportes" })).toBeVisible();
  });

  test("lista los reportes generados y filtra por sector y año", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(2);

    await page.getByLabel("Filtrar por sector").selectOption({ label: "Petróleo y Gas" });
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Sur S.A.");

    await page.getByLabel("Filtrar por sector").selectOption({ label: "Todo sector" });
    await page.getByLabel("Filtrar por año").selectOption("2023");
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Minera Andina S.A.A.");
  });

  test("descarga el PDF de un reporte", async ({ page }) => {
    const descarga = page.waitForEvent("download");
    await page.getByRole("row", { name: /Minera Andina S.A.A./ }).getByRole("button", { name: /Descargar/ }).click();

    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe("reporte-r-andina-2023.pdf");
  });
});
