import { test, expect, entrarComo, campo } from "./support/fixtures";

test.describe("Caso de uso: Gestionar catálogo de empresas", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/empresas");
    await expect(page.getByRole("heading", { name: "Catálogo de empresas" })).toBeVisible();
  });

  test("filtra por sector y por empresas activas", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(5);

    await campo(page, "Sector").selectOption({ label: "Petróleo y Gas" });
    await expect(filas).toHaveCount(2);
    await expect(filas.filter({ hasText: "Petro Norte S.A." })).toContainText("Inactiva");

    await page.getByLabel("Sólo activas").check();
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Sur S.A.");
  });

  test("busca una empresa por parte del nombre, sin tildes ni mayúsculas", async ({ page, api }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(5);
    const llamadas = api.llamadasA("GET", "/empresas").length;
    const buscador = page.getByLabel("Buscar empresa");

    await buscador.fill("PETRO");
    await expect(filas).toHaveCount(2);
    await buscador.fill("sur");
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Sur S.A.");
    // Se combina con el sector y no consulta al servidor por cada tecla.
    expect(api.llamadasA("GET", "/empresas")).toHaveLength(llamadas);
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await expect(page.getByText("Ninguna empresa coincide con «sur».")).toBeVisible();

    await expect(filas).toHaveCount(0);
    await page.getByRole("button", { name: "Borrar búsqueda" }).last().click();
    await expect(buscador).toHaveValue("");
    await expect(page.getByText(/Ninguna empresa coincide/)).toHaveCount(0);

    await campo(page, "Sector").selectOption({ label: "Todos" });
    await buscador.fill("utec");
    await expect(filas).toHaveCount(1);
    await buscador.press("Escape");
    await expect(buscador).toHaveValue("");
  });

  test("registra una empresa nueva", async ({ page, api }) => {
    await page.getByRole("button", { name: "Agregar empresa" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nombre de la empresa").fill("Cobre del Sur S.A.");
    await campo(dialogo, "Sector").selectOption({ label: "Minería" });
    await dialogo.getByRole("button", { name: "Registrar" }).click();

    await expect(page.getByText("Empresa 'Cobre del Sur S.A.' registrada.")).toBeVisible();
    await expect(page.getByRole("row", { name: /Cobre del Sur S.A./ })).toContainText("Minería");
    expect(api.llamadasA("POST", "/empresas")[0].cuerpo).toEqual({ nombre: "Cobre del Sur S.A.", sector: "MINERIA" });
  });

  test("la empresa recién registrada aparece primera, sin buscarla, aunque hubiera un filtro", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await page.getByRole("searchbox", { name: "Buscar empresa" }).fill("petro");
    await campo(page, "Sector").selectOption({ label: "Petróleo y Gas" });

    for (const [nombre, sector] of [["Zinc Andino S.A.", "Minería"], ["Agua Clara S.A.", "Energía"]] as const) {
      await page.getByRole("button", { name: "Agregar empresa" }).click();
      const dialogo = page.getByRole("dialog");
      await dialogo.getByLabel("Nombre de la empresa").fill(nombre);
      await campo(dialogo, "Sector").selectOption({ label: sector });
      await dialogo.getByRole("button", { name: "Registrar" }).click();
      await expect(dialogo).toBeHidden();
    }

    // La más reciente primero, luego la anterior, marcadas como nuevas; sin búsqueda ni filtro que las oculte.
    await expect(filas.nth(0)).toContainText("Agua Clara S.A.Nueva");
    await expect(filas.nth(1)).toContainText("Zinc Andino S.A.Nueva");
    await expect(page.getByRole("searchbox", { name: "Buscar empresa" })).toHaveValue("");
    await expect(campo(page, "Sector")).toHaveValue("");
    await expect(filas.nth(2)).not.toContainText("Nueva");
  });

  test("registra una empresa en el sector «Otros» y la filtra por ese sector", async ({ page, api }) => {
    await page.getByRole("button", { name: "Agregar empresa" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nombre de la empresa").fill("Agroexportadora del Valle S.A.");
    await campo(dialogo, "Sector").selectOption({ label: "Otros" });
    await dialogo.getByRole("button", { name: "Registrar" }).click();

    await expect(page.getByText("Empresa 'Agroexportadora del Valle S.A.' registrada.")).toBeVisible();
    expect(api.llamadasA("POST", "/empresas")[0].cuerpo).toEqual({ nombre: "Agroexportadora del Valle S.A.", sector: "OTROS" });
    await expect(dialogo).toBeHidden();

    await campo(page, "Sector").selectOption({ label: "Otros" });
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Agroexportadora del Valle S.A.");
    await expect(filas.first()).toContainText("Otros");
  });

  test("exige el nombre y avisa si la empresa ya existe", async ({ page, api }) => {
    await page.getByRole("button", { name: "Agregar empresa" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    await expect(dialogo.getByText("El nombre es obligatorio.")).toBeVisible();
    expect(api.llamadasA("POST", "/empresas")).toHaveLength(0);

    await dialogo.getByLabel("Nombre de la empresa").fill("minera andina s.a.a.");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    await expect(dialogo.getByText("Ya existe una empresa con ese nombre.")).toBeVisible();
  });

  test("edita el nombre de una empresa", async ({ page }) => {
    await page.getByRole("row", { name: /Petro Sur S.A./ }).getByRole("button", { name: /Editar/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Nombre de la empresa")).toHaveValue("Petro Sur S.A.");
    await dialogo.getByLabel("Nombre de la empresa").fill("Petro Sur Energía S.A.");
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Empresa actualizada.")).toBeVisible();
    await expect(page.getByRole("row", { name: /Petro Sur Energía S.A./ })).toBeVisible();
  });

  test("desactiva y vuelve a activar una empresa", async ({ page }) => {
    const fila = page.getByRole("row", { name: /Utec ELEC S.A./ });
    await fila.getByRole("button", { name: /Desactivar/ }).click();
    await expect(page.getByText("Empresa desactivada. Sus documentos ya no se consideran en el análisis GRI.")).toBeVisible();
    await expect(fila).toContainText("Inactiva");

    await fila.getByRole("button", { name: /(^|\s)Activar$/ }).click();
    await expect(page.getByText("Empresa activada. Sus documentos vuelven a considerarse en el análisis GRI.")).toBeVisible();
    await expect(fila).toContainText("Activa");
  });

  test("al filtrar se ve solo el esqueleto de la tabla, no el indicador central", async ({ page, api }) => {
    api.retrasar("GET", /^\/empresas$/, 2000);
    await campo(page, "Sector").selectOption({ label: "Minería" });

    await expect(page.locator("tbody .animate-pulse").first()).toBeVisible();
    await page.waitForTimeout(1000); // el indicador central, si se disparara, ya estaría visible (~600 ms)
    // Comprobación puntual (sin reintentos): mientras la tabla carga, no hay indicador central.
    expect(await page.getByTestId("carga-global").count()).toBe(0);
  });

  test("desactivar, que no tiene indicador propio, sí muestra el indicador central", async ({ page, api }) => {
    api.retrasar("PATCH", /\/desactivar$/, 1500);
    const fila = page.getByRole("row", { name: /Petro Sur S.A./ });
    await fila.getByRole("button", { name: "Desactivar" }).click();

    await expect(page.getByTestId("carga-global")).toBeVisible();
    await expect(fila).toContainText("Inactiva");
  });
});
