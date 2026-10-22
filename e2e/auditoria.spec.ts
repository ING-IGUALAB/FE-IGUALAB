import { test, expect, entrarComo, campo } from "./support/fixtures";

test.describe("Caso de uso: Consultar la auditoría", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/auditoria");
    await expect(page.getByRole("heading", { name: "Auditoría de eventos" })).toBeVisible();
  });

  test("lista los eventos con su usuario y pagina de 20 en 20", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(20);
    await expect(page.getByText("25 eventos · Registro de solo lectura")).toBeVisible();
    await expect(filas.first()).toContainText("Oscar Baldeón");
    await expect(page.getByText("Página 1 de 2")).toBeVisible();

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
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
  test("muestra las 3 primeras, el campo «Ir a» y las 3 últimas; permite saltar directo", async ({ page, api }) => {
    api.agregarEventos(295); // 25 + 295 = 320 eventos → 16 páginas de 20
    await entrarComo(page, api, "superadmin", "/auditoria");
    const nav = page.getByRole("navigation", { name: "Paginación" });
    await expect(nav.getByText("Página 1 de 16")).toBeVisible();
    for (const n of [1, 2, 3, 14, 15, 16]) await expect(nav.getByRole("button", { name: `Página ${n}`, exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Página 7", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    // Escribiendo la página en «Ir a» y pulsando la lupa.
    await nav.getByRole("spinbutton", { name: "Ir a la página" }).fill("7");
    await nav.getByRole("button", { name: "Ir a la página escrita" }).click();
    await expect(nav.getByText("Página 7 de 16")).toBeVisible();
    await expect(nav.getByRole("button", { name: "Página 7", exact: true })).toHaveAttribute("aria-current", "page");
    expect(api.llamadasA("GET", "/auditoria").at(-1)!.query.get("pagina")).toBe("7");
    await expect(nav.getByRole("spinbutton", { name: "Ir a la página" })).toHaveValue("");

    // Con Enter, y un número fuera de rango lleva a la última.
    await nav.getByRole("spinbutton", { name: "Ir a la página" }).fill("99");
    await page.keyboard.press("Enter");
    await expect(nav.getByText("Página 16 de 16")).toBeVisible();
    await expect(nav.getByRole("button", { name: "Página siguiente" })).toBeDisabled();

    await nav.getByRole("button", { name: "Página anterior" }).click();
    await expect(nav.getByText("Página 15 de 16")).toBeVisible();
    await nav.getByRole("button", { name: "Página 1", exact: true }).click();
    await expect(nav.getByText("Página 1 de 16")).toBeVisible();
  });
});
