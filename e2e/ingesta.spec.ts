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

    // Los filtros están plegados en el botón «Filtros», que además indica cuántos hay activos.
    const filtros = page.getByRole("button", { name: /^Filtros/ });
    await expect(page.getByLabel("Filtrar por sector")).toHaveCount(0);
    await filtros.click();
    await page.getByLabel("Filtrar por sector").selectOption({ label: "Petróleo y Gas" });
    await expect(filas).toHaveCount(2);
    await expect(page.locator("tbody")).toContainText("Petro Sur S.A.");
    await expect(page.locator("tbody")).not.toContainText("Minera Andina S.A.A.");

    await filtros.click();
    await expect(page.getByLabel("Filtrar por sector")).toHaveCount(0);
    await expect(filtros).toContainText("1");
    await expect(filas).toHaveCount(2);

    await filtros.click();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(filas).toHaveCount(4);
  });

  test("busca por una parte del nombre de la empresa, sin distinguir mayúsculas ni tildes", async ({ page, api }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);
    const antes = api.llamadasA("GET", "/documentos").length;
    const buscar = page.getByRole("searchbox", { name: "Buscar por empresa" });

    await buscar.pressSequentially("PETRO");
    await expect(filas).toHaveCount(2);
    await expect(page.locator("tbody")).not.toContainText("Minera Andina S.A.A.");
    // Se traen los documentos una sola vez, no una petición por cada letra.
    expect(api.llamadasA("GET", "/documentos").length - antes).toBe(1);

    await buscar.fill("minéra");
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Minera Andina S.A.A.");

    await buscar.fill("no existe");
    await expect(page.getByText("No hay documentos que coincidan con la búsqueda y los filtros.")).toBeVisible();

    await page.getByRole("button", { name: "Borrar búsqueda" }).click();
    await expect(buscar).toHaveValue("");
    await expect(filas).toHaveCount(4);
  });

  test("la búsqueda se combina con los filtros", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);
    await page.getByRole("searchbox", { name: "Buscar por empresa" }).fill("petro");
    await expect(filas).toHaveCount(2);

    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByLabel("Filtrar por tipo").selectOption({ label: "Memoria Anual" });
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Norte S.A.");
  });

  test("muestra el detalle de un documento con el nombre de quien lo cargó", async ({ page }) => {
    await page.getByRole("row", { name: /memoria-andina-2024.md/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Detalle del documento")).toBeVisible();
    await expect(dialogo).toContainText("Minera Andina S.A.A.");
    await expect(dialogo).toContainText("Memoria Anual");
    await expect(dialogo).toContainText("memoria-andina-2024.md");
    // El backend manda el ID del usuario: se muestra su nombre, nunca el ID.
    await expect(dialogo).toContainText("Oscar Baldeón");
    await expect(dialogo).not.toContainText("u-super");
  });

  test("al abrir el detalle se ve un solo indicador de carga (el del modal)", async ({ page, api }) => {
    // Carga lenta con margen de sobra: el modal debe seguir «Cargando…» durante todas las comprobaciones.
    api.retrasar("GET", /^\/documentos\/d-andina-2024$/, 4000);
    await page.getByRole("row", { name: /memoria-andina-2024.md/ }).click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Cargando…")).toBeVisible();
    await page.waitForTimeout(1000); // el indicador global, si se disparara, ya estaría visible (~600 ms)
    // Comprobación puntual (sin reintentos): mientras el modal carga, no hay indicador global.
    expect(await page.getByTestId("carga-global").count()).toBe(0);
    await expect(dialogo.getByText("Cargando…")).toBeVisible();
    await expect(dialogo).toContainText("memoria-andina-2024.md");
  });

  test("la huella SHA-256 queda en «Detalles técnicos», plegada y explicada", async ({ page }) => {
    await page.getByRole("row", { name: /memoria-andina-2024.md/ }).click();
    const dialogo = page.getByRole("dialog");
    const huella = dialogo.getByText("Huella del archivo (SHA-256)");
    await expect(huella).toBeHidden();

    await dialogo.getByText("Detalles técnicos").click();
    await expect(huella).toBeVisible();
    await expect(dialogo.getByText("permite detectar cargas duplicadas")).toBeVisible();
    await expect(dialogo.getByRole("button", { name: "Copiar huella" })).toBeVisible();
  });

  test("los documentos de una empresa desactivada se ven como Inactivo", async ({ page }) => {
    const fila = page.getByRole("row", { name: /memoria-petro-norte-2025.md/ });
    await expect(fila).toContainText("Inactivo");

    await fila.click();
    await expect(page.getByRole("dialog")).toContainText("La empresa de este documento está desactivada en el catálogo.");
  });
});
