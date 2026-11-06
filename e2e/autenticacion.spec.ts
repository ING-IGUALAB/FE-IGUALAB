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

test.describe("Menú lateral", () => {
  const boton = "Mostrar u ocultar el menú";

  test("en escritorio se colapsa a solo íconos: gana ancho, se sigue navegando y recuerda la preferencia", async ({ page, api }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrarComo(page, api, "superadmin", "/ingesta");
    const enlace = page.getByRole("link", { name: "Auditoría" });
    const main = page.locator("main");
    const barra = page.locator("#menu-lateral");
    await expect(enlace).toBeVisible();
    const anchoAntes = (await main.boundingBox())!.width;

    await page.getByRole("button", { name: boton }).click();
    await expect.poll(async () => (await barra.boundingBox())!.width).toBe(72);
    await expect.poll(async () => (await main.boundingBox())!.width).toBeGreaterThan(anchoAntes + 180);

    // El nombre aparece solo al pasar el mouse, sin que la barra lo recorte.
    const rotulo = enlace.getByText("Auditoría");
    await expect(rotulo).toHaveCSS("opacity", "0");
    await enlace.hover();
    await expect(rotulo).toHaveCSS("opacity", "1");
    const caja = (await rotulo.boundingBox())!;
    expect(caja.x + caja.width).toBeGreaterThan(72);
    await expect(barra.locator("nav")).toHaveCSS("overflow-y", "visible");

    // Se navega con un clic, sin expandir la barra.
    await enlace.click();
    await expect(page).toHaveURL(/\/auditoria$/);
    await expect(barra).toHaveCount(1);
    expect((await barra.boundingBox())!.width).toBe(72);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Auditoría de eventos" })).toBeVisible();
    await expect.poll(async () => (await barra.boundingBox())!.width).toBe(72);

    await page.getByRole("button", { name: boton }).click();
    await expect.poll(async () => (await barra.boundingBox())!.width).toBe(260);
    await expect(enlace.getByText("Auditoría")).toHaveCSS("opacity", "1");
  });

  test("con la barra colapsada, las opciones de abajo siguen disponibles y centradas", async ({ page, api }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrarComo(page, api, "administrador", "/ia");
    await page.getByRole("button", { name: boton }).click();
    const barra = page.locator("#menu-lateral");
    await expect.poll(async () => (await barra.boundingBox())!.width).toBe(72);

    for (const opcion of [
      page.getByRole("link", { name: "Reportes de prospección" }),
      page.getByRole("link", { name: "Nueva consulta IA" }),
      page.getByRole("link", { name: "Cambiar contraseña" }),
      page.getByRole("button", { name: "Cerrar sesión" }),
    ]) {
      await expect(opcion).toBeVisible();
      const icono = (await opcion.locator(".material-symbols-outlined").boundingBox())!;
      expect(Math.abs(icono.x + icono.width / 2 - 36)).toBeLessThanOrEqual(2);
    }
  });

  test("en móvil se abre sobre el contenido y se cierra al navegar o con Escape", async ({ page, api }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await entrarComo(page, api, "superadmin", "/usuarios");
    const enlace = page.getByRole("link", { name: "Auditoría" });
    await expect(enlace).toBeHidden();

    await page.getByRole("button", { name: boton }).click();
    await expect(enlace).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(enlace).toBeHidden();

    await page.getByRole("button", { name: boton }).click();
    await enlace.click();
    await expect(page).toHaveURL(/\/auditoria$/);
    await expect(enlace).toBeHidden();

    await page.getByRole("button", { name: boton }).click();
    await page.getByTestId("menu-fondo").click({ position: { x: 340, y: 300 } });
    await expect(enlace).toBeHidden();
  });
});

test.describe("Modo día y noche", () => {
  test("cambia a modo oscuro desde el acceso, lo recuerda al recargar y vuelve a claro desde la app", async ({ page, api }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: "Activar modo oscuro" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await entrarComo(page, api, "superadmin", "/usuarios");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Activar modo claro" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
  });
});
