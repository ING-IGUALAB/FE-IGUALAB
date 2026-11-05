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

  test("cada año muestra si está validado; sin validar explica qué falta y lleva a validarlo", async ({ page, api }) => {
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2024);

    // Se ve antes de pulsar nada: años con su estado, botones desactivados y el motivo.
    await expect(campo(page, "Año").locator("option")).toHaveText(["2024 · Sin validar", "2023 · Reporte generado"]);
    await expect(page.getByText("El análisis GRI de este año aún no está validado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista previa" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Generar reporte" })).toBeDisabled();

    // El enlace abre Análisis GRI con esa empresa y año, ya consultado.
    await page.getByRole("button", { name: "Ir a validarlo en Análisis GRI" }).click();
    await expect(page).toHaveURL(/\/analisis$/);
    await expect(campo(page, "Empresa")).toHaveValue("e-andina");
    await expect(campo(page, "Año")).toHaveValue("2024");
    await expect(page.getByText("Pendiente de estados")).toBeVisible();
    expect(api.reportes).toHaveLength(2);
  });

  test("con el análisis validado lo indica y habilita la vista previa y la generación", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });

    // Sin tocar el año, queda elegido el más reciente con documentos (no el del reporte de 2023).
    await expect(campo(page, "Año")).toHaveValue("2024");
    await expect(campo(page, "Año").locator("option").first()).toHaveText("2024 · Validado");
    await expect(page.getByText("Análisis validado: ya puedes ver la vista previa y generar el reporte.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista previa" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Generar reporte" })).toBeEnabled();
  });

  test("si ya existe el reporte, ofrece verlo y lleva a Descargar reportes con ese reporte resaltado", async ({ page }) => {
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2023);
    await expect(page.getByText("Ya existe el reporte de esta empresa y año")).toBeVisible();
    await page.getByRole("button", { name: "Ver reporte generado" }).click();

    await expect(page).toHaveURL(/\/descargas$/);
    await expect(page.getByLabel("Filtrar por sector")).toHaveValue("MINERIA");
    await expect(page.getByLabel("Filtrar por año")).toHaveValue("2023");
    const fila = page.locator("tr[aria-current='true']");
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText("Minera Andina S.A.A.");
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  });

  test("si otro usuario lo generó recién, no muestra alerta y lleva a descargarlo", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2024);
    // Lo genera otra persona después de que se cargó la pantalla.
    api.reportes.unshift({ id: "r-andina-2024", empresa_id: "e-andina", anio: 2024, generado_por: "u-otro", sha256: "ab".repeat(32), creado_en: "2026-10-20T10:00:00Z" });
    await page.getByRole("button", { name: "Generar reporte" }).click();

    await expect(page).toHaveURL(/\/descargas$/);
    await expect(page.locator("tr[aria-current='true']")).toContainText("2024");
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    expect(api.reportes).toHaveLength(3);
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

    const visor = page.getByRole("region", { name: "Vista previa del reporte" });
    const hoja = visor.getByRole("img", { name: "Página 1 de 1" });
    await expect(hoja).toBeVisible();
    await expect(page.getByText("No se guarda en el historial")).toBeVisible();
    expect(api.reportes).toHaveLength(2);

    // La hoja tiene contenido dibujado (no está en blanco).
    const conTinta = await hoja.evaluate((c: HTMLCanvasElement) => {
      const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      return data.some((v, i) => i % 4 !== 3 && v < 128);
    });
    expect(conTinta).toBe(true);

    // Solo se lee: sin el visor de PDF del navegador ni su menú de guardar imagen.
    await expect(page.locator("iframe, embed, object")).toHaveCount(0);
    expect(await hoja.evaluate((c) => !c.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })))).toBe(true);
  });

  test("al cambiar de empresa o año, la vista previa anterior deja de mostrarse", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegir(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toBeVisible();

    await campo(page, "Año").selectOption("2023");
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toHaveCount(0);
    await expect(page.getByText("Elige empresa y año y pulsa «Vista previa»")).toBeVisible();
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
