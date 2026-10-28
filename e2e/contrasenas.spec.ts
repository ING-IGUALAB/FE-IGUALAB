import { test, expect, entrarComo } from "./support/fixtures";

test.describe("Caso de uso: Recuperar contraseña", () => {
  test("solicita el enlace y responde con un mensaje genérico", async ({ page, api }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "¿Olvidó su contraseña?" }).click();

    const dialogo = page.getByRole("dialog");
    await dialogo.getByPlaceholder("tu@igualab.com").fill("alguien@igualab.com");
    await dialogo.getByRole("button", { name: "Enviar enlace" }).click();

    await expect(page.getByText("Si el correo está registrado, recibirás un enlace de recuperación")).toBeVisible();
    expect(api.llamadasA("POST", "/auth/recuperar-contrasena")[0].cuerpo).toEqual({ correo: "alguien@igualab.com" });
  });
});

test.describe("Caso de uso: Restablecer contraseña", () => {
  test("las contraseñas nuevas se ocultan y se pueden mostrar", async ({ page }) => {
    await page.goto("/restablecer?token=token-valido");
    const nueva = page.getByLabel("Nueva contraseña", { exact: true });
    await expect(nueva).toHaveAttribute("type", "password");
    await expect(page.getByLabel("Confirmar contraseña", { exact: true })).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar contraseña" }).first().click();
    await expect(nueva).toHaveAttribute("type", "text");
  });

  test("con un enlace válido cambia la contraseña y vuelve al login", async ({ page }) => {
    await page.goto("/restablecer?token=token-valido");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("Nueva123!");
    await page.getByLabel("Confirmar contraseña", { exact: true }).fill("Nueva123!");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();

    await expect(page.getByText("Contraseña actualizada. Ya puedes iniciar sesión.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("con un enlace vencido muestra el error del backend", async ({ page }) => {
    await page.goto("/restablecer?token=token-vencido");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("Nueva123!");
    await page.getByLabel("Confirmar contraseña", { exact: true }).fill("Nueva123!");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();

    await expect(page.getByText("El enlace de recuperación no es válido o expiró.")).toBeVisible();
    await expect(page).toHaveURL(/\/restablecer/);
  });
});

test.describe("Caso de uso: Cambiar mi contraseña", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador");
    await page.getByRole("link", { name: "Cambiar contraseña" }).click();
    await expect(page.getByRole("heading", { name: "Mi cuenta" })).toBeVisible();
  });

  test("las contraseñas se ocultan al escribir y cada una se puede mostrar u ocultar", async ({ page }) => {
    for (const etiqueta of ["Contraseña actual", "Nueva contraseña", "Confirmar nueva contraseña"]) {
      await expect(page.getByLabel(etiqueta, { exact: true })).toHaveAttribute("type", "password");
    }
    const actual = page.getByLabel("Contraseña actual", { exact: true });
    await actual.fill("Admin123!");

    // El botón solo afecta a su propio campo.
    await page.getByRole("button", { name: "Mostrar contraseña" }).first().click();
    await expect(actual).toHaveAttribute("type", "text");
    await expect(page.getByLabel("Nueva contraseña", { exact: true })).toHaveAttribute("type", "password");

    const ocultar = page.getByRole("button", { name: "Ocultar contraseña" });
    await expect(ocultar).toHaveAttribute("aria-pressed", "true");
    await ocultar.click();
    await expect(actual).toHaveAttribute("type", "password");
    await expect(actual).toHaveValue("Admin123!");
  });

  test("no permite guardar si la nueva contraseña no cumple la política", async ({ page }) => {
    const boton = page.getByRole("button", { name: "Actualizar contraseña" });
    const nueva = page.getByLabel("Nueva contraseña", { exact: true });
    const confirmar = page.getByLabel("Confirmar nueva contraseña", { exact: true });
    await page.getByLabel("Contraseña actual", { exact: true }).fill("Admin123!");
    await nueva.fill("corta");
    await confirmar.fill("corta");

    await expect(nueva).toHaveValue("corta");
    await expect(boton).toBeDisabled();

    // Con una contraseña que sí cumple, el botón se habilita: el bloqueo era por la política.
    await nueva.fill("Valida123!");
    await confirmar.fill("Valida123!");
    await expect(boton).toBeEnabled();
  });

  test("con la contraseña actual incorrecta muestra el error sin cerrar la sesión", async ({ page }) => {
    await page.getByLabel("Contraseña actual", { exact: true }).fill("NoEsLaMia1!");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("Nueva123!");
    await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill("Nueva123!");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();

    await expect(page.getByText("La contraseña actual no es correcta.")).toBeVisible();
    await expect(page).toHaveURL(/\/mi-cuenta$/);
  });

  test("con datos válidos actualiza la contraseña", async ({ page, api }) => {
    await page.getByLabel("Contraseña actual", { exact: true }).fill("Admin123!");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("Nueva123!");
    await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill("Nueva123!");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();

    await expect(page.getByText("Contraseña actualizada correctamente.")).toBeVisible();
    expect(api.cuentaDe("administrador").password).toBe("Nueva123!");
  });
});
