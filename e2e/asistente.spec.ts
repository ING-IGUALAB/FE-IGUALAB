import { test, expect, entrarComo, campo } from "./support/fixtures";
import { aniosDisponibles } from "../src/lib/dominio";
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

  test("el año solo se elige de 2023 al último año cerrado (no admite 0 ni años futuros)", async ({ page }) => {
    const anio = campo(page, "Año");
    await expect(anio.locator("option")).toHaveText(aniosDisponibles().map(String));
    await expect(anio).toHaveValue(String(aniosDisponibles()[0]));
    await expect(anio.locator("option", { hasText: "3000" })).toHaveCount(0);
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

  test("sin documentos de esa empresa y año, lo indica", async ({ page }) => {
    await elegirContexto(page, "Minería", "Minera Altiplano S.A.", 2024);
    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill("¿Qué emisiones reporta?");
    await page.keyboard.press("Enter");

    await expect(page.getByText("No hay documentos analizados de esta empresa y año para responder.")).toBeVisible();
  });

  test("si el asistente no está disponible, muestra el error en el chat", async ({ page, api }) => {
    api.fallarProxima("POST", "/asistente/consultas", 503, "AI_UNAVAILABLE", "El asistente no está disponible en este momento.");
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "¿Qué sanciones identificas para esta empresa y año?" }).click();

    await expect(page.getByText("El asistente no está disponible en este momento.")).toBeVisible();
  });
});
