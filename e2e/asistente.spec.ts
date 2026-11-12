import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";

const MARCAS = ["<br", "**", "###", "<mark", "</u>", "](#", "--_--", "&amp;"];
async function sinMarcas(texto: string) {
  for (const m of MARCAS) expect(texto, `quedó «${m}» sin limpiar`).not.toContain(m);
}

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

  test("las fuentes citadas se leen limpias aunque el fragmento traiga Markdown o HTML", async ({ page }) => {
    // Fragmento tal como lo devuelve el backend (texto original del .md).
    await page.route("**/mock-api/asistente/consultas", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          respuesta: "Multa del OEFA [1].",
          afirmaciones: [{ texto: "La empresa recibió una **multa** del OEFA.", referencias: [1], cita_textual: "recibió una <mark>multa</mark> de S/ 5000" }],
          citas: [{
            referencia: 1, documento_id: "d-andina-2024", documento_nombre: "05_reporte_2025_marcas_html_y_pasajes.md",
            empresa_id: "e-andina", empresa_nombre: "Minera Andina S.A.A.", anio: 2024,
            seccion: "Reporte 2025 — Tejido Verde > **Gestión** ambiental<br>2025 > Cumplimiento",
            extracto: "### Cumplimiento La empresa recibió una <u>multa</u> --_-- de S/ 5000 &amp; ver el [anexo metodológico](#anexo-2)",
          }],
          sin_evidencia: false, motivo: null, mensaje: null, afirmaciones_descartadas: 0,
        }),
      }),
    );
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill("¿Qué sanciones tiene?");
    await page.getByRole("button", { name: "Consultar" }).click();

    await expect(page.getByText("La empresa recibió una multa del OEFA.")).toBeVisible();
    await expect(page.getByText("«recibió una multa de S/ 5000»")).toBeVisible();
    await expect(page.getByText("Minera Andina S.A.A. · 2024 · Reporte 2025 — Tejido Verde > Gestión ambiental 2025 > Cumplimiento")).toBeVisible();
    await expect(page.getByText("Cumplimiento La empresa recibió una multa de S/ 5000 & ver el anexo metodológico")).toBeVisible();
    // El nombre del archivo no se toca (sus guiones bajos no son marcas).
    await expect(page.getByText("05_reporte_2025_marcas_html_y_pasajes.md")).toBeVisible();
    await sinMarcas(await page.locator("main").innerText());
  });

  test("una cita que es una tabla del documento se muestra como tabla", async ({ page }) => {
    const tabla = "| Indicador | Código GRI | 2024 | Unidad | |-----------|-----------|------|--------| | Emisiones directas (Alcance 1) | GRI 305-1 | 11,980 | tCO2e | | Emisiones indirectas (Alcance 2) | GRI 305-2 | 7,650 | tCO2e |";
    await page.route("**/mock-api/asistente/consultas", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          respuesta: "Emisiones [1].",
          afirmaciones: [{ texto: "En 2024, las emisiones directas (Alcance 1) fueron 11,980 tCO2e.", referencias: [1], cita_textual: tabla }],
          citas: [{ referencia: 1, documento_id: "d-psur-2024", documento_nombre: "gri-petro-sur-2024.md", empresa_id: "e-andina", empresa_nombre: "Minera Andina S.A.A.", anio: 2024, seccion: "Indicadores", extracto: tabla }],
          sin_evidencia: false, motivo: null, mensaje: null, afirmaciones_descartadas: 0,
        }),
      }),
    );
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill("¿Qué emisiones reporta?");
    await page.getByRole("button", { name: "Consultar" }).click();

    const tablas = page.getByRole("table");
    await expect(tablas).toHaveCount(2); // la cita de la afirmación y el extracto de la fuente
    const primera = tablas.first();
    await expect(primera.getByRole("columnheader")).toHaveText(["Indicador", "Código GRI", "2024", "Unidad"]);
    await expect(primera.getByRole("row", { name: /Emisiones directas/ }).getByRole("cell")).toHaveText(["Emisiones directas (Alcance 1)", "GRI 305-1", "11,980", "tCO2e"]);
    await expect(primera.getByRole("row")).toHaveCount(3);
    expect(await page.locator("main").innerText()).not.toContain("|---");
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
    await page.getByRole("button", { name: "¿Qué sanciones ambientales, sociales y de gobernanza (compliance) identificas para esta empresa y año?" }).click();

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

