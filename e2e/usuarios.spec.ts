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

  test("el diálogo cubre toda la pantalla, sin desenfoque, y enfoca el primer campo", async ({ page }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Nombre completo")).toBeFocused();

    const fondo = page.getByTestId("modal-fondo");
    const caja = await fondo.boundingBox();
    const vista = page.viewportSize()!;
    expect(caja).toMatchObject({ x: 0, y: 0, width: vista.width, height: vista.height });
    expect(await fondo.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");

    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);
  });

  test("la contraseña de la cuenta nueva se oculta y se puede mostrar", async ({ page }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    const pass = dialogo.getByLabel("Contraseña", { exact: true });
    await expect(pass).toHaveAttribute("type", "password");
    await pass.fill("Maria123!");
    await dialogo.getByRole("button", { name: "Mostrar contraseña" }).first().click();
    await expect(pass).toHaveAttribute("type", "text");
    await expect(dialogo.getByLabel("Confirmar contraseña", { exact: true })).toHaveAttribute("type", "password");
    await dialogo.getByRole("button", { name: "Ocultar contraseña" }).click();
    await expect(pass).toHaveAttribute("type", "password");
  });

  test("el ojo queda centrado verticalmente en el campo de contraseña", async ({ page }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    // Se reintenta porque el diálogo se abre con una animación que altera las medidas.
    await expect(async () => {
      const campo = await dialogo.getByLabel("Contraseña", { exact: true }).boundingBox();
      const icono = await dialogo.getByRole("button", { name: "Mostrar contraseña" }).first().locator("span").boundingBox();
      expect(Math.abs(campo!.y + campo!.height / 2 - (icono!.y + icono!.height / 2))).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 3000 });
  });

  test("exige confirmar la contraseña y que ambas coincidan", async ({ page, api }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nombre completo").fill("María Torres");
    await dialogo.getByLabel("Correo electrónico").fill("maria@igualab.com");
    await dialogo.getByLabel("Contraseña", { exact: true }).fill("Maria123!");
    await dialogo.getByLabel("Confirmar contraseña", { exact: true }).fill("Maria123?");
    await dialogo.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(dialogo.getByText("Las contraseñas no coinciden.")).toBeVisible();
    expect(api.llamadasA("POST", "/usuarios")).toHaveLength(0);

    // Al cancelar no quedan contraseñas escritas para la próxima vez.
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Crear usuario" }).click();
    await expect(page.getByRole("dialog").getByLabel("Contraseña", { exact: true })).toHaveValue("");
  });

  test("crea una cuenta nueva como Administrador", async ({ page, api }) => {
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nombre completo").fill("María Torres");
    await dialogo.getByLabel("Correo electrónico").fill("maria@igualab.com");
    await dialogo.getByLabel("Contraseña", { exact: true }).fill("Maria123!");
    await dialogo.getByLabel("Confirmar contraseña", { exact: true }).fill("Maria123!");
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

    await expect(dialogo.getByText("Este campo es obligatorio.")).toHaveCount(3);
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
    await dialogo.getByLabel("Confirmar contraseña", { exact: true }).fill("Luis1234!");
    await dialogo.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(dialogo.getByText("Ya existe una cuenta con ese correo.")).toBeVisible();
  });

  test("pagina la lista de usuarios de 5 en 5", async ({ page, api }) => {
    const base = api.cuentas[2];
    for (let i = 1; i <= 8; i++) {
      api.cuentas.push({ ...base, id: `u-extra-${i}`, nombre: `Usuario Extra ${i}`, correo: `extra${i}@igualab.com` });
    }
    await page.reload();
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(5);
    await expect(page.getByText("12 cuentas", { exact: false })).toBeVisible();

    const paginacion = page.getByRole("navigation", { name: "Paginación" });
    await expect(paginacion).toContainText("Página 1 de 3");
    await paginacion.getByRole("button", { name: "Última página" }).click();
    await expect(paginacion).toContainText("Página 3 de 3");
    await expect(filas).toHaveCount(2);
    await expect(page.getByRole("row", { name: /Usuario Extra 8/ })).toBeVisible();
  });

  test("con 5 cuentas o menos no se muestra la paginación", async ({ page }) => {
    await expect(page.locator("tbody tr")).toHaveCount(4);
    await expect(page.getByRole("navigation", { name: "Paginación" })).toHaveCount(0);
  });

  test("deshabilita una cuenta", async ({ page }) => {
    const fila = page.getByRole("row", { name: /Luis Pérez/ });
    await fila.getByTitle("Deshabilitar").click();
    await page.getByRole("dialog").getByRole("button", { name: "Deshabilitar" }).click();

    await expect(page.getByText("Cuenta deshabilitada.")).toBeVisible();
    await expect(fila).toContainText("Inactivo");
  });

  test("la transferencia solo se puede confirmar después de 10 segundos", async ({ page, api }) => {
    await page.clock.install();
    const abrir = page.getByRole("row", { name: /Luis Pérez/ }).getByTitle("Transferir rol SuperAdmin");
    await abrir.click();
    const dialogo = page.getByRole("dialog");
    const confirmar = dialogo.getByRole("button", { name: /^Confirmar transferencia/ });

    await expect(confirmar).toBeDisabled();
    await expect(confirmar).toHaveText("Confirmar transferencia (10 s)");

    await page.clock.fastForward(9000);
    await expect(confirmar).toHaveText("Confirmar transferencia (1 s)");
    await expect(confirmar).toBeDisabled();

    // Cancelar y volver a abrir reinicia la espera completa.
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await abrir.click();
    await expect(confirmar).toHaveText("Confirmar transferencia (10 s)");
    await expect(confirmar).toBeDisabled();

    await page.clock.fastForward(10000);
    await expect(confirmar).toHaveText("Confirmar transferencia");
    await expect(confirmar).toBeEnabled();
    expect(api.cuentaDe("superadmin").rol).toBe("superadmin");
  });

  test("transfiere el rol SuperAdmin y la sesión pasa a Administrador", async ({ page, api }) => {
    await page.clock.install();
    await page.getByRole("row", { name: /Luis Pérez/ }).getByTitle("Transferir rol SuperAdmin").click();
    await page.clock.fastForward(10000);
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar transferencia" }).click();

    await expect(page.getByText("Rol SuperAdmin transferido a Luis Pérez. Ahora eres Administrador.")).toBeVisible();
    await expect(page).toHaveURL(/\/ia$/);
    expect(api.cuentaDe("superadmin").rol).toBe("administrador");
  });
});
