import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function consultar(page: Page, sector: string, empresa: string, anio: number) {
  await campo(page, "Sector").selectOption({ label: sector });
  await campo(page, "Empresa").selectOption({ label: empresa });
  await campo(page, "Año").selectOption(String(anio));
  await page.getByRole("button", { name: "Consultar análisis" }).click();
}

const MARCAS = ["<br", "**", "###", "<mark", "</u>", "](#", "--_--", "&amp;"];
async function sinMarcas(texto: string) {
  for (const m of MARCAS) expect(texto, `quedó «${m}» sin limpiar`).not.toContain(m);
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

  test("las evidencias y sanciones se leen limpias aunque el documento traiga Markdown o HTML", async ({ page, api }) => {
    const estado = api.analisis.get("e-andina:2024")!;
    estado.filas[0].evidencias[0] = { ...estado.filas[0].evidencias[0], cita: "### Residuos GRI 306-3: se generaron **86** toneladas.<br />De ellas, 61", seccion: "**Gestión** ambiental<br>2025" };
    estado.sanciones[0] = { ...estado.sanciones[0], cita: "La empresa recibió una <mark>multa</mark> del OEFA --_-- [ver](#resolucion)", seccion: "## Cumplimiento" };
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);

    await expect(page.getByText("Residuos GRI 306-3: se generaron 86 toneladas. De ellas, 61")).toBeVisible();
    await expect(page.getByText("memoria-andina-2024.md · Gestión ambiental 2025")).toBeVisible();
    await expect(page.getByText("La empresa recibió una multa del OEFA ver")).toBeVisible();
    await sinMarcas(await page.locator("main").innerText());
  });

  test("muestra los códigos GRI con su evidencia y las sanciones", async ({ page }) => {
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);

    await expect(page.getByText("Pendiente de estados")).toBeVisible();
    await expect(page.getByText("0 de 2 con estado asignado")).toBeVisible();
    await expect(page.getByText("Requiere revisión")).toBeVisible();
    await expect(page.getByRole("cell", { name: "59.078 UIT", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "OEFA", exact: true })).toBeVisible();
  });

  test("el «?» junto a «Requiere revisión» explica la advertencia con el texto del catálogo", async ({ page }) => {
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);
    const ayuda = page.getByRole("button", { name: "¿Qué significa «Requiere revisión» en GRI 102 (edición sin resolver)?" });
    const panel = page.getByRole("dialog", { name: "¿Qué significa «Requiere revisión» en GRI 102 (edición sin resolver)?" });
    // Solo el código que requiere revisión tiene ayuda.
    await expect(page.getByRole("button", { name: /^¿Qué significa «Requiere revisión» en GRI 305/ })).toHaveCount(0);

    // Al pasar el mouse aparece y al salir se va.
    await ayuda.hover();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Edición del estándar sin precisar");
    await expect(panel).toContainText("Qué significa: Este estándar GRI tiene más de una edición");
    await expect(panel).toContainText("Por qué aparece:");
    await expect(panel).toContainText("Qué hacer: Revisa las evidencias");
    await expect(panel).toContainText("Ediciones posibles de este estándar: 2016, 2021.");
    await page.mouse.move(5, 5);
    await expect(panel).toHaveCount(0);

    // Con un clic queda fija; se cierra con Escape o con un clic fuera.
    await ayuda.click();
    await page.mouse.move(5, 5);
    await expect(panel).toBeVisible();
    await expect(ayuda).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await ayuda.click();
    await expect(panel).toBeVisible();
    await page.getByRole("heading", { name: "Códigos GRI" }).click();
    await expect(panel).toHaveCount(0);
  });

  test("las advertencias del análisis también tienen su explicación", async ({ page, api }) => {
    api.analisis.get("e-andina:2024")!.advertencias = [
      { codigo: "MARKDOWN_TABLE_INCONSISTENT", categoria: "calidad_documento", mensaje: "Tablas con columnas inconsistentes.", documento_nombre: "memoria-andina-2024.md" },
    ];
    await consultar(page, "Minería", "Minera Andina S.A.A.", 2024);
    await expect(page.getByText("Tablas con columnas inconsistentes.")).toBeVisible();

    await page.getByRole("button", { name: "¿Qué significa «Tabla con formato irregular»?" }).click();
    await expect(page.getByRole("dialog", { name: "¿Qué significa «Tabla con formato irregular»?" })).toContainText("Suele ocurrir al convertir el PDF a Markdown");
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
