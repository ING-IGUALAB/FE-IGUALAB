import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function consultar(page: Page, sector: string, empresa: string, anio: number) {
  await campo(page, "Sector").selectOption({ label: sector });
  await campo(page, "Empresa").selectOption({ label: empresa });
  await campo(page, "Año").selectOption(String(anio));
  await page.getByRole("button", { name: "Consultar análisis" }).click();
}

const estadoDe = (page: Page, estandar: string) => page.getByRole("combobox", { name: `Estado de ${estandar}` });

test.describe("Caso de uso: Analizar y validar códigos GRI", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/analisis");
    await expect(page.getByRole("heading", { name: "Análisis y validación GRI" })).toBeVisible();
  });

  test("el año solo ofrece los años en que la empresa tiene documentos subidos", async ({ page }) => {
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });

    // Se revisan todos los años posibles (2020 al actual) y solo queda el que tiene documentos.
    await expect(campo(page, "Año").locator("option")).toHaveText(["2024"]);
  });

  test("una empresa sin documentos no ofrece años ni permite consultar", async ({ page }) => {
    await campo(page, "Sector").selectOption({ label: "Energía" });
    await campo(page, "Empresa").selectOption({ label: "Utec ELEC S.A." });

    await expect(campo(page, "Año")).toBeDisabled();
    await expect(campo(page, "Año").locator("option")).toHaveText(["Sin documentos"]);
    await expect(page.getByText("Esta empresa aún no tiene documentos subidos.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Consultar análisis" })).toBeDisabled();
  });

  test("muestra los códigos GRI con su evidencia y las sanciones", async ({ page }) => {
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);

    await expect(page.getByText("Pendiente de estados")).toBeVisible();
    await expect(page.getByText("0 de 2 con estado asignado")).toBeVisible();
    await expect(page.getByText("Requiere revisión")).toBeVisible();
    await expect(page.getByRole("cell", { name: "59.078 UIT", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "OEFA", exact: true })).toBeVisible();
  });

  test("al asignar estado a todos los códigos queda listo para validar", async ({ page, api }) => {
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);

    await estadoDe(page, "GRI 305 (2016)").selectOption("OK");
    await expect(page.getByText("GRI 305 (2016): OK.")).toBeVisible();
    await expect(page.getByText("Falta 1 código GRI por asignar estado")).toBeVisible();

    await estadoDe(page, "GRI 102 (edición sin resolver)").selectOption({ label: "Baja sustancia" });
    await expect(page.getByText("Listo para validar")).toBeVisible();
    await expect(page.getByText("75.0", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validar análisis" })).toBeEnabled();

    expect(api.llamadasA("PUT", /\/codigos\/305%3A2016\/estado$/)[0].cuerpo).toEqual({ estado: "OK", version_fila_esperada: 0 });
  });

  test("valida el análisis y, si luego cambia un estado, la validación pierde vigencia", async ({ page }) => {
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);
    await estadoDe(page, "GRI 305 (2016)").selectOption("OK");
    await expect(page.getByText("GRI 305 (2016): OK.")).toBeVisible();
    await estadoDe(page, "GRI 102 (edición sin resolver)").selectOption({ label: "Baja sustancia" });
    await expect(page.getByText("Listo para validar")).toBeVisible();

    await page.getByRole("button", { name: "Validar análisis" }).click();
    await expect(page.getByText("Análisis validado.")).toBeVisible();
    await expect(page.getByText("Definitivo · promedio de 2 códigos GRI")).toBeVisible();
    await expect(page.getByText("Vigente", { exact: true })).toBeVisible();

    await estadoDe(page, "GRI 102 (edición sin resolver)").selectOption({ label: "Sub-reportado" });
    await expect(page.getByText("La validación anterior quedó sin vigencia")).toBeVisible();
    await expect(page.getByText("Sin vigencia", { exact: true })).toBeVisible();
    await expect(page.getByText("Perdió vigencia porque cambiaron estados de códigos GRI.")).toBeVisible();
  });

  test("si otro usuario cambió el código, no lo sobrescribe y recarga", async ({ page, api }) => {
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);
    await expect(page.getByText("Pendiente de estados")).toBeVisible();

    api.cambiarEstadoPorFuera("e-andina", 2024, "305:2016", "SUB_REPORTADO");
    await estadoDe(page, "GRI 305 (2016)").selectOption("OK");

    await expect(page.getByText("Este código cambió desde que lo consultaste. Se actualizó el análisis.")).toBeVisible();
    await expect(estadoDe(page, "GRI 305 (2016)")).toHaveValue("SUB_REPORTADO");
  });

  test("el historial registra quién cambió cada estado", async ({ page }) => {
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);
    await estadoDe(page, "GRI 305 (2016)").selectOption("OK");
    await expect(page.getByText("GRI 305 (2016): OK.")).toBeVisible();

    await page.getByRole("button", { name: "Historial de cambios" }).click();
    const fila = page.getByRole("dialog").getByRole("row", { name: /GRI 305 \(2016\)/ });
    await expect(fila).toContainText("Sin estado → OK");
    await expect(fila).toContainText("Ana García");
  });
});
