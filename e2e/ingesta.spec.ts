import { test, expect, entrarComo, campo } from "./support/fixtures";
import type { Page } from "@playwright/test";
import type { ServicioSimulado } from "./support/servicio-simulado";

const archivoMd = (name: string, contenido = "# Reporte de sostenibilidad\n\nGRI 305-1: emisiones directas.\n") => ({
  name,
  mimeType: "text/markdown",
  buffer: Buffer.from(contenido),
});

test.describe("Caso de uso: Ingestar documentos", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/ingesta");
    await expect(page.getByRole("heading", { name: "Ingesta de documentos" })).toBeVisible();
  });

  test("sube un .md y aparece en Documentos ingestados", async ({ page, api }) => {
    await page.getByRole("button", { name: "Nueva carga" }).click();
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    await campo(page, "Año").selectOption("2025");
    await campo(page, "Tipo").selectOption({ label: "Reporte de Sostenibilidad GRI" });
    await page.locator('input[type="file"]').setInputFiles(archivoMd("gri-andina-2025.md"));
    await page.getByRole("button", { name: "Realizar ingesta" }).click();

    await expect(page.getByText("Documento ingestado e indexado.")).toBeVisible();
    await expect(page.getByText("Ingesta completada")).toBeVisible();
    await expect(page.getByText(/· 4 fragmentos$/)).toBeVisible();
    await expect(page.locator("tbody")).toContainText("gri-andina-2025.md");
    expect(api.llamadasA("POST", /\/ingesta$/)[0].cuerpo).toMatchObject({
      archivo: "gri-andina-2025.md",
      empresa_id: "e-andina",
      anio: "2025",
      tipo_documento: "REPORTE_SOSTENIBILIDAD_GRI",
    });
  });

  test("rechaza archivos que no son Markdown o están vacíos", async ({ page, api }) => {
    await page.getByRole("button", { name: "Nueva carga" }).click();
    await campo(page, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    const entrada = page.locator('input[type="file"]');

    await entrada.setInputFiles({ name: "memoria.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText("El archivo debe tener extensión .md.")).toBeVisible();

    await entrada.setInputFiles(archivoMd("vacio.md", ""));
    await expect(page.getByText("El archivo está vacío.")).toBeVisible();

    await expect(page.getByRole("button", { name: "Realizar ingesta" })).toBeDisabled();
    expect(api.llamadasA("POST", "/documentos/operaciones")).toHaveLength(0);
  });

  test("al elegir sector solo ofrece las empresas activas de ese sector", async ({ page }) => {
    await page.getByRole("button", { name: "Nueva carga" }).click();
    await campo(page, "Sector").selectOption({ label: "Petróleo y Gas" });
    // Petro Norte está desactivada: no debe ofrecerse para nuevas cargas.
    await expect(campo(page, "Empresa").locator("option")).toHaveText([
      "— Selecciona una empresa —",
      "Petro Sur S.A.",
    ]);
  });

  test("en Tipo deshabilita lo que la empresa ya cargó para ese año", async ({ page, api }) => {
    await page.getByRole("button", { name: "Nueva carga" }).click();
    const dialogo = page.getByRole("dialog");
    const tipo = campo(dialogo, "Tipo");
    const memoria = tipo.locator("option", { hasText: "Memoria Anual" });
    const gri = tipo.locator("option", { hasText: "Reporte de Sostenibilidad GRI" });

    // Minera Andina ya tiene la Memoria Anual 2024: esa opción se deshabilita y se elige la otra.
    await campo(dialogo, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    await campo(dialogo, "Año").selectOption("2024");
    await expect(memoria).toHaveJSProperty("disabled", true);
    await expect(memoria).toHaveText("Memoria Anual — ya cargado");
    await expect(gri).toHaveJSProperty("disabled", false);
    await expect(tipo).toHaveValue("REPORTE_SOSTENIBILIDAD_GRI");
    expect(Object.fromEntries(api.llamadasA("GET", "/documentos/disponibilidad").at(-1)!.query)).toEqual({ empresa_id: "e-andina", anio: "2024" });

    // Al cargar el reporte, ya no queda ningún tipo libre para ese año.
    await page.locator('input[type="file"]').setInputFiles(archivoMd("gri-andina-2024.md"));
    await dialogo.getByRole("button", { name: "Realizar ingesta" }).click();
    await expect(dialogo.getByText("Ingesta completada")).toBeVisible();
    await expect(gri).toHaveJSProperty("disabled", true);
    await expect(dialogo.getByText("Esta empresa ya tiene la Memoria Anual y el Reporte de Sostenibilidad GRI de 2024. Elige otro año.")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(archivoMd("otro.md"));
    await expect(dialogo.getByRole("button", { name: "Realizar ingesta" })).toBeDisabled();

    // Otro año vuelve a tener ambos tipos disponibles.
    await campo(dialogo, "Año").selectOption("2023");
    await expect(memoria).toHaveJSProperty("disabled", false);
    await expect(gri).toHaveJSProperty("disabled", false);
    await expect(dialogo.getByText(/Elige otro año\.$/)).toHaveCount(0);
  });

  test("la lista ocupa todo el ancho y la carga se hace en un modal que no se cierra mientras procesa", async ({ page, api }) => {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Nueva carga" }).click();
    const dialogo = page.getByRole("dialog");
    await campo(dialogo, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    await page.locator('input[type="file"]').setInputFiles(archivoMd("lento.md"));
    api.retrasar("POST", /\/ingesta$/, 1500);
    await dialogo.getByRole("button", { name: "Realizar ingesta" }).click();

    await expect(dialogo.getByText("Procesando…")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await expect(dialogo.getByText("Ingesta completada")).toBeVisible();
    await expect(page.locator("tbody")).toContainText("lento.md");
    await dialogo.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Al volver a abrir, el formulario está limpio.
    await page.getByRole("button", { name: "Nueva carga" }).click();
    await expect(campo(page.getByRole("dialog"), "Empresa")).toHaveValue("");
    await expect(page.getByRole("dialog").getByText("Ingesta completada")).toHaveCount(0);
  });

  test("filtra la lista de documentos por sector", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);

    // Los filtros están plegados en el botón «Filtros», que además indica cuántos hay activos.
    const filtros = page.getByRole("button", { name: /^Filtros/ });
    await expect(page.getByLabel("Filtrar por sector")).toHaveCount(0);
    await filtros.click();
    await page.getByLabel("Filtrar por sector").selectOption({ label: "Petróleo y Gas" });
    await expect(filas).toHaveCount(2);
    await expect(page.locator("tbody")).toContainText("Petro Sur S.A.");
    await expect(page.locator("tbody")).not.toContainText("Minera Andina S.A.A.");

    await filtros.click();
    await expect(page.getByLabel("Filtrar por sector")).toHaveCount(0);
    await expect(filtros).toContainText("1");
    await expect(filas).toHaveCount(2);

    await filtros.click();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(filas).toHaveCount(4);
  });

  test("busca por una parte del nombre de la empresa, sin distinguir mayúsculas ni tildes", async ({ page, api }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);
    const antes = api.llamadasA("GET", "/documentos").length;
    const buscar = page.getByRole("searchbox", { name: "Buscar por empresa" });

    await buscar.pressSequentially("PETRO");
    await expect(filas).toHaveCount(2);
    await expect(page.locator("tbody")).not.toContainText("Minera Andina S.A.A.");
    // Se traen los documentos una sola vez, no una petición por cada letra.
    expect(api.llamadasA("GET", "/documentos").length - antes).toBe(1);

    await buscar.fill("minéra");
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Minera Andina S.A.A.");

    await buscar.fill("no existe");
    await expect(page.getByText("No hay documentos que coincidan con la búsqueda y los filtros.")).toBeVisible();

    await page.getByRole("button", { name: "Borrar búsqueda" }).click();
    await expect(buscar).toHaveValue("");
    await expect(filas).toHaveCount(4);
  });

  test("la búsqueda se combina con los filtros", async ({ page }) => {
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);
    await page.getByRole("searchbox", { name: "Buscar por empresa" }).fill("petro");
    await expect(filas).toHaveCount(2);

    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByLabel("Filtrar por tipo").selectOption({ label: "Memoria Anual" });
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Norte S.A.");
  });

  test("la columna Estado solo muestra Completado, En proceso o Fallido y el filtro reúne los estados", async ({ page, api }) => {
    const [andina, psur, pnorte, utec] = api.documentos;
    andina.estado = "CONFIRMACION_PENDIENTE";
    psur.estado = "FALLIDO_LIMPIEZA_PENDIENTE";
    pnorte.estado = "COMPLETADO"; // Petro Norte está desactivada: su fila se ve como Inactivo.
    utec.estado = "PUBLICACION_PENDIENTE";
    await page.reload();
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);

    // En la tabla no queda ningún estado interno a la vista.
    const estados = filas.locator("td:nth-child(4)");
    await expect(estados).toHaveText(["En proceso", "Fallido", "Inactivo", "En proceso"], { ignoreCase: true });
    for (const crudo of [/confirmaci/i, /publicaci/i, /limpieza/i, /_/]) await expect(page.locator("tbody")).not.toContainText(crudo);

    // Exactamente «Todos» y las tres opciones.
    await page.getByRole("button", { name: /^Filtros/ }).click();
    const filtro = page.getByLabel("Filtrar por estado");
    await expect(filtro.locator("option")).toHaveText(["Todos", "Completados", "En curso", "Fallidos"]);

    // «En curso» une tres estados: una consulta por cada uno.
    const antes = api.llamadasA("GET", "/documentos").length;
    await filtro.selectOption({ label: "En curso" });
    await expect(filas).toHaveCount(2);
    await expect(page.locator("tbody")).toContainText("Minera Andina S.A.A.");
    await expect(page.locator("tbody")).toContainText("Utec ELEC");
    const pedidos = api.llamadasA("GET", "/documentos").slice(antes).map((l) => l.query.get("estado"));
    expect(pedidos.sort()).toEqual(["CONFIRMACION_PENDIENTE", "EN_PROCESO", "PUBLICACION_PENDIENTE"]);

    await filtro.selectOption({ label: "Fallidos" });
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Sur");

    await filtro.selectOption({ label: "Completados" });
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Norte S.A.");
    expect(api.llamadasA("GET", "/documentos").at(-1)!.query.get("estado")).toBe("COMPLETADO");

    await filtro.selectOption({ label: "Todos" });
    await expect(filas).toHaveCount(4);
  });

  test("muestra el detalle de un documento con el nombre de quien lo cargó", async ({ page }) => {
    await page.getByRole("row", { name: /memoria-andina-2024.md/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Detalle del documento")).toBeVisible();
    await expect(dialogo).toContainText("Minera Andina S.A.A.");
    await expect(dialogo).toContainText("Memoria Anual");
    await expect(dialogo).toContainText("memoria-andina-2024.md");
    // El backend manda el ID del usuario: se muestra su nombre, nunca el ID.
    await expect(dialogo).toContainText("Oscar Baldeón");
    await expect(dialogo).not.toContainText("u-super");
  });

  test("al abrir el detalle se ve un solo indicador de carga (el del modal)", async ({ page, api }) => {
    // Carga lenta con margen de sobra: el modal debe seguir «Cargando…» durante todas las comprobaciones.
    api.retrasar("GET", /^\/documentos\/d-andina-2024$/, 4000);
    await page.getByRole("row", { name: /memoria-andina-2024.md/ }).click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Cargando…")).toBeVisible();
    await page.waitForTimeout(1000); // el indicador global, si se disparara, ya estaría visible (~600 ms)
    // Comprobación puntual (sin reintentos): mientras el modal carga, no hay indicador global.
    expect(await page.getByTestId("carga-global").count()).toBe(0);
    await expect(dialogo.getByText("Cargando…")).toBeVisible();
    await expect(dialogo).toContainText("memoria-andina-2024.md");
  });

  test("la huella SHA-256 queda en «Detalles técnicos», plegada y explicada", async ({ page }) => {
    await page.getByRole("row", { name: /memoria-andina-2024.md/ }).click();
    const dialogo = page.getByRole("dialog");
    const huella = dialogo.getByText("Huella del archivo (SHA-256)");
    await expect(huella).toBeHidden();

    await dialogo.getByText("Detalles técnicos").click();
    await expect(huella).toBeVisible();
    await expect(dialogo.getByText("permite detectar cargas duplicadas")).toBeVisible();
    await expect(dialogo.getByRole("button", { name: "Copiar huella" })).toBeVisible();
  });

  test("los documentos de una empresa desactivada se ven como Inactivo", async ({ page }) => {
    const fila = page.getByRole("row", { name: /memoria-petro-norte-2025.md/ });
    await expect(fila).toContainText("Inactivo");

    await fila.click();
    await expect(page.getByRole("dialog")).toContainText("La empresa de este documento está desactivada en el catálogo.");
  });
});

test.describe("Paginación de los documentos ingestados", () => {
  test("usa la misma paginación que el resto: primera y última, números, «Ir a» e indicador", async ({ page, api }) => {
    api.agregarDocumentos(196); // 4 + 196 = 200 documentos → 20 páginas de 10
    await entrarComo(page, api, "superadmin", "/ingesta");
    const nav = page.getByRole("navigation", { name: "Paginación" });
    await expect(nav.getByText("Página 1 de 20")).toBeVisible();
    for (const n of [1, 2, 20]) await expect(nav.getByRole("button", { name: `Página ${n}`, exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Anterior" })).toBeDisabled();

    await nav.getByRole("spinbutton", { name: "Ir a la página" }).fill("7");
    await nav.getByRole("button", { name: "Ir", exact: true }).click();
    await expect(nav.getByText("Página 7 de 20")).toBeVisible();
    await expect(nav.getByRole("button", { name: "Página 7", exact: true })).toHaveAttribute("aria-current", "page");
    expect(api.llamadasA("GET", "/documentos").at(-1)!.query.get("pagina")).toBe("7");

    await nav.getByRole("button", { name: "Siguiente" }).click();
    await expect(nav.getByText("Página 8 de 20")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(10);
  });

  test("también pagina los resultados de la búsqueda", async ({ page, api }) => {
    api.agregarDocumentos(26); // 27 documentos de Minera Andina, de un total de 30
    await entrarComo(page, api, "superadmin", "/ingesta");
    await page.getByRole("searchbox", { name: "Buscar por empresa" }).fill("minera");

    const nav = page.getByRole("navigation", { name: "Paginación" });
    await expect(nav.getByText("Página 1 de 3")).toBeVisible();
    await nav.getByRole("button", { name: "Página 3", exact: true }).click();
    await expect(nav.getByText("Página 3 de 3")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(7);
  });
});

test.describe("Doble check: la carga se pausa tras el análisis", () => {
  // Andina 2025 tiene libre el Reporte GRI: la carga se pausa y espera que el SuperAdmin decida.
  async function cargarEnPausa(page: Page, api: ServicioSimulado) {
    api.pausarIngesta = true;
    await page.getByRole("button", { name: "Nueva carga" }).click();
    const dialogo = page.getByRole("dialog");
    await campo(dialogo, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    await campo(dialogo, "Año").selectOption("2025");
    await campo(dialogo, "Tipo").selectOption({ label: "Reporte de Sostenibilidad GRI" });
    await page.locator('input[type="file"]').setInputFiles(archivoMd("gri-andina-2025.md"));
    await dialogo.getByRole("button", { name: "Realizar ingesta" }).click();
    await expect(dialogo.getByRole("heading", { name: "Revisa el análisis antes de continuar" })).toBeVisible();
    return dialogo;
  }

  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/ingesta");
    await expect(page.getByRole("heading", { name: "Ingesta de documentos" })).toBeVisible();
  });

  test("un 202 muestra el resumen para decidir y «Continuar» completa la carga", async ({ page, api }) => {
    const dialogo = await cargarEnPausa(page, api);

    // No es un error: se muestra el resumen, sin consultar en bucle ni decir que falló.
    await expect(dialogo.getByText("Se detectaron 3 grupos GRI y 1 mención de sanciones.")).toBeVisible();
    await expect(dialogo.getByText("Con hallazgos")).toBeVisible();
    await expect(dialogo.getByText("Si nadie decide, la carga se cancelará sola a los 30 minutos", { exact: false })).toBeVisible();
    await expect(page.getByText("La ingesta no se completó")).toHaveCount(0);
    expect(api.llamadasA("GET", /^\/documentos\/operaciones\//)).toHaveLength(0);
    await expect(dialogo.getByRole("button", { name: "Realizar ingesta" })).toBeDisabled();
    await expect(dialogo.getByRole("button", { name: "Decidir después" })).toBeVisible();
    // Los códigos técnicos no se muestran tal cual.
    await dialogo.getByText("Detalle técnico").click();
    await expect(dialogo.getByText("Tiene referencias GRI del catálogo.")).toBeVisible();
    await expect(dialogo).not.toContainText("referencias_gri_catalogadas");

    await dialogo.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(page.getByText("Documento ingestado e indexado.")).toBeVisible();
    await expect(dialogo.getByText("Ingesta completada")).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Revisa el análisis antes de continuar" })).toHaveCount(0);
    expect(api.llamadasA("POST", /\/confirmar$/)).toHaveLength(1);
    const fila = page.getByRole("row", { name: /gri-andina-2025\.md/ });
    await expect(fila.getByText("Completado")).toBeVisible();
  });

  test("«Cancelar y eliminar» pide confirmación, informa la cancelación y libera el cupo", async ({ page, api }) => {
    const dialogo = await cargarEnPausa(page, api);

    await dialogo.getByRole("button", { name: "Cancelar y eliminar" }).click();
    await expect(dialogo.getByText("¿Cancelar la carga?", { exact: false })).toBeVisible();
    await dialogo.getByRole("button", { name: "Volver" }).click();
    expect(api.llamadasA("POST", /\/cancelar$/)).toHaveLength(0);

    await dialogo.getByRole("button", { name: "Cancelar y eliminar" }).click();
    await dialogo.getByRole("button", { name: "Sí, cancelar y eliminar" }).click();
    await expect(page.getByText("Carga cancelada. Ya puedes volver a cargar ese documento.")).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Carga cancelada" })).toBeVisible();
    await expect(dialogo.getByText("Ingesta no completada")).toHaveCount(0);
    await expect(dialogo.getByRole("button", { name: "Reintentar publicación" })).toHaveCount(0);

    // El tipo vuelve a estar disponible para esa empresa y año.
    await expect(campo(dialogo, "Tipo").locator("option", { hasText: "Reporte de Sostenibilidad GRI" })).toHaveJSProperty("disabled", false);
    await expect(page.getByRole("row", { name: /gri-andina-2025\.md/ }).getByText("Fallido")).toBeVisible();
  });

  test("si otra persona ya decidió (409), se muestra cómo quedó sin bloquear la pantalla", async ({ page, api }) => {
    const dialogo = await cargarEnPausa(page, api);
    api.documentos[0].estado = "COMPLETADO"; // la resolvió otra persona

    await dialogo.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(page.getByText("Esta carga ya se había resuelto. Se muestra cómo quedó.")).toBeVisible();
    await expect(dialogo.getByText("Ingesta completada")).toBeVisible();
    await expect(dialogo.getByRole("button", { name: "Cerrar" })).toBeEnabled();
    expect(api.llamadasA("GET", /^\/documentos\/operaciones\//)).toHaveLength(1);
  });

  test("si la publicación queda pendiente (502), ofrece reintentarla", async ({ page, api }) => {
    const dialogo = await cargarEnPausa(page, api);
    api.fallarPublicacionAlConfirmar = true;

    await dialogo.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(page.getByText("El documento se cargó, pero falta publicarlo.", { exact: false })).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Falta publicar el documento" })).toBeVisible();

    await dialogo.getByRole("button", { name: "Reintentar publicación" }).click();
    await expect(page.getByText("Publicación completada.")).toBeVisible();
    await expect(dialogo.getByText("Ingesta completada")).toBeVisible();
  });

  test("sin conexión, el panel sigue abierto para volver a decidir", async ({ page, api }) => {
    const dialogo = await cargarEnPausa(page, api);
    await page.route("**/confirmar", (r) => r.abort());

    await dialogo.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(page.getByText("No se pudo conectar con el servidor.")).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Revisa el análisis antes de continuar" })).toBeVisible();
    await expect(dialogo.getByRole("button", { name: "Continuar con la ingesta" })).toBeEnabled();

    await page.unroute("**/confirmar");
    await dialogo.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(dialogo.getByText("Ingesta completada")).toBeVisible();
  });

  test("si se cierra sin decidir, se retoma desde la lista con «Revisar decisión»", async ({ page, api }) => {
    const dialogo = await cargarEnPausa(page, api);
    await dialogo.getByRole("button", { name: "Decidir después" }).click();
    await expect(page.getByText("La carga quedó en pausa.", { exact: false })).toBeVisible();
    expect(api.llamadasA("POST", /\/(confirmar|cancelar)$/)).toHaveLength(0);

    // En la lista se ve como «En proceso», con la acción para decidir.
    const fila = page.getByRole("row", { name: /gri-andina-2025\.md/ });
    await expect(fila.getByText("En proceso")).toBeVisible();
    await fila.getByRole("button", { name: "Revisar decisión" }).click();

    const decision = page.getByRole("dialog");
    await expect(decision.getByRole("heading", { name: "Decisión pendiente" })).toBeVisible();
    await expect(decision.getByText("Minera Andina S.A.A. · 2025 · Reporte de Sostenibilidad GRI · gri-andina-2025.md")).toBeVisible();
    await decision.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(decision.getByText("Ingesta completada")).toBeVisible();
    await decision.getByRole("button", { name: "Cerrar" }).click();
    await expect(fila.getByText("Completado")).toBeVisible();
    await expect(fila.getByRole("button", { name: "Revisar decisión" })).toHaveCount(0);
  });

  test("si al retomarla ya estaba resuelta, lo avisa y muestra cómo quedó", async ({ page, api }) => {
    const dialogo = await cargarEnPausa(page, api);
    await dialogo.getByRole("button", { name: "Decidir después" }).click();
    const fila = page.getByRole("row", { name: /gri-andina-2025\.md/ });
    await expect(fila.getByRole("button", { name: "Revisar decisión" })).toBeVisible();
    api.documentos[0].estado = "FALLIDO"; // venció mientras tanto

    await fila.getByRole("button", { name: "Revisar decisión" }).click();
    await expect(page.getByText("Esta carga ya se había resuelto. Se muestra cómo quedó.")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Ingesta no completada")).toBeVisible();
  });
});

test.describe("Barra de progreso de los 9 pasos de la ingesta", () => {
  const estadoBarra = (page: Page) => page.getByRole("dialog").getByRole("region", { name: "Progreso de la ingesta" }).getByRole("status");
  const paso = (page: Page, n: number) => page.getByRole("dialog").getByRole("listitem").nth(n - 1);

  async function iniciarCarga(page: Page) {
    await page.getByRole("button", { name: "Nueva carga" }).click();
    const dialogo = page.getByRole("dialog");
    await campo(dialogo, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    await campo(dialogo, "Año").selectOption("2025");
    await campo(dialogo, "Tipo").selectOption({ label: "Reporte de Sostenibilidad GRI" });
    await page.locator('input[type="file"]').setInputFiles(archivoMd("gri-andina-2025.md"));
    await dialogo.getByRole("button", { name: "Realizar ingesta" }).click();
    return dialogo;
  }

  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/ingesta");
    await expect(page.getByRole("heading", { name: "Ingesta de documentos" })).toBeVisible();
  });

  test("avanza paso a paso MIENTRAS se procesa, se detiene en el 6 y termina al continuar", async ({ page, api }) => {
    // Reloj simulado: cada consulta del avance (cada 1,5 s) ocurre cuando la prueba lo decide.
    await page.clock.install();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Ingesta de documentos" })).toBeVisible();
    const tic = () => page.clock.runFor(1500);
    api.pausarIngesta = true;
    api.etapasDuranteIngesta = ["RESERVADO", "ALMACENANDO_ORIGINAL", "INDEXANDO", "ANALIZANDO"];
    const soltarCarga = api.retener("POST", /\/ingesta$/);
    const dialogo = await iniciarCarga(page);
    const barra = dialogo.getByRole("progressbar", { name: "Avance de la ingesta" });

    // Aparece al instante con el paso 1, antes de que responda el servidor.
    await expect(estadoBarra(page)).toHaveText("Paso 1 de 9: Validar");
    await expect(paso(page, 1)).toHaveAttribute("aria-current", "step");
    await expect(dialogo.getByRole("listitem")).toHaveCount(9);
    // Es el único indicador: el botón no muestra otro.
    await expect(dialogo.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    await expect(dialogo.locator("button .animate-spin")).toHaveCount(0);

    // Mientras la carga sigue sin responder, cada consulta trae la etapa real.
    for (const texto of ["Paso 2 de 9: Reservar", "Paso 3 de 9: Guardar", "Paso 4 de 9: Fragmentar · 2 de 4 fragmentos", "Paso 5 de 9: Analizar"]) {
      await tic();
      await expect(estadoBarra(page)).toHaveText(texto);
    }
    await expect(paso(page, 3)).toContainText("completado");
    await expect(paso(page, 5)).toHaveAttribute("aria-current", "step");
    await expect(barra).toHaveAttribute("value", "50");

    // El servidor responde 202: se detiene en el paso 6 a esperar la decisión.
    soltarCarga();
    await expect(estadoBarra(page)).toHaveText("Paso 6 de 9: esperando tu decisión");
    await expect(paso(page, 6)).toContainText("en pausa");
    await expect(dialogo.getByRole("heading", { name: "Revisa el análisis antes de continuar" })).toBeVisible();

    // Al continuar, la barra sigue los pasos 7 y 8 hasta completar los 9.
    api.etapasDuranteConfirmacion = ["COMPLETANDO", "PUBLICANDO"];
    const soltarConfirmacion = api.retener("POST", /\/confirmar$/);
    await dialogo.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(estadoBarra(page)).toHaveText("Paso 6 de 9: Confirmar");
    await tic();
    await expect(estadoBarra(page)).toHaveText("Paso 7 de 9: Completar");
    await tic();
    await expect(estadoBarra(page)).toHaveText("Paso 8 de 9: Publicar");
    soltarConfirmacion();
    await expect(estadoBarra(page)).toHaveText("Completada: 9 de 9 pasos");
    await expect(barra).toHaveAttribute("value", "100");
    await expect(dialogo.getByText("Ingesta completada")).toBeVisible();
  });

  test("una carga sin pausa completa los 9 pasos", async ({ page }) => {
    await iniciarCarga(page);
    await expect(estadoBarra(page)).toHaveText("Completada: 9 de 9 pasos");
    for (let n = 1; n <= 9; n++) await expect(paso(page, n)).toContainText("completado");
  });

  test("si la carga se rechaza, marca el paso 1 en rojo y deja de consultar", async ({ page, api }) => {
    await page.clock.install();
    await page.route("**/ingesta", (r) =>
      r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "DUPLICATE_DOCUMENT", message: "Ese documento ya fue cargado." } }) }),
    );
    await iniciarCarga(page);
    await expect(page.getByText("Ese documento ya fue cargado.")).toBeVisible();
    await expect(estadoBarra(page)).toHaveText("La ingesta se detuvo en el paso 1: Validar");
    await expect(paso(page, 1)).toContainText("con error");
    const consultas = api.llamadasA("GET", /^\/documentos\/operaciones\//).length;
    await page.clock.runFor(5000); // varios intervalos de consulta
    expect(api.llamadasA("GET", /^\/documentos\/operaciones\//)).toHaveLength(consultas);
  });

  test("al cancelar, el paso 6 queda como cancelado (no como error)", async ({ page, api }) => {
    api.pausarIngesta = true;
    const dialogo = await iniciarCarga(page);
    await dialogo.getByRole("button", { name: "Cancelar y eliminar" }).click();
    await dialogo.getByRole("button", { name: "Sí, cancelar y eliminar" }).click();
    await expect(estadoBarra(page)).toHaveText("Cancelada en el paso 6");
    await expect(paso(page, 6)).toContainText("cancelado");
    for (let n = 7; n <= 9; n++) await expect(paso(page, n)).toContainText("pendiente");
  });

  test("con la publicación pendiente, el paso 8 queda en ámbar hasta reintentar", async ({ page, api }) => {
    api.pausarIngesta = true;
    api.fallarPublicacionAlConfirmar = true;
    const dialogo = await iniciarCarga(page);
    await dialogo.getByRole("button", { name: "Continuar con la ingesta" }).click();
    await expect(estadoBarra(page)).toHaveText("Paso 8 de 9: falta publicar");
    await expect(paso(page, 8)).toContainText("en pausa");
    await dialogo.getByRole("button", { name: "Reintentar publicación" }).click();
    await expect(estadoBarra(page)).toHaveText("Completada: 9 de 9 pasos");
  });
});

test.describe("Deshabilitar un documento", () => {
  test.beforeEach(async ({ page, api }) => {
    await entrarComo(page, api, "superadmin", "/ingesta");
    await expect(page.getByRole("heading", { name: "Ingesta de documentos" })).toBeVisible();
  });

  test("se confirma escribiendo «deshabilitar»; luego lo marca y libera su lugar", async ({ page, api }) => {
    const fila = page.getByRole("row", { name: /memoria-andina-2024\.md/ });
    // «Ver» primero y «Deshabilitar» a la derecha.
    await expect(fila.locator("td").last()).toHaveText(/Ver.*Deshabilitar/);
    await fila.getByRole("button", { name: "Deshabilitar memoria-andina-2024.md" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("heading", { name: "Deshabilitar documento" })).toBeVisible();
    await expect(dialogo.getByText("No se puede deshacer.")).toBeVisible();
    await expect(dialogo.getByLabel("Motivo")).toHaveCount(0);
    const boton = dialogo.getByRole("button", { name: "Deshabilitar este documento" });
    const palabra = dialogo.getByLabel("Para confirmar, escribe «deshabilitar» abajo");

    await expect(boton).toBeDisabled();
    await palabra.fill("Deshabilitar");
    await expect(boton).toBeDisabled();
    await palabra.fill("deshabilitar");
    await expect(boton).toBeEnabled();
    await boton.click();

    await expect(page.getByText("Documento deshabilitado. Ya puedes cargar un reemplazo para Minera Andina S.A.A. 2024.")).toBeVisible();
    await expect(dialogo).toBeHidden();
    // El backend exige un motivo: se envía uno fijo.
    expect(api.llamadasA("POST", /\/deshabilitar$/)[0].cuerpo).toEqual({ motivo: "Deshabilitado por el SuperAdmin desde Ingesta de documentos." });
    await expect(fila.getByText("Deshabilitado")).toBeVisible();
    await expect(fila.getByRole("button", { name: /^Deshabilitar/ })).toHaveCount(0);

    // El detalle explica cuándo, quién y por qué.
    await fila.click();
    const detalle = page.getByRole("dialog");
    await expect(detalle.getByText("Documento deshabilitado")).toBeVisible();
    await expect(detalle.getByText("Motivo: Deshabilitado por el SuperAdmin desde Ingesta de documentos.")).toBeVisible();
    await expect(detalle).toContainText("por Oscar Baldeón");
    await page.keyboard.press("Escape");

    // Su lugar queda libre para cargar un reemplazo.
    await page.getByRole("button", { name: "Nueva carga" }).click();
    const carga = page.getByRole("dialog");
    await campo(carga, "Empresa").selectOption({ label: "Minera Andina S.A.A." });
    await campo(carga, "Año").selectOption("2024");
    await expect(campo(carga, "Tipo").locator("option", { hasText: "Memoria Anual" })).toHaveJSProperty("disabled", false);
  });

  test("filtra por habilitados y deshabilitados", async ({ page, api }) => {
    Object.assign(api.documentos[1], { deshabilitado: true, motivo_deshabilitacion: "Duplicado" });
    await page.reload();
    const filas = page.locator("tbody tr");
    await expect(filas).toHaveCount(4);

    await page.getByRole("button", { name: /^Filtros/ }).click();
    const filtro = page.getByLabel("Filtrar por habilitación");
    await expect(filtro.locator("option")).toHaveText(["Todos", "Habilitados", "Deshabilitados"]);
    await filtro.selectOption({ label: "Deshabilitados" });
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText("Petro Sur S.A.");
    await expect(filas.first()).toContainText("Deshabilitado");
    await filtro.selectOption({ label: "Habilitados" });
    await expect(filas).toHaveCount(3);
    await expect(page.locator("tbody")).not.toContainText("Petro Sur S.A.");
  });

  test("si el servidor no lo permite, lo explica sin cerrar la confirmación", async ({ page }) => {
    await page.route("**/deshabilitar", (r) =>
      r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "DOCUMENT_NOT_DISABLEABLE", message: "Solo se puede deshabilitar un documento completado." } }) }),
    );
    await page.getByRole("button", { name: "Deshabilitar memoria-andina-2024.md" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Para confirmar, escribe «deshabilitar» abajo").fill("deshabilitar");
    await dialogo.getByRole("button", { name: "Deshabilitar este documento" }).click();
    await expect(dialogo.getByRole("alert")).toHaveText("Solo se puede deshabilitar un documento completado.");
    await expect(dialogo).toBeVisible();
  });
});
