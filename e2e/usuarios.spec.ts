import { test, expect, entrarComo } from "./support/fixtures";

test.describe("Caso de uso: Gestionar usuarios", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin");
    await expect(page.getByRole("heading", { name: "Usuarios y roles" })).toBeVisible();
  });

  test("lista las cuentas con exactamente un SuperAdmin", async ({ page }) => {
    await expect(page.getByRole("row", { name: /Oscar Baldeón/ })).toContainText("SuperAdmin");
    await expect(page.getByRole("row", { name: /Luis Pérez/ })).toContainText("Administrador");
    await expect(page.getByRole("row", { name: /Carla Ruiz/ })).toContainText("Inactivo");
    await expect(page.getByRole("cell", { name: "SuperAdmin", exact: true })).toHaveCount(1);
  });

  test("crea una cuenta nueva como Administrador", async ({ page, api }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nombre completo").fill("María Torres");
    await dialogo.getByLabel("Correo electrónico").fill("maria@igualab.com");
    await dialogo.getByLabel("Contraseña", { exact: true }).fill("Maria123!");
    await dialogo.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(page.getByText("Cuenta creada como Administrador.")).toBeVisible();
    await expect(page.getByRole("row", { name: /María Torres/ })).toContainText("Administrador");
    expect(api.llamadasA("POST", "/usuarios")[0].cuerpo).toEqual({
      nombre: "María Torres",
      correo: "maria@igualab.com",
      password: "Maria123!",
    });
  });

  test("muestra los errores de todos los campos a la vez y no envía nada", async ({ page, api }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(dialogo.getByText("Este campo es obligatorio.")).toHaveCount(2);
    await expect(dialogo.getByText("La contraseña debe cumplir todos los requisitos.")).toBeVisible();

    await dialogo.getByLabel("Correo electrónico").fill("correo-malo");
    await dialogo.getByRole("button", { name: "Crear", exact: true }).click();
    await expect(dialogo.getByText("El formato del correo es incorrecto.")).toBeVisible();
    expect(api.llamadasA("POST", "/usuarios")).toHaveLength(0);
  });

  test("informa si el correo ya está registrado", async ({ page }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nombre completo").fill("Luis Duplicado");
    await dialogo.getByLabel("Correo electrónico").fill("luis@igualab.com");
    await dialogo.getByLabel("Contraseña", { exact: true }).fill("Luis1234!");
    await dialogo.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(dialogo.getByText("Ya existe una cuenta con ese correo.")).toBeVisible();
  });

  test("deshabilita una cuenta", async ({ page }) => {
    const fila = page.getByRole("row", { name: /Luis Pérez/ });
    await fila.getByTitle("Deshabilitar").click();
    await page.getByRole("dialog").getByRole("button", { name: "Deshabilitar" }).click();

    await expect(page.getByText("Cuenta deshabilitada.")).toBeVisible();
    await expect(fila).toContainText("Inactivo");
  });

  test("transfiere el rol SuperAdmin y la sesión pasa a Administrador", async ({ page, api }) => {
    await page.getByRole("row", { name: /Luis Pérez/ }).getByTitle("Transferir rol SuperAdmin").click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar transferencia" }).click();

    await expect(page.getByText("Rol SuperAdmin transferido a Luis Pérez. Ahora eres Administrador.")).toBeVisible();
    await expect(page).toHaveURL(/\/ia$/);
    expect(api.cuentaDe("superadmin").rol).toBe("administrador");
  });
});
