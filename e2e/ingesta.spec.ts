import { test, expect, entrarComo, campo } from "./support/fixtures";

const archivoMd = (name: string, contenido = "# Reporte de sostenibilidad\n\nGRI 305-1: emisiones directas.\n") => ({
  name,
  mimeType: "text/markdown",
  buffer: Buffer.from(contenido),
});

test.describe("Caso de uso: Ingestar documentos", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/ingesta");
    await expect(page.getByRole("heading", { name: "Ingesta de documentos" })).toBeVisible();
  });

  test("sube un .md y aparece en Documentos ingestados", async ({ page, api }) => {
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    await campo(page, "Año").selectOption("2025");
    await campo(page, "Tipo").selectOption({ label: "Reporte de Sostenibilidad GRI" });
    await page.locator('input[type="file"]').setInputFiles(archivoMd("gri-andina-2025.md"));
    await page.getByRole("button", { name: "Realizar ingesta" }).click();

    await expect(page.getByText("Documento ingestado e indexado.")).toBeVisible();
    await expect(page.getByText("Ingesta completada")).toBeVisible();
    await expect(page.locator("tbody")).toContainText("gri-andina-2025.md");
    expect(api.llamadasA("POST", /\/ingesta$/)[0].cuerpo).toMatchObject({
      archivo: "gri-andina-2025.md",
      empresa_id: "e-andina",
      anio: "2025",
      tipo_documento: "REPORTE_SOSTENIBILIDAD_GRI",
    });
  });

  test("rechaza archivos que no son Markdown o están vacíos", async ({ page, api }) => {
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    const entrada = page.locator('input[type="file"]');

    await entrada.setInputFiles({ name: "memoria.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText("El archivo debe tener extensión .md.")).toBeVisible();

    await entrada.setInputFiles(archivoMd("vacio.md", ""));
    await expect(page.getByText("El archivo está vacío.")).toBeVisible();

    await expect(page.getByRole("button", { name: "Realizar ingesta" })).toBeDisabled();
    expect(api.llamadasA("POST", "/documentos/operaciones")).toHaveLength(0);
  });

  test("al elegir sector solo ofrece las empresas activas de ese sector", async ({ page }) => {
    await campo(page, "Sector").selectOption({ label: "Petróleo y Gas" });
    // Petro Norte está desactivada: no debe ofrecerse para nuevas cargas.
    await expect(campo(page, "Empresa").locator("option")).toHaveText([
      "— Selecciona una empresa —",
      "Petro Sur S.A.",
    ]);
  });

  test("filtra la lista de documentos por sector", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);

    await page.getByLabel("Filtrar por sector").selectOption({ label: "Petróleo y Gas" });
    await expect(filas).toHaveCount(2);
    await expect(page.locator("tbody")).toContainText("Petro Sur S.A.");
    await expect(page.locator("tbody")).not.toContainText("Minera Andina S.A.A.");
  });

  test("muestra el detalle de un documento", async ({ page }) => {
    await page.getByRole("row", { name: /memoria-andina-2024.md/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Detalle del documento")).toBeVisible();
    await expect(dialogo).toContainText("Minera Andina S.A.A.");
    await expect(dialogo).toContainText("Memoria Anual");
    await expect(dialogo).toContainText("memoria-andina-2024.md");
  });

  test("los documentos de una empresa desactivada se ven como Inactivo", async ({ page }) => {
    const fila = page.getByRole("row", { name: /memoria-petro-norte-2025.md/ });
    await expect(fila).toContainText("Inactivo");

    await fila.click();
    await expect(page.getByRole("dialog")).toContainText("La empresa de este documento está desactivada en el catálogo.");
  });
});
