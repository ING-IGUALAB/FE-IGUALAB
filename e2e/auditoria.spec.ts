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

    await page.getByRole("button", { name: "Siguiente" }).click();
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
