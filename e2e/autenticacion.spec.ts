import { test, expect, entrarComo, CREDENCIALES } from "./support/fixtures";

test.describe("Caso de uso: Iniciar sesión", () => {
  test("el SuperAdmin inicia sesión y llega a Usuarios y roles", async ({ page, api }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(CREDENCIALES.superadmin.correo);
    await page.getByLabel("Contraseña", { exact: true }).fill(CREDENCIALES.superadmin.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/usuarios$/);
    await expect(page.getByRole("heading", { name: "Usuarios y roles" })).toBeVisible();
    await expect(page.getByText("Bienvenido, Oscar")).toBeVisible();
    expect(api.llamadasA("POST", "/auth/login")[0].cuerpo).toEqual({
      correo: CREDENCIALES.superadmin.correo,
      password: CREDENCIALES.superadmin.password,
    });
  });

  test("el Administrador inicia sesión y llega al Asistente de IA", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(CREDENCIALES.administrador.correo);
    await page.getByLabel("Contraseña", { exact: true }).fill(CREDENCIALES.administrador.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/ia$/);
    await expect(page.getByText("Hola, soy el asistente de IA de Igualab.")).toBeVisible();
  });

  test("con credenciales incorrectas muestra el error y no entra", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(CREDENCIALES.superadmin.correo);
    await page.getByLabel("Contraseña", { exact: true }).fill("Equivocada1!");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("no permite enviar sin datos y valida el formato del correo", async ({ page, api }) => {
    await page.goto("/login");
    const boton = page.getByRole("button", { name: "Iniciar sesión" });
    await expect(boton).toBeDisabled();

    await page.getByLabel("Correo electrónico").fill("ana@");
    await page.getByLabel("Contraseña", { exact: true }).fill("Algo123!");
    await boton.click();

    await expect(page.getByText("Ingrese un correo válido.")).toBeVisible();
    expect(api.llamadasA("POST", "/auth/login")).toHaveLength(0);
  });
});

test.describe("Caso de uso: Control de acceso por rol", () => {
  test("sin sesión, una ruta protegida redirige al login", async ({ page }) => {
    await page.goto("/usuarios");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("un Administrador no puede abrir pantallas del SuperAdmin", async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/usuarios");
    await expect(page).toHaveURL(/\/ia$/);
  });

  test("cada rol ve solo su menú", async ({ page, api }) => {
    await entrarComo(page, api, "superadmin");
    const menu = page.getByRole("navigation");
    await expect(menu.getByRole("link", { name: "Catálogo de empresas" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Ingesta de documentos" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Análisis GRI" })).toHaveCount(0);
  });
});

test.describe("Caso de uso: Cerrar sesión", () => {
  test("al cerrar sesión vuelve al login y ya no puede entrar", async ({ page, api }) => {
    await entrarComo(page, api, "superadmin");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Sesión cerrada.")).toBeVisible();
    await page.goto("/usuarios");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("si el backend responde sesión expirada, cierra la sesión", async ({ page, api }) => {
    api.expirarSesiones();
    await entrarComo(page, api, "superadmin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("tras 2 horas sin actividad, la sesión expira", async ({ page, api }) => {
    await page.clock.install();
    await entrarComo(page, api, "superadmin");
    await expect(page.getByRole("heading", { name: "Usuarios y roles" })).toBeVisible();

    await page.clock.fastForward("02:00:05");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Tu sesión expiró por inactividad. Vuelve a autenticarte.")).toBeVisible();
  });
});
