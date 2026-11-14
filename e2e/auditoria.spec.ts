import { test, expect, entrarComo, campo } from "./support/fixtures";

test.describe("Caso de uso: Consultar la auditoría", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/auditoria");
    await expect(page.getByRole("heading", { name: "Auditoría de eventos" })).toBeVisible();
  });

  test("lista los eventos con su usuario y pagina de 10 en 10", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(10);
    await expect(page.getByText("25 eventos · Registro de solo lectura")).toBeVisible();
    await expect(filas.first()).toContainText("Oscar Baldeón");
    await expect(page.getByText("Página 1 de 3")).toBeVisible();

    await page.getByRole("button", { name: "Última página" }).click();
    await expect(page.getByText("Página 3 de 3")).toBeVisible();
    await expect(filas).toHaveCount(5);
  });

  test("filtra por tipo de evento y por usuario", async ({ page, api }) => {
    await campo(page, "Tipo de evento").selectOption("Descarga");
    await expect(page.getByText("5 eventos · Registro de solo lectura")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText("Descarga");

    await campo(page, "Usuario").selectOption({ label: "Ana García" });
    const ultima = api.llamadasA("GET", "/auditoria").at(-1)!;
    await expect.poll(() => api.llamadasA("GET", "/auditoria").at(-1)!.query.get("usuario_id")).toBe("u-admin");
    expect(ultima.query.get("tipo_evento")).toBe("Descarga");
  });

  test("filtra por rango de fechas y avisa si el rango es inválido", async ({ page, api }) => {
    await campo(page, "Desde").fill("2026-10-15");
    await expect.poll(() => api.llamadasA("GET", "/auditoria").at(-1)!.query.get("desde")).toBeTruthy();
    await expect(page.getByText("5 eventos · Registro de solo lectura")).toBeVisible();

    await campo(page, "Hasta").fill("2026-10-10");
    await expect(page.getByText("La fecha «Desde» no puede ser posterior a «Hasta».")).toBeVisible();
  });

  test("exporta los eventos filtrados a CSV", async ({ page }) => {
    await campo(page, "Tipo de evento").selectOption("Inicio de sesión");
    await expect(page.getByText("5 eventos · Registro de solo lectura")).toBeVisible();

    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar CSV" }).click();
    expect((await descarga).suggestedFilename()).toBe("auditoria_igualab.csv");
    await expect(page.getByText("Se exportaron 5 eventos.")).toBeVisible();
  });
});

test.describe("Paginación de la auditoría", () => {
  test("muestra la primera, la última y las vecinas de la actual; permite saltar directo", async ({ page, api }) => {
    api.agregarEventos(135); // 25 + 135 = 160 eventos → 16 páginas de 10
    await entrarComo(page, api, "superadmin", "/auditoria");
    const nav = page.getByRole("navigation", { name: "Paginación" });
    await expect(nav.getByText("Página 1 de 16")).toBeVisible();
    for (const n of [1, 2, 16]) await expect(nav.getByRole("button", { name: `Página ${n}`, exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Página 7", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Anterior" })).toBeDisabled();

    // Escribiendo la página en «Ir a» y pulsando «Ir».
    await nav.getByRole("spinbutton", { name: "Ir a la página" }).fill("7");
    await nav.getByRole("button", { name: "Ir", exact: true }).click();
    await expect(nav.getByText("Página 7 de 16")).toBeVisible();
    await expect(nav.getByRole("button", { name: "Página 7", exact: true })).toHaveAttribute("aria-current", "page");
    expect(api.llamadasA("GET", "/auditoria").at(-1)!.query.get("pagina")).toBe("7");
    await expect(nav.getByRole("spinbutton", { name: "Ir a la página" })).toHaveValue("");

    // Con Enter, y un número fuera de rango lleva a la última.
    await nav.getByRole("spinbutton", { name: "Ir a la página" }).fill("99");
    await page.keyboard.press("Enter");
    await expect(nav.getByText("Página 16 de 16")).toBeVisible();
    await expect(nav.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    await nav.getByRole("button", { name: "Anterior" }).click();
    await expect(nav.getByText("Página 15 de 16")).toBeVisible();
    await nav.getByRole("button", { name: "Página 1", exact: true }).click();
    await expect(nav.getByText("Página 1 de 16")).toBeVisible();
  });

  test("al cambiar de página desde abajo vuelve al inicio de la lista", async ({ page, api }) => {
    await page.setViewportSize({ width: 1280, height: 600 }); // la lista no entra entera en la pantalla
    api.agregarEventos(135);
    await entrarComo(page, api, "superadmin", "/auditoria");
    const nav = page.getByRole("navigation", { name: "Paginación" });
    await nav.scrollIntoViewIfNeeded();
    const primeraFila = page.locator("tbody tr").first();
    await expect(primeraFila).not.toBeInViewport();

    await nav.getByRole("button", { name: "Siguiente" }).click();
    await expect(nav.getByText("Página 2 de 16")).toBeVisible();
    await expect(primeraFila).toBeInViewport();
  });

  test("en pantallas angostas los botones de páginas caben en una sola línea", async ({ page, api }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    api.agregarEventos(135);
    await entrarComo(page, api, "superadmin", "/auditoria");
    const nav = page.getByRole("navigation", { name: "Paginación" });
    // Peor caso: una página en medio, con vecinas y «…» a ambos lados.
    await nav.getByRole("spinbutton", { name: "Ir a la página" }).fill("7");
    await page.keyboard.press("Enter");
    await expect(nav.getByText("Página 7 de 16")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(10);
    // Ambas posiciones en el mismo instante: la página se mueve al cargar las filas.
    const [anterior, siguiente] = await nav.evaluate((n) =>
      ["Anterior", "Siguiente"].map((nombre) => n.querySelector(`[aria-label="${nombre}"]`)!.getBoundingClientRect().top),
    );
    expect(anterior).toBe(siguiente);
  });
});
