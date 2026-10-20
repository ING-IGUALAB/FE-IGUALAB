import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function elegirContexto(page: Page, sector: string, empresa: string, anio: number) {
  await campo(page, "Sector").selectOption({ label: sector });
  await campo(page, "Empresa").selectOption({ label: empresa });
  await campo(page, "Año").fill(String(anio));
}

test.describe("Caso de uso: Consultar al asistente de IA", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/ia");
    await expect(page.getByText("Hola, soy el asistente de IA de Igualab.")).toBeVisible();
  });

  test("sin contexto no permite consultar", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: "Pregunta para el asistente" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Consultar" })).toBeDisabled();
  });

  test("responde con base en los documentos y cita la fuente", async ({ page, api }) => {
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await expect(page.getByText("Contexto listo")).toBeVisible();

    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill("¿Qué sanciones tiene?");
    await page.getByRole("button", { name: "Consultar" }).click();

    await expect(page.getByText("se identifica una multa del OEFA de 59.078 UIT")).toBeVisible();
    await expect(page.getByText("Fuentes citadas")).toBeVisible();
    await expect(page.getByText("Minera Andina S.A.A. · 2024 · Memoria Anual > Contingencias")).toBeVisible();
    expect(api.llamadasA("POST", "/asistente/consultas")[0].cuerpo).toEqual({
      pregunta: "¿Qué sanciones tiene?",
      empresa_id: "e-andina",
      anio: 2024,
    });
  });

  test("si los documentos no tienen evidencia, lo indica", async ({ page }) => {
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill("¿Quién ganó el partido de fútbol?");
    await page.keyboard.press("Enter");

    await expect(page.getByText("No encontré información sobre eso en los documentos cargados.")).toBeVisible();
    await expect(page.getByText("Los documentos de esta empresa y año no contienen evidencia para responder.")).toBeVisible();
    await expect(page.getByText("Fuentes citadas")).toHaveCount(0);
  });

  test("si el asistente no está disponible, muestra el error en el chat", async ({ page, api }) => {
    api.fallarProxima("POST", "/asistente/consultas", 503, "AI_UNAVAILABLE", "El asistente no está disponible en este momento.");
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("button", { name: "¿Qué sanciones identificas para esta empresa y año?" }).click();

    await expect(page.getByText("El asistente no está disponible en este momento.")).toBeVisible();
  });
});