test.describe("Guardar el chat e historial", () => {
  const preguntar = async (page: Page, texto: string) => {
    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill(texto);
    await page.getByRole("button", { name: "Consultar" }).click();
  };
  const historial = (page: Page) => page.getByRole("complementary", { name: "Historial de chats" });

  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/ia");
    await expect(page.getByText("Hola, soy el asistente de IA de Igualab.")).toBeVisible();
  });

  test("guarda el chat, aparece primero en el historial y lo que sigue se guarda solo", async ({ page, api }) => {
    const guardar = page.getByRole("button", { name: "Guardar chat" });
    await expect(guardar).toBeDisabled();
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await preguntar(page, "¿Qué sanciones tiene?");
    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT por incumplimiento ambiental.")).toBeVisible();

    // Con mensajes, el contexto queda fijo: un chat es de una sola empresa y año.
    await expect(campo(page, "Sector")).toBeDisabled();
    await expect(campo(page, "Empresa")).toBeDisabled();
    await expect(page.getByText("Chat sin guardar")).toBeVisible();

    await guardar.click();
    await expect(page.getByText("Chat guardado en tu historial.")).toBeVisible();
    await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
    await expect(guardar).toHaveCount(0);
    const cuerpo = api.llamadasA("POST", "/asistente/conversaciones")[0].cuerpo as Record<string, unknown>;
    expect(cuerpo).toMatchObject({ empresa_id: "e-andina", sector: "MINERIA", anio: 2024 });
    expect(cuerpo.clave_idempotencia).toMatch(/^[0-9a-f-]{36}$/);
    expect((cuerpo.mensajes as { rol: string }[]).map((m) => m.rol)).toEqual(["usuario", "asistente"]);

    // La siguiente pregunta va a la conversación guardada (el servidor la guarda).
    const directas = api.llamadasA("POST", "/asistente/consultas").length;
    await preguntar(page, "¿Y de qué año es la multa?");
    await expect(page.getByText("¿Y de qué año es la multa?")).toBeVisible();
    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT por incumplimiento ambiental.")).toHaveCount(2);
    expect(api.llamadasA("POST", /^\/asistente\/conversaciones\/[^/]+\/consultas$/)).toHaveLength(1);
    expect(api.llamadasA("POST", "/asistente/consultas")).toHaveLength(directas);

    await page.getByRole("button", { name: "Historial" }).click();
    const primero = historial(page).getByRole("listitem").first();
    await expect(primero).toContainText("¿Qué sanciones tiene?");
    await expect(primero).toContainText("Minera Andina S.A.A. · 2024");
    await expect(primero).toContainText("2 preguntas");
    await expect(primero.getByRole("button")).toHaveAttribute("aria-current", "true");
  });

  test("abre un chat guardado con su contexto y sus fuentes, y se puede empezar otro", async ({ page }) => {
    await page.getByRole("button", { name: "Historial" }).click();
    await historial(page).getByRole("button", { name: /¿Qué multas recibió en 2024\?/ }).click();

    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT.")).toBeVisible();
    await expect(page.getByText("memoria-andina-2024.md")).toBeVisible();
    await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
    await expect(campo(page, "Sector")).toHaveValue("MINERIA");
    await expect(campo(page, "Empresa")).toHaveValue("e-andina");
    await expect(campo(page, "Año")).toHaveValue("2024");
    await expect(campo(page, "Empresa")).toBeDisabled();

    await page.getByRole("button", { name: "Nueva conversación" }).click();
    await expect(page.getByText("¿Qué quieres saber?")).toBeVisible();
    await expect(page.getByText("Conversación nueva")).toBeVisible();
    await expect(campo(page, "Empresa")).toBeEnabled();
    await expect(campo(page, "Empresa")).toHaveValue("e-andina");
  });

  test("avisa antes de cambiar a otro chat si el actual no está guardado", async ({ page }) => {
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
    await preguntar(page, "¿Qué sanciones tiene?");
    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT por incumplimiento ambiental.")).toBeVisible();

    await page.getByRole("button", { name: "Historial" }).click();
    await historial(page).getByRole("button", { name: /¿Qué multas recibió en 2024\?/ }).click();
    await expect(historial(page).getByRole("alert")).toContainText("Tu chat actual no está guardado");
    await historial(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("¿Qué sanciones tiene?")).toBeVisible();

    await historial(page).getByRole("button", { name: /¿Qué multas recibió en 2024\?/ }).click();
    await historial(page).getByRole("button", { name: "Abrir igual" }).click();
    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT.")).toBeVisible();
    await expect(page.getByText("¿Qué sanciones tiene?")).toHaveCount(0);
  });

  test("un chat de una empresa desactivada se puede leer, pero no admite preguntas", async ({ page, api }) => {
    api.empresas.find((e) => e.id === "e-andina")!.activa = false;
    await page.reload();
    await page.getByRole("button", { name: "Historial" }).click();
    const item = historial(page).getByRole("button", { name: /¿Qué multas recibió en 2024\?/ });
    await expect(item).toContainText("Empresa desactivada");
    await item.click();
    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT.")).toBeVisible();
    await expect(page.getByText("Solo lectura")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Pregunta para el asistente" })).toBeDisabled();
    await expect(campo(page, "Empresa")).toHaveValue("e-andina");
  });
});

