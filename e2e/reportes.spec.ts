import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function elegir(page: Page, sector: string, empresa: string, anio: number) {
  await campo(page, "Sector").selectOption({ label: sector });
  await campo(page, "Empresa").selectOption({ label: empresa });
  await campo(page, "Año").selectOption(String(anio));
}

test.describe("Caso de uso: Generar reporte de prospección", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/reportes");
    await expect(page.getByRole("heading", { name: "Reportes de prospección" })).toBeVisible();
  });

  test("sin análisis GRI validado, informa el motivo y no genera", async ({ page, api }) => {
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "Generar reporte" }).click();

    const aviso = page.locator("[data-sonner-toast]", { hasText: "El análisis GRI de esta empresa y año no está validado." });
    await expect(aviso).toBeVisible();
    // Es una condición pendiente (409), no una falla: se muestra como advertencia (amarillo), no como error.
    await expect(aviso).toHaveAttribute("data-type", "warning");
    expect(api.reportes).toHaveLength(2);
  });

  test("si el servidor no puede armar el PDF, lo muestra como error (rojo)", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    api.fallarProxima("POST", "/reportes/vista-previa", 502, "PDF_GENERATION_ERROR", "No se pudo compilar el PDF.");
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();

    const aviso = page.locator("[data-sonner-toast]", { hasText: "No se pudo compilar el PDF." });
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveAttribute("data-type", "error");
  });

  test("con el análisis validado muestra la vista previa del PDF sin guardarla", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();

    const visor = page.getByTitle("Vista previa del reporte");
    await expect(visor).toBeVisible();
    await expect(visor).toHaveAttribute("src", /^blob:/);
    await expect(page.getByText("No se guarda en el historial")).toBeVisible();
    expect(api.reportes).toHaveLength(2);
  });

  test("genera el reporte y aparece en Reportes recientes", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "Generar reporte" }).click();

    await expect(page.getByText("Reporte de Minera Andina S.A.A. (2024) generado.")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText("2024");
    expect(api.llamadasA("POST", "/reportes")[0].cuerpo).toEqual({ empresa_id: "e-andina", anio: 2024 });
  });

  test("descarga el PDF de un reporte reciente", async ({ page }) => {
    const descarga = page.waitForEvent("download");
    await page.getByRole("row", { name: /Petro Sur S.A./ }).getByRole("button", { name: /Descargar/ }).click();

    expect((await descarga).suggestedFilename()).toBe("reporte-r-psur-2024.pdf");
    await expect(page.getByText("Descarga iniciada.")).toBeVisible();
  });
});
