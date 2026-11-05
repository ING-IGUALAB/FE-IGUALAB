import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function elegir(page: Page, sector: string, empresa: string, anio: number) {
  await campo(page, "Sector").selectOption({ label: sector });
  await campo(page, "Empresa").selectOption({ label: empresa });
  await campo(page, "Año").selectOption(String(anio));
}
const elegirAndina = (page: Page, anio: number) => elegir(page, "Minería", "Minera Andina S.A.A.", anio);
const aviso = (page: Page, texto: string) => page.locator("[data-sonner-toast]", { hasText: texto });

test.describe("Caso de uso: Generar reporte de prospección", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/reportes");
    await expect(page.getByRole("heading", { name: "Reportes de prospección" })).toBeVisible();
  });

  test("cada año muestra su situación; sin revisar explica qué falta y lleva a Análisis GRI", async ({ page, api }) => {
    await elegirAndina(page, 2024);

    await expect(campo(page, "Año").locator("option")).toHaveText(["2024 · Pendiente de revisión", "2023 · Reporte actualizado"]);
    await expect(page.getByText("Asigna los estados GRI pendientes antes de emitir el reporte.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista previa" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Generar reporte" })).toBeDisabled();

    await page.getByRole("button", { name: "Ir a Análisis GRI" }).click();
    await expect(page).toHaveURL(/\/analisis$/);
    await expect(campo(page, "Empresa")).toHaveValue("e-andina");
    await expect(campo(page, "Año")).toHaveValue("2024");
    expect(api.reportes).toHaveLength(2);
  });

  test("con una validación vigente sin emitir habilita la vista previa y la generación", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });

    await expect(campo(page, "Año")).toHaveValue("2024");
    await expect(campo(page, "Año").locator("option").first()).toHaveText("2024 · Validado");
    await expect(page.getByText("La validación está lista")).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista previa" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Generar reporte" })).toBeEnabled();
  });

  test("emite la versión 1, la muestra en recientes y ofrece descargarla como actualizada", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    await page.getByRole("button", { name: "Generar reporte" }).click();

    await expect(page.getByText("Versión 1 de Minera Andina S.A.A. (2024) emitida correctamente.")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText("2024");
    await expect(page.locator("tbody tr").first()).toContainText("v1");
    expect(api.llamadasA("POST", "/reportes")[0].cuerpo).toEqual({ empresa_id: "e-andina", anio: 2024 });

    await expect(page.getByRole("button", { name: "Generar" })).toHaveCount(0);
    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar reporte actualizado" }).click();
    expect((await descarga).suggestedFilename()).toBe("reporte-prospeccion-minera-andina-s-a-a-2024-v1.pdf");
    expect(api.llamadasA("GET", "/reportes/vigente/archivo")).toHaveLength(1);
  });

  test("con un reporte actualizado no ofrece otro y ya no dice que no se puede regenerar", async ({ page }) => {
    await elegirAndina(page, 2023);

    await expect(page.getByText("El reporte está actualizado")).toBeVisible();
    await expect(page.getByText("Última emisión: versión 1")).toBeVisible();
    await expect(page.getByText("Generada el", { exact: false })).toContainText("por Ana García");
    await expect(page.getByRole("button", { name: "Descargar reporte actualizado" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Generar/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /histórica/ })).toHaveCount(0);
    await expect(page.getByText("los reportes no se vuelven a generar")).toHaveCount(0);
  });

  test("«Ver historial» lleva a Descargar reportes con esa versión resaltada", async ({ page }) => {
    await elegirAndina(page, 2023);
    await page.getByRole("button", { name: "Ver historial (1)" }).click();

    await expect(page).toHaveURL(/\/descargas$/);
    await expect(page.getByLabel("Filtrar por sector")).toHaveValue("MINERIA");
    await expect(page.getByLabel("Filtrar por año")).toHaveValue("2023");
    await expect(page.locator("tr[aria-current='true']")).toContainText("Minera Andina S.A.A.");
  });

  test("una validación nueva permite emitir la versión 2 y la versión 1 sigue disponible", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2023);
    await elegirAndina(page, 2023);

    await expect(campo(page, "Año").locator("option:checked")).toHaveText("2023 · Validación nueva sin reporte");
    await expect(page.getByText("Hay una validación nueva sin reporte")).toBeVisible();
    await expect(page.getByText("No actualizado")).toBeVisible();
    await expect(page.getByText("Validación actual: 2 · Validación del reporte: 1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar versión 1 — histórica" })).toBeVisible();
    await page.getByRole("button", { name: "Generar nueva versión" }).click();

    await expect(page.getByText("Versión 2 de Minera Andina S.A.A. (2023) emitida correctamente.")).toBeVisible();
    await expect(page.getByText("Última emisión: versión 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar reporte actualizado" })).toBeVisible();
    await expect(page.getByRole("button", { name: /histórica/ })).toHaveCount(0);
    expect(api.reportes.filter((r) => r.empresa_id === "e-andina" && r.anio === 2023).map((r) => r.version)).toEqual([2, 1]);
    // El cuerpo no lleva el número de versión: lo decide el servidor.
    expect(api.llamadasA("POST", "/reportes")[0].cuerpo).toEqual({ empresa_id: "e-andina", anio: 2023 });
  });

  test("si otra persona ya emitió esa validación, la reutiliza sin crear otra fila", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    await expect(page.getByRole("button", { name: "Generar reporte" })).toBeEnabled();
    api.emitirReportePorFuera("e-andina", 2024);
    await page.getByRole("button", { name: "Generar reporte" }).click();

    await expect(page.getByText("Esta validación ya tenía un reporte: versión 1 de Minera Andina S.A.A. (2024).")).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar reporte actualizado" })).toBeVisible();
    expect(api.reportes).toHaveLength(3);
  });

  test("con cambios sin validar no anuncia actualizado y deja la versión como histórica", async ({ page, api }) => {
    api.invalidarAnalisisPorFuera("e-andina", 2023);
    await elegirAndina(page, 2023);

    await expect(page.getByText("El análisis cambió después de la última validación")).toBeVisible();
    await expect(page.getByText("No actualizado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generar nueva versión" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Vista previa" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Descargar reporte actualizado" })).toHaveCount(0);

    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar versión 1 — histórica" }).click();
    expect((await descarga).suggestedFilename()).toBe("reporte-prospeccion-minera-andina-s-a-a-2023-v1.pdf");
    expect(api.llamadasA("GET", "/reportes/r-andina-2023/archivo")).toHaveLength(1);
    expect(api.llamadasA("GET", "/reportes/vigente/archivo")).toHaveLength(0);
  });

  test("un reporte de origen no verificable no se presenta como actualizado", async ({ page, api }) => {
    const previo = api.reportes.find((r) => r.id === "r-andina-2023")!;
    Object.assign(previo, { validacion_id: null, validacion_numero: null });
    await elegirAndina(page, 2023);

    await expect(page.getByText("Origen no verificable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generar nueva versión" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Descargar versión 1 — histórica" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar reporte actualizado" })).toHaveCount(0);
  });

  test("si dejó de estar actualizado al descargar, lo explica, no baja nada y muestra la nueva situación", async ({ page, api }) => {
    await elegirAndina(page, 2023);
    const boton = page.getByRole("button", { name: "Descargar reporte actualizado" });
    await expect(boton).toBeEnabled();
    api.validarAnalisisPorFuera("e-andina", 2023);

    let descargas = 0;
    page.on("download", () => { descargas += 1; });
    await boton.click();

    await expect(aviso(page, "Hay una validación nueva: genera una nueva versión del reporte.")).toHaveAttribute("data-type", "warning");
    await expect(page.getByRole("button", { name: "Generar nueva versión" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Descargar versión 1 — histórica" })).toBeVisible();
    expect(descargas).toBe(0);
  });

  test("si el origen cambia durante la emisión lo avisa y vuelve a consultar", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    await expect(page.getByRole("button", { name: "Generar reporte" })).toBeEnabled();
    const consultas = api.llamadasA("GET", "/reportes/disponibilidad").length;
    api.fallarProxima("POST", "/reportes", 409, "REPORT_SOURCE_CHANGED", "Texto del servidor.");
    await page.getByRole("button", { name: "Generar reporte" }).click();

    await expect(aviso(page, "El análisis cambió mientras se generaba el reporte.")).toBeVisible();
    await expect.poll(() => api.llamadasA("GET", "/reportes/disponibilidad").length).toBeGreaterThan(consultas);
    expect(api.reportes).toHaveLength(2);
  });

  test("si se pierde la respuesta al emitir no afirma que falló y vuelve a consultar", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    const boton = page.getByRole("button", { name: "Generar reporte" });
    await expect(boton).toBeEnabled();
    // El servidor sí alcanza a emitir, pero la respuesta nunca llega.
    await page.route("**/reportes", (ruta) => {
      if (ruta.request().method() !== "POST") return ruta.fallback();
      api.emitirReportePorFuera("e-andina", 2024);
      return ruta.abort();
    });
    await boton.click();

    await expect(aviso(page, "No recibimos la confirmación del servidor.")).toBeVisible();
    await expect(page.getByText("Última emisión: versión 1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar reporte actualizado" })).toBeVisible();
  });

  test("si no puede consultar la situación de la empresa, deja reintentar", async ({ page, api }) => {
    api.fallarProxima("GET", "/reportes/disponibilidad", 503, "SERVICE_UNAVAILABLE", "No disponible.");
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });

    await expect(page.getByText("No se pudo consultar la situación de esta empresa.")).toBeVisible();
    await page.getByRole("button", { name: "Volver a intentarlo" }).click();
    await expect(campo(page, "Año")).toHaveValue("2024");
  });

  test("un 404 de la última emisión no deja la pantalla inestable", async ({ page, api }) => {
    api.fallarProxima("GET", "/reportes/vigente", 404, "REPORT_NOT_FOUND", "No hay reportes para ese año.");
    await elegirAndina(page, 2023);

    await expect(page.getByRole("button", { name: "Descargar reporte actualizado" })).toBeVisible();
    await expect(page.getByText("Última emisión: versión 1")).toBeVisible();
    await expect(aviso(page, "No hay reportes")).toHaveCount(0);
    expect(api.llamadasA("GET", "/reportes/vigente").length).toBeLessThanOrEqual(2);
  });

  test("si el servidor no puede armar el PDF, lo muestra como error (rojo)", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    api.fallarProxima("POST", "/reportes/vista-previa", 502, "PDF_GENERATION_ERROR", "No se pudo compilar el PDF.");
    await elegirAndina(page, 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();

    const error = aviso(page, "No se pudo compilar el PDF.");
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute("data-type", "error");
  });

  test("una respuesta que no es un PDF no se muestra como tal", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    await page.route("**/reportes/vista-previa", (ruta) => ruta.fulfill({ status: 200, contentType: "text/html", body: "<html>proxy</html>" }));
    await page.getByRole("button", { name: "Vista previa" }).click();

    await expect(aviso(page, "El servidor no devolvió un PDF.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toHaveCount(0);
  });

  test("la vista previa sin emitir lo advierte, no crea historial y se dibuja solo para leer", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();

    const visor = page.getByRole("region", { name: "Vista previa del reporte" });
    const hoja = visor.getByRole("img", { name: "Página 1 de 1" });
    await expect(hoja).toBeVisible();
    await expect(page.getByText("Vista previa sin emitir; la versión y fecha definitivas se confirman al generar")).toBeVisible();
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

  test("la vista previa de una validación ya emitida indica la versión y no crea otra", async ({ page, api }) => {
    await elegirAndina(page, 2023);
    await page.getByRole("button", { name: "Vista previa" }).click();

    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toBeVisible();
    await expect(page.getByText("Reporte emitido: versión 1")).toBeVisible();
    await expect(page.getByText("Vista previa sin emitir")).toHaveCount(0);
    expect(api.reportes).toHaveLength(2);
  });

  test("emitir retira la vista previa anterior", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toBeVisible();

    await page.getByRole("button", { name: "Generar reporte" }).click();
    await expect(page.getByText("Versión 1 de Minera Andina S.A.A. (2024) emitida correctamente.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toHaveCount(0);
  });

  test("al cambiar de empresa o año, la vista previa anterior deja de mostrarse", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    await elegirAndina(page, 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toBeVisible();

    await campo(page, "Año").selectOption("2023");
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toHaveCount(0);
    await expect(page.getByText("Elige empresa y año y pulsa «Vista previa»")).toBeVisible();
  });

  test("una vista previa que llega tarde no aparece bajo otro año", async ({ page, api }) => {
    api.validarAnalisisPorFuera("e-andina", 2024);
    api.retrasar("POST", /\/reportes\/vista-previa$/, 800);
    await elegirAndina(page, 2024);
    await page.getByRole("button", { name: "Vista previa" }).click();
    await campo(page, "Año").selectOption("2023");

    await expect(page.getByRole("button", { name: "Vista previa" })).toBeEnabled();
    await expect(page.getByRole("img", { name: "Página 1 de 1" })).toHaveCount(0);
    await expect(page.getByText("Elige empresa y año y pulsa «Vista previa»")).toBeVisible();
  });

  test("descarga el PDF de un reporte reciente", async ({ page }) => {
    const descarga = page.waitForEvent("download");
    await page.getByRole("row", { name: /Petro Sur S.A./ }).getByRole("button", { name: /Descargar/ }).click();

    expect((await descarga).suggestedFilename()).toBe("reporte-prospeccion-petro-sur-s-a-2024-v1.pdf");
    await expect(page.getByText("Descarga iniciada.")).toBeVisible();
  });
});
