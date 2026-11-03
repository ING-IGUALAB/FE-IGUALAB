import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function elegirContexto(page: Page, sector: string, empresa: string, anio: number) {
  await campo(page, "Sector").selectOption({ label: sector });
  await campo(page, "Empresa").selectOption({ label: empresa });
  await campo(page, "Año").selectOption(String(anio));
}

test.describe("Caso de uso: Consultar al asistente de IA", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/ia");
    await expect(page.getByText("Hola, soy el asistente de IA de Igualab.")).toBeVisible();
  });

  test("el año solo ofrece los años en que la empresa tiene documentos", async ({ page }) => {
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    // Minera Andina solo tiene documentos analizados de 2024.
    await expect(campo(page, "Año").locator("option")).toHaveText(["2024"]);
    await expect(campo(page, "Año")).toHaveValue("2024");
    await expect(page.getByText("Contexto listo")).toBeVisible();
  });

  test("una empresa sin documentos analizados no se puede consultar", async ({ page }) => {
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await campo(page, "Empresa").selectOption({ label: "Minera Altiplano S.A." });

    await expect(campo(page, "Año")).toBeDisabled();
    await expect(campo(page, "Año").locator("option")).toHaveText(["Sin documentos"]);
    await expect(page.getByText("Sin documentos analizados")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Pregunta para el asistente" })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Pregunta para el asistente" })).toHaveAttribute(
      "placeholder",
      "Esta empresa aún no tiene documentos analizados para consultar.",
    );
  });

  test("sin contexto no permite consultar", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: "Pregunta para el asistente" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Consultar" })).toBeDisabled();
  });

  test("responde con afirmaciones verificadas y cita la fuente", async ({ page, api }) => {
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await expect(page.getByText("Contexto listo")).toBeVisible();

    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill("¿Qué sanciones tiene?");
    await page.getByRole("button", { name: "Consultar" }).click();

    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT por incumplimiento ambiental.")).toBeVisible();
    await expect(page.getByText("«OEFA impuso una multa de 59.078 UIT por incumplimiento ambiental.»")).toBeVisible();
    await expect(page.getByText("Fuentes citadas")).toBeVisible();
    await expect(page.getByText("memoria-andina-2024.md")).toBeVisible();
    await expect(page.getByText("Minera Andina S.A.A. · 2024 · Memoria Anual > Contingencias")).toBeVisible();
    await expect(page.getByText("Se omitió 1 afirmación que no pudo respaldarse con los documentos.")).toBeVisible();
    // El backend exige sector, empresa y año: si faltara alguno respondería 422 "Field required".
    expect(api.llamadasA("POST", "/asistente/consultas")[0].cuerpo).toEqual({
      pregunta: "¿Qué sanciones tiene?",
      sector: "MINERIA",
      empresa_id: "e-andina",
      anio: 2024,
    });
  });

  test("fuera de su dominio, explica que no puede responder", async ({ page }) => {
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill("¿Quién ganó el partido de fútbol?");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Solo respondo sobre sostenibilidad, indicadores GRI y sanciones de las empresas.")).toBeVisible();
    await expect(page.getByText("Fuentes citadas")).toHaveCount(0);
  });

  test("si el asistente no está disponible, muestra el error en el chat", async ({ page, api }) => {
    api.fallarProxima("POST", "/asistente/consultas", 503, "AI_UNAVAILABLE", "El asistente no está disponible en este momento.");
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "¿Qué sanciones identificas para esta empresa y año?" }).click();

    await expect(page.getByText("El asistente no está disponible en este momento.")).toBeVisible();
  });
});

test.describe("Barra de contexto del asistente", () => {
  const NOMBRE_LARGO = "Cooperativa de Ahorro y Crédito Norandino Ltda. (COOPAC Norandino)";

  for (const ancho of [1440, 1280, 1024, 768, 375]) {
    test(`mantiene su altura en todos los estados, con un nombre largo, a ${ancho}px`, async ({ page, api }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      api.empresas.find((e) => e.id === "e-andina")!.nombre = NOMBRE_LARGO;
      await entrarComo(page, api, "administrador", "/ia");
      const barra = page.getByTestId("barra-contexto");
      await expect(page.getByText("Elige sector y empresa")).toBeVisible();
      const altoVacio = (await barra.boundingBox())!.height;

      await campo(page, "Sector").selectOption({ label: "Minería" });
      await campo(page, "Empresa").selectOption({ label: NOMBRE_LARGO });
      await expect(page.getByText("Contexto listo")).toBeVisible();
      expect((await barra.boundingBox())!.height).toBeCloseTo(altoVacio, 0);
      await expect(campo(page, "Empresa")).toHaveAttribute("title", NOMBRE_LARGO);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

      await campo(page, "Sector").selectOption({ label: "Energía" });
      await campo(page, "Empresa").selectOption({ label: "Utec ELEC S.A." });
      await expect(page.getByText("Sin documentos analizados")).toBeVisible();
      expect((await barra.boundingBox())!.height).toBeCloseTo(altoVacio, 0);
    });
  }

  test("en escritorio el indicador queda en la misma línea que los campos", async ({ page, api }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    api.empresas.find((e) => e.id === "e-andina")!.nombre = NOMBRE_LARGO;
    await entrarComo(page, api, "administrador", "/ia");
    await campo(page, "Sector").selectOption({ label: "Minería" });
    await campo(page, "Empresa").selectOption({ label: NOMBRE_LARGO });
    const indicador = page.getByText("Contexto listo");
    await expect(indicador).toBeVisible();

    const a = (await campo(page, "Empresa").boundingBox())!;
    const b = (await indicador.boundingBox())!;
    expect(b.y).toBeLessThan(a.y + a.height);
    expect(b.x).toBeGreaterThan(a.x + a.width);
  });
});
