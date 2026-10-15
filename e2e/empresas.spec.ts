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
});