test.describe("Respuestas con interpretación y estado registrado", () => {
  const preguntar = async (page: Page, texto: string) => {
    await page.getByRole("textbox", { name: "Pregunta para el asistente" }).fill(texto);
    await page.getByRole("button", { name: "Consultar" }).click();
  };

  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "administrador", "/ia");
    await elegirContexto(page, "Minería", "Minera Andina S.A.A.", 2024);
  });

  test("al pedir expectativas, muestra los hechos citados y aparte la interpretación del asistente", async ({ page, api }) => {
    await preguntar(page, "¿Qué expectativas hay sobre su riesgo ambiental?");
    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT por incumplimiento ambiental.")).toBeVisible();
    const interpretacion = page.getByRole("region", { name: "Interpretación del asistente" });
    await expect(interpretacion).toContainText("La multa sugiere un riesgo regulatorio ambiental relevante");
    await expect(interpretacion).toContainText("No es contenido del documento");
    await expect(page.getByText("Fuentes citadas")).toBeVisible();

    // Al guardar el chat, la respuesta va completa, con su interpretación.
    await page.getByRole("button", { name: "Guardar chat" }).click();
    await expect(page.getByText("Chat guardado en tu historial.")).toBeVisible();
    const mensajes = (api.llamadasA("POST", "/asistente/conversaciones")[0].cuerpo as { mensajes: { respuesta?: { interpretacion?: string } }[] }).mensajes;
    expect(mensajes[1].respuesta?.interpretacion).toMatch(/^La multa sugiere/);
  });

  test("una pregunta factual no muestra interpretación", async ({ page }) => {
    await preguntar(page, "¿Qué sanciones tiene?");
    await expect(page.getByText("Se identifica una multa del OEFA de 59.078 UIT por incumplimiento ambiental.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Interpretación del asistente" })).toHaveCount(0);
  });

  test("si se descartó la interpretación, lo avisa sin mostrarla", async ({ page }) => {
    await page.route("**/asistente/consultas", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          respuesta: "Se identifica una multa [1].",
          afirmaciones: [{ texto: "Se identifica una multa del OEFA.", referencias: [1], cita_textual: "OEFA impuso una multa de 59.078 UIT." }],
          citas: [{ referencia: 1, documento_id: "d-andina-2024", documento_nombre: "memoria-andina-2024.md", empresa_id: "e-andina", empresa_nombre: "Minera Andina S.A.A.", anio: 2024, seccion: "Contingencias", extracto: "OEFA impuso una multa de 59.078 UIT." }],
          sin_evidencia: false,
          interpretacion: null,
          interpretacion_descartada: true,
        }),
      }),
    );
    await preguntar(page, "¿Qué implicancias tiene?");
    await expect(page.getByText("Se omitió la interpretación del asistente porque no pudo apoyarse en los hechos citados.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Interpretación del asistente" })).toHaveCount(0);
  });

  test("al preguntar el estado de un código GRI, responde desde Análisis GRI y sin fuentes del documento", async ({ page }) => {
    await preguntar(page, "¿Qué estado tiene GRI 305?");
    const estado = page.getByRole("region", { name: "Estado registrado en Análisis GRI" });
    await expect(estado).toContainText("Desde Análisis GRI");
    await expect(estado).toContainText("GRI 305 (2016): OK.");
    await expect(estado).toContainText("detectar un código en el documento no demuestra cumplimiento");
    await expect(page.getByText("Fuentes citadas")).toHaveCount(0);
    // El texto no se repite fuera del bloque.
    await expect(page.getByText("GRI 305 (2016): OK.", { exact: false })).toHaveCount(1);
  });
});
