import { describe, expect, it } from "vitest";
import type { PuntajeEsg } from "../types";
import {
  ANIO_MIN_DATOS,
  aniosConDocumentos,
  aniosDisponibles,
  ESTADOS_GRI_API,
  FLUJO_INFO,
  TIPOS_EVENTO_AUDITORIA,
  aCsv,
  finDiaUtc,
  huellaCorta,
  inicioDiaUtc,
  nombreArchivoReporte,
  nombrePersona,
  textoDescartadas,
  textoMonto,
  textoSinEvidencia,
  totalPaginas,
  MAX_BYTES_INGESTA,
  detallePuntaje,
  etiquetaEstadoGri,
  etiquetaFlujo,
  paginaValida,
  paginarLocal,
  rangoPaginas,
  tablaMarkdown,
  textoLegible,
  filtrarDocumentos,
  accionesReporte,
  etapaReporte,
  etiquetaAnioReporte,
  mensajeEmision,
  situacionAnioReporte,
  situacionEmision,
  textoSinAnios,
  bloquesPaginacion,
  plural,
  puedeValidar,
  textoMotivosNoVigente,
  valorPuntaje,
  anioIngestaValido,
  etiquetaAnalisis,
  etiquetaEstado,
  etiquetaSector,
  etiquetaTipo,
  formatearTamano,
  validarArchivoIngesta,
} from "./dominio";
import type { AnioDisponible, EstadoAnioReporte } from "../types";

describe("etiquetas de dominio", () => {
  it("traduce sectores del backend", () => {
    expect(etiquetaSector("MINERIA")).toBe("Minería");
    expect(etiquetaSector("PETROLEO")).toBe("Petróleo y Gas");
    expect(etiquetaSector("ENERGIA")).toBe("Energía");
  });

  it("traduce tipos de documento", () => {
    expect(etiquetaTipo("MEMORIA_ANUAL")).toBe("Memoria Anual");
    expect(etiquetaTipo("REPORTE_SOSTENIBILIDAD_GRI")).toBe("Reporte de Sostenibilidad GRI");
  });

  it("traduce estados de progreso", () => {
    expect(etiquetaEstado("COMPLETADO")).toBe("Completado");
    expect(etiquetaEstado("EN_PROCESO")).toBe("En proceso");
    expect(etiquetaEstado("PUBLICACION_PENDIENTE")).toBe("Publicación pendiente");
    expect(etiquetaEstado("FALLIDO")).toBe("Fallido");
    expect(etiquetaEstado("FALLIDO_LIMPIEZA_PENDIENTE")).toBe("Fallido (limpieza pendiente)");
  });

  it("traduce el resultado de análisis, con guion si falta", () => {
    expect(etiquetaAnalisis("CON_HALLAZGOS")).toBe("Con hallazgos");
    expect(etiquetaAnalisis("OBSERVADO")).toBe("Observado");
    expect(etiquetaAnalisis(null)).toBe("—");
    expect(etiquetaAnalisis(undefined)).toBe("—");
  });
});

describe("validarArchivoIngesta", () => {
  it("acepta un .md con contenido y dentro del límite", () => {
    expect(validarArchivoIngesta({ name: "memoria.md", size: 1024 })).toEqual({ ok: true });
    expect(validarArchivoIngesta({ name: "MEMORIA.MD", size: 10 })).toEqual({ ok: true });
  });

  it("rechaza extensión distinta de .md (RF-018)", () => {
    const r = validarArchivoIngesta({ name: "memoria.pdf", size: 1024 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain(".md");
  });

  it("rechaza archivo vacío", () => {
    const r = validarArchivoIngesta({ name: "vacio.md", size: 0 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("vacío");
  });

  it("rechaza si supera 50 MB (RNF-014)", () => {
    const r = validarArchivoIngesta({ name: "grande.md", size: MAX_BYTES_INGESTA + 1 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("50 MB");
  });
});

describe("anioIngestaValido", () => {
  it("acepta años en rango", () => {
    expect(anioIngestaValido(2000)).toBe(true);
    expect(anioIngestaValido(2025)).toBe(true);
  });
  it("rechaza fuera de rango o no entero", () => {
    expect(anioIngestaValido(1999)).toBe(false);
    expect(anioIngestaValido(10000)).toBe(false);
    expect(anioIngestaValido(2024.5)).toBe(false);
  });
});

describe("formatearTamano", () => {
  it("formatea bytes, KB y MB", () => {
    expect(formatearTamano(512)).toBe("512 B");
    expect(formatearTamano(2048)).toBe("2.0 KB");
    expect(formatearTamano(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("análisis GRI", () => {
  const puntajeBase: PuntajeEsg = {
    estado: "NO_DISPONIBLE",
    definitivo: false,
    valor: null,
    valor_presentacion: null,
    decimales_presentacion: 1,
    suma_puntos: null,
    filas_contadas: 0,
    filas_evaluables: 0,
    filas_sin_estado: 0,
    motivo: null,
    mensaje: null,
  };

  it("etiqueta los estados GRI y el caso sin estado", () => {
    expect(ESTADOS_GRI_API).toEqual(["OK", "BAJA_SUSTANCIA", "SUB_REPORTADO"]);
    expect(etiquetaEstadoGri("OK")).toBe("OK");
    expect(etiquetaEstadoGri("BAJA_SUSTANCIA")).toBe("Baja sustancia");
    expect(etiquetaEstadoGri("SUB_REPORTADO")).toBe("Sub-reportado");
    expect(etiquetaEstadoGri(null)).toBe("Sin estado");
    expect(etiquetaEstadoGri(undefined)).toBe("Sin estado");
  });

  it("etiqueta el flujo y sólo permite validar cuando está listo", () => {
    expect(etiquetaFlujo("LISTO_PARA_VALIDAR")).toBe("Listo para validar");
    expect(etiquetaFlujo("DOCUMENTACION_INSUFICIENTE")).toBe("Sin documentos analizados");
    expect(FLUJO_INFO.PENDIENTE_ESTADOS.descripcion).toContain("Asigna un estado");
    expect(puedeValidar("LISTO_PARA_VALIDAR")).toBe(true);
    expect(puedeValidar("PENDIENTE_ESTADOS")).toBe(false);
    expect(puedeValidar("VALIDADO")).toBe(false);
  });

  it("formatea el valor del puntaje o devuelve guion", () => {
    expect(valorPuntaje(puntajeBase)).toBe("—");
    expect(valorPuntaje({ ...puntajeBase, valor_presentacion: 66.7, decimales_presentacion: 1 })).toBe("66.7");
    expect(valorPuntaje({ ...puntajeBase, valor_presentacion: 50, decimales_presentacion: 0 })).toBe("50");
  });

  it("explica el puntaje según su estado", () => {
    expect(detallePuntaje({ ...puntajeBase, estado: "VALIDADO", filas_contadas: 4 })).toBe("Definitivo · promedio de 4 códigos GRI");
    expect(detallePuntaje({ ...puntajeBase, estado: "VALIDADO", filas_contadas: 1 })).toBe("Definitivo · promedio de 1 código GRI");
    expect(detallePuntaje({ ...puntajeBase, estado: "CALCULADO_SIN_VALIDAR", filas_contadas: 3 })).toBe("Preliminar · falta validar el análisis (3 códigos GRI)");
    expect(detallePuntaje({ ...puntajeBase, estado: "PENDIENTE_ESTADOS", filas_sin_estado: 1 })).toBe("Falta 1 código GRI por asignar estado");
    expect(detallePuntaje({ ...puntajeBase, estado: "PENDIENTE_ESTADOS", mensaje: "Faltan estados." })).toBe("Faltan estados.");
    expect(detallePuntaje({ ...puntajeBase, estado: "PENDIENTE_ESTADOS", filas_sin_estado: 2 })).toBe("Faltan 2 códigos GRI por asignar estado");
    expect(detallePuntaje(puntajeBase)).toBe("Aún no disponible");
  });

  it("arma singular y plural", () => {
    expect(plural(1, "mención", "menciones")).toBe("1 mención");
    expect(plural(0, "mención", "menciones")).toBe("0 menciones");
    expect(plural(5, "mención", "menciones")).toBe("5 menciones");
  });

  it("describe por qué una validación perdió vigencia", () => {
    expect(textoMotivosNoVigente(["ESTADOS_CAMBIARON"])).toBe("cambiaron estados de códigos GRI");
    expect(textoMotivosNoVigente(["ESTADOS_CAMBIARON", "DOCUMENTOS_CAMBIARON"])).toBe(
      "cambiaron estados de códigos GRI y cambiaron los documentos analizados",
    );
  });
});

describe("paginarLocal", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it("corta la página pedida y calcula el total de páginas", () => {
    expect(paginarLocal(items, 1, 10)).toEqual({ items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], pagina: 1, paginas: 3 });
    expect(paginarLocal(items, 3, 10)).toEqual({ items: [21, 22, 23], pagina: 3, paginas: 3 });
  });

  it("acota la página fuera de rango", () => {
    expect(paginarLocal(items, 9, 10).pagina).toBe(3);
    expect(paginarLocal(items, 0, 10).pagina).toBe(1);
  });

  it("con lista vacía devuelve 1 página sin items", () => {
    expect(paginarLocal([], 1, 10)).toEqual({ items: [], pagina: 1, paginas: 1 });
  });
});

describe("textoMonto", () => {
  const monto = (texto: string, unidad: string) => ({ texto, unidad, separador_ambiguo: false });
  it("deja el texto si ya trae la moneda", () => {
    expect(textoMonto(monto("S/ 32,000", "S/"))).toBe("S/ 32,000");
    expect(textoMonto(monto("59.078 UIT", "UIT"))).toBe("59.078 UIT");
  });
  it("antepone la moneda cuando vino aparte (encabezado de tabla)", () => {
    expect(textoMonto(monto("32,000", "S/"))).toBe("S/ 32,000");
  });
  it("si no hay unidad, muestra el texto tal cual", () => {
    expect(textoMonto(monto("32,000", ""))).toBe("32,000");
  });
});

describe("reportes", () => {
  it("arma un nombre de archivo sin tildes ni símbolos", () => {
    expect(nombreArchivoReporte("Minera Andina S.A.A.", 2024)).toBe("reporte-prospeccion-minera-andina-s-a-a-2024.pdf");
    expect(nombreArchivoReporte("Energía Ñandú", 2025)).toBe("reporte-prospeccion-energia-nandu-2025.pdf");
    expect(nombreArchivoReporte("***", 2025)).toBe("reporte-prospeccion-empresa-2025.pdf");
  });
  it("acorta la huella SHA-256", () => {
    expect(huellaCorta("abcdef0123456789")).toBe("abcdef012345…");
    expect(huellaCorta("abc")).toBe("abc");
  });
});

describe("auditoría", () => {
  it("lista los tipos de evento del backend", () => {
    expect(TIPOS_EVENTO_AUDITORIA).toContain("Inicio de sesión");
    expect(TIPOS_EVENTO_AUDITORIA).toHaveLength(6);
  });
  it("convierte días locales a un rango UTC que incluye todo el día", () => {
    const desde = new Date(inicioDiaUtc("2026-10-01")!);
    const hasta = new Date(finDiaUtc("2026-10-01")!);
    expect([desde.getHours(), desde.getMinutes()]).toEqual([0, 0]);
    expect([hasta.getHours(), hasta.getMinutes(), hasta.getSeconds()]).toEqual([23, 59, 59]);
    expect(inicioDiaUtc("")).toBeUndefined();
    expect(finDiaUtc("")).toBeUndefined();
  });
  it("calcula el total de páginas (mínimo 1)", () => {
    expect(totalPaginas(0, 20)).toBe(1);
    expect(totalPaginas(41, 20)).toBe(3);
  });
  it("genera CSV con BOM, «;» y comillas escapadas", () => {
    expect(aCsv([["a", 'b "c"'], ["1", "2"]])).toBe('\uFEFF"a";"b ""c"""\n"1";"2"');
  });
});

describe("textoSinEvidencia", () => {
  it("explica cada motivo del backend", () => {
    expect(textoSinEvidencia("FUERA_DE_DOMINIO")).toContain("sostenibilidad");
    expect(textoSinEvidencia("SIN_FRAGMENTOS")).toContain("No hay documentos");
    expect(textoSinEvidencia("AFIRMACIONES_NO_VERIFICABLES")).toContain("citas literales");
  });
  it("usa un texto genérico si no hay motivo", () => {
    expect(textoSinEvidencia(null)).toContain("evidencia suficiente");
    expect(textoSinEvidencia(undefined)).toContain("evidencia suficiente");
  });
});

describe("textoDescartadas", () => {
  it("concuerda en singular y plural", () => {
    expect(textoDescartadas(1)).toBe("Se omitió 1 afirmación que no pudo respaldarse con los documentos.");
    expect(textoDescartadas(3)).toBe("Se omitieron 3 afirmaciones que no pudieron respaldarse con los documentos.");
  });
});

describe("aniosDisponibles", () => {
  it("va de 2020 al año en curso, del más reciente al más antiguo", () => {
    expect(ANIO_MIN_DATOS).toBe(2020);
    expect(aniosDisponibles(new Date("2026-10-20T12:00:00"))).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020]);
  });
  it("se actualiza solo con el paso del tiempo", () => {
    expect(aniosDisponibles(new Date("2027-03-01T12:00:00"))[0]).toBe(2027);
  });
  it("nunca devuelve una lista vacía", () => {
    expect(aniosDisponibles(new Date("2019-06-01T12:00:00"))).toEqual([2020]);
  });
});

describe("textoSinAnios", () => {
  it("sin empresa muestra un guion; mientras busca, «Buscando…»; si no hay, «Sin documentos»", () => {
    expect(textoSinAnios(false, false)).toBe("—");
    expect(textoSinAnios(true, true)).toBe("Buscando…");
    expect(textoSinAnios(true, false)).toBe("Sin documentos");
  });
});

describe("nombrePersona", () => {
  const nombres = new Map([["500f81e3-bebf-4f24-9ace-81f49d3eb6cf", "Oscar Baldeón"]]);
  it("traduce el ID del usuario a su nombre", () => {
    expect(nombrePersona("500f81e3-bebf-4f24-9ace-81f49d3eb6cf", nombres)).toBe("Oscar Baldeón");
  });
  it("no muestra un ID desconocido", () => {
    expect(nombrePersona("11111111-2222-3333-4444-555555555555", nombres)).toBe("Usuario no identificado");
  });
  it("si ya viene un nombre, lo deja tal cual", () => {
    expect(nombrePersona("Ana García", nombres)).toBe("Ana García");
  });
  it("sin valor muestra guion", () => {
    expect(nombrePersona(null, nombres)).toBe("—");
    expect(nombrePersona("", nombres)).toBe("—");
  });
});

describe("aniosConDocumentos", () => {
  const conDocs = (n: number): PromiseSettledResult<{ documentos: unknown[] }> => ({ status: "fulfilled", value: { documentos: Array(n).fill({}) } });
  it("deja solo los años con documentos, en el mismo orden", () => {
    expect(aniosConDocumentos([2025, 2024, 2023], [conDocs(0), conDocs(2), conDocs(1)])).toEqual([2024, 2023]);
  });
  it("descarta los años cuya consulta falló", () => {
    const fallo: PromiseSettledResult<{ documentos: unknown[] }> = { status: "rejected", reason: new Error("x") };
    expect(aniosConDocumentos([2025, 2024], [fallo, conDocs(1)])).toEqual([2024]);
  });
  it("sin documentos en ningún año devuelve lista vacía", () => {
    expect(aniosConDocumentos([2025, 2024], [conDocs(0), conDocs(0)])).toEqual([]);
  });
});

describe("reportes versionados", () => {
  const anio = (extra: Partial<AnioDisponible>): AnioDisponible => ({ anio: 2024, estado: "VALIDACION_VIGENTE", puede_generar: true, ...extra });

  it("ubica cada año en la tira de etapas según el estado del servidor", () => {
    expect(etapaReporte(anio({ estado: "PENDIENTE_REVISION" }))).toEqual({ cumplidas: 0, actual: 0, nuevaVersion: false });
    expect(etapaReporte(anio({ estado: "PENDIENTE_VALIDACION" }))).toEqual({ cumplidas: 1, actual: 1, nuevaVersion: false });
    expect(etapaReporte(anio({}))).toEqual({ cumplidas: 2, actual: 2, nuevaVersion: false });
    expect(etapaReporte(anio({ estado: "ACTUALIZACION_PENDIENTE" }))).toEqual({ cumplidas: 2, actual: 2, nuevaVersion: true });
    expect(etapaReporte(anio({ estado: "REPORTE_GENERADO" }))).toEqual({ cumplidas: 4, actual: null, nuevaVersion: false });
    expect(etapaReporte(anio({ estado: "SIN_CODIGOS_GRI" }))).toBeNull();
    expect(etapaReporte(anio({ estado: "SIN_DOCUMENTACION_ELEGIBLE" }))).toBeNull();
    expect(etapaReporte(undefined)).toBeNull();
  });

  it("etiqueta cada año según su estado", () => {
    expect(etiquetaAnioReporte(anio({ estado: "PENDIENTE_REVISION" }))).toBe("2024 · Pendiente de revisión");
    expect(etiquetaAnioReporte(anio({ estado: "PENDIENTE_VALIDACION" }))).toBe("2024 · Sin validar");
    expect(etiquetaAnioReporte(anio({}))).toBe("2024 · Validado");
    expect(etiquetaAnioReporte(anio({ estado: "ACTUALIZACION_PENDIENTE" }))).toBe("2024 · Validación nueva sin reporte");
    expect(etiquetaAnioReporte(anio({ estado: "REPORTE_GENERADO" }))).toBe("2024 · Reporte actualizado");
    expect(etiquetaAnioReporte(anio({ estado: "SIN_CODIGOS_GRI" }))).toBe("2024 · Sin códigos GRI");
    expect(etiquetaAnioReporte(anio({ estado: "SIN_DOCUMENTACION_ELEGIBLE" }))).toBe("2024 · Sin documentos");
  });

  it("un estado que aún no se conoce no rompe la pantalla", () => {
    const desconocido = anio({ estado: "OTRO" as EstadoAnioReporte });
    expect(etiquetaAnioReporte(desconocido)).toBe("2024");
    expect(situacionAnioReporte(desconocido)).toEqual({ mensaje: "No se pudo determinar la situación de este año.", tono: "neutro", irAAnalisis: false });
  });

  it("lleva a Análisis GRI solo si falta revisar o validar, y explica si la validación venció", () => {
    expect(situacionAnioReporte(anio({ estado: "PENDIENTE_REVISION" })).irAAnalisis).toBe(true);
    expect(situacionAnioReporte(anio({ estado: "PENDIENTE_VALIDACION" })).mensaje).toBe("Valida el análisis GRI antes de emitir el reporte.");
    expect(situacionAnioReporte(anio({ estado: "PENDIENTE_VALIDACION", validacion_anterior_no_vigente: true })).mensaje).toContain("cambió después de la última validación");
    expect(situacionAnioReporte(anio({})).irAAnalisis).toBe(false);
  });

  it("sin reporte ofrece generar; con reporte, generar una nueva versión", () => {
    expect(accionesReporte(anio({}))).toMatchObject({ generar: true, etiquetaGenerar: "Generar reporte", descargarActualizado: false, descargarHistorica: false, verHistorial: false });
    expect(accionesReporte(anio({ estado: "ACTUALIZACION_PENDIENTE", reporte_id: "r1", reporte_actualizado: false }))).toMatchObject({
      generar: true,
      etiquetaGenerar: "Generar nueva versión",
      descargarActualizado: false,
      descargarHistorica: true,
    });
  });

  it("solo presenta como actualizado lo que el servidor confirma", () => {
    expect(accionesReporte(anio({ estado: "REPORTE_GENERADO", puede_generar: false, reporte_id: "r1", reporte_actualizado: true }))).toMatchObject({
      generar: false,
      descargarActualizado: true,
      descargarHistorica: false,
    });
    // Que no haya una actualización pendiente no significa que esté actualizado.
    expect(accionesReporte(anio({ estado: "PENDIENTE_VALIDACION", puede_generar: false, reporte_id: "r1", reporte_actualizado: null, actualizacion_pendiente: false }))).toMatchObject({
      vistaPrevia: false,
      descargarActualizado: false,
      descargarHistorica: true,
    });
    expect(accionesReporte()).toMatchObject({ vistaPrevia: false, generar: false, descargarActualizado: false, descargarHistorica: false });
  });

  it("describe la última emisión sin confundir última con actualizada", () => {
    expect(situacionEmision(anio({ reporte_actualizado: true, origen_verificable: true }))).toBe("Actualizado");
    expect(situacionEmision(anio({ reporte_actualizado: false, origen_verificable: true }))).toBe("No actualizado");
    expect(situacionEmision(anio({ reporte_actualizado: false, origen_verificable: false }))).toBe("Origen no verificable");
  });

  it("distingue una emisión nueva de una reutilizada", () => {
    const base = { version: 2, empresa_nombre: "Minera", anio: 2024 };
    expect(mensajeEmision({ ...base, reutilizado: false })).toBe("Versión 2 de Minera (2024) emitida correctamente.");
    expect(mensajeEmision({ ...base, reutilizado: true })).toBe("Esta validación ya tenía un reporte: versión 2 de Minera (2024).");
  });

  it("el nombre del archivo lleva la versión", () => {
    expect(nombreArchivoReporte("Minera Andina", 2024, 2)).toBe("reporte-prospeccion-minera-andina-2024-v2.pdf");
  });
});

describe("textoLegible", () => {
  it("quita enlaces, imágenes y filas separadoras de tablas", () => {
    expect(textoLegible("Ver [el informe](https://ejemplo.pe/informe.pdf) y ![gráfico](g.png)")).toBe("Ver el informe y gráfico");
    expect(textoLegible("Antes |---|:---:| después")).toBe("Antes después");
    expect(textoLegible("Antes | --- | --- | después")).toBe("Antes después");
    expect(textoLegible("---|---| fin")).toBe("fin");
  });

  it("no se traba con texto que parece un enlace o una tabla sin cerrar", () => {
    const largo = 50_000;
    expect(textoLegible("[".repeat(largo))).toHaveLength(largo);
    expect(textoLegible("[a](".repeat(largo / 4))).toHaveLength(largo);
    expect(textoLegible("|   ".repeat(largo / 4))).toContain("|");
  });

  it("quita las marcas de los fragmentos reales reportados", () => {
    expect(textoLegible("Reporte de sostenibilidad 2025 — Tejido Verde de Prueba > **Gestión** ambiental<br>2025 > Cumplimiento"))
      .toBe("Reporte de sostenibilidad 2025 — Tejido Verde de Prueba > Gestión ambiental 2025 > Cumplimiento");
    expect(textoLegible("### Cumplimiento La empresa recibió una multa de S/ 5000 por parte del OEFA"))
      .toBe("Cumplimiento La empresa recibió una multa de S/ 5000 por parte del OEFA");
    expect(textoLegible("# Reporte de sostenibilidad 2025 — Tejido Verde de Prueba ## **Gestión** ambiental<br>2025 La compañía"))
      .toBe("Reporte de sostenibilidad 2025 — Tejido Verde de Prueba Gestión ambiental 2025 La compañía");
    expect(textoLegible("se generaron 86 toneladas de residuos.<br />De ellas, 61 toneladas. Consulte el [anexo metodológico](#anexo-2)"))
      .toBe("se generaron 86 toneladas de residuos. De ellas, 61 toneladas. Consulte el anexo metodológico");
  });
  it("quita etiquetas HTML conservando su texto y decodifica entidades", () => {
    expect(textoLegible("Multa <mark>confirmada</mark> por <u>OEFA</u><!-- nota -->")).toBe("Multa confirmada por OEFA");
    expect(textoLegible("Agua &amp; efluentes &lt;GRI 303&gt; &#8212; &#x41;&nbsp;fin")).toBe("Agua & efluentes <GRI 303> — A fin");
    expect(textoLegible("Unidades &desconocida; se conservan")).toBe("Unidades &desconocida; se conservan");
  });
  it("quita negritas, cursivas, tachados, código y separadores", () => {
    expect(textoLegible("Texto *cursiva* y _otra_, ~~tachado~~ y `código` --_-- fin --- final"))
      .toBe("Texto cursiva y otra, tachado y código fin final");
    expect(textoLegible("- primer punto\n* segundo\n> cita")).toBe("primer punto segundo cita");
  });
  it("no toca lo que no es marca: comparaciones, guiones bajos de nombres ni números", () => {
    expect(textoLegible("emisiones < 5000 t y x > 3")).toBe("emisiones < 5000 t y x > 3");
    expect(textoLegible("Ver 05_reporte_2025_marcas.md · 4. Agua (GRI 303)")).toBe("Ver 05_reporte_2025_marcas.md · 4. Agua (GRI 303)");
    expect(textoLegible("Impuesto 2*3*4 y a_b")).toBe("Impuesto 2*3*4 y a_b");
  });
  it("sin texto devuelve vacío", () => {
    expect(textoLegible(undefined)).toBe("");
    expect(textoLegible(null)).toBe("");
    expect(textoLegible("  ")).toBe("");
  });
});

describe("tablaMarkdown", () => {
  const encabezados = ["Indicador", "Código GRI", "2024", "Unidad"];
  it("reconoce la tabla aunque venga en una sola línea, como la reportada", () => {
    const t = tablaMarkdown("| Indicador | Código GRI | 2024 | Unidad | |-----------|-----------|------|--------| | Emisiones directas (Alcance 1) | GRI 305-1 | 11,980 | tCO2e | | Emisiones indirectas (Alcance 2) | GRI 305-2 | 7,650 | tCO2e |");
    expect(t).toEqual({
      antes: "",
      encabezados,
      filas: [
        ["Emisiones directas (Alcance 1)", "GRI 305-1", "11,980", "tCO2e"],
        ["Emisiones indirectas (Alcance 2)", "GRI 305-2", "7,650", "tCO2e"],
      ],
    });
  });
  it("también con saltos de línea, texto previo, celdas vacías y marcas en las celdas", () => {
    const t = tablaMarkdown("Tabla 3:\n| Indicador | Código GRI | 2024 | Unidad |\n|:---|:---:|---:|---|\n| **Agua** extraída | GRI 303-3 |  | m3 |");
    expect(t).toEqual({ antes: "Tabla 3:", encabezados, filas: [["Agua extraída", "GRI 303-3", "", "m3"]] });
  });
  it("si no es una tabla bien formada, devuelve null (se muestra como texto)", () => {
    expect(tablaMarkdown("Durante 2024 se registró una sanción ambiental de OEFA.")).toBeNull();
    expect(tablaMarkdown("| a | b | |---|---| | 1 | 2 | 3 |")).toBeNull();
    expect(tablaMarkdown("| a | b | c | |---|---| | 1 | 2 | 3 |")).toBeNull();
    expect(tablaMarkdown("| a | b | |---|---| | 1 | 2 | y sigue texto")).toBeNull();
    expect(tablaMarkdown("| a | b | |---|---|")).toBeNull();
    expect(tablaMarkdown("sin tubería |---|---|")).toBeNull();
    expect(tablaMarkdown(null)).toBeNull();
  });
  it("si no se puede leer como tabla, el texto queda sin las filas separadoras", () => {
    expect(textoLegible("| a | b | |---|---| | 1 | 2 | 3 |")).toBe("| a | b | | 1 | 2 | 3 |");
  });
});

describe("filtrarDocumentos", () => {
  const docs = [
    { id: "1", sector: "ENERGIA", empresa_nombre: "Energía Andina S.A." },
    { id: "2", sector: "MINERIA", empresa_nombre: "Minera Andina S.A.A." },
    { id: "3", sector: "PETROLEO", empresa_nombre: "Petro Sur S.A." },
  ];
  const ids = (f: { sector?: string; busqueda?: string }) => filtrarDocumentos(docs, f).map((d) => d.id);
  it("busca por una parte del nombre, sin distinguir mayúsculas ni tildes", () => {
    expect(ids({ busqueda: "andina" })).toEqual(["1", "2"]);
    expect(ids({ busqueda: "ENERGIA" })).toEqual(["1"]);
    expect(ids({ busqueda: "  petro  " })).toEqual(["3"]);
    expect(ids({ busqueda: "xyz" })).toEqual([]);
  });
  it("combina la búsqueda con el sector", () => {
    expect(ids({ sector: "MINERIA", busqueda: "andina" })).toEqual(["2"]);
    expect(ids({ sector: "MINERIA" })).toEqual(["2"]);
  });
  it("sin criterios devuelve todos", () => {
    expect(ids({})).toEqual(["1", "2", "3"]);
    expect(ids({ busqueda: "   " })).toEqual(["1", "2", "3"]);
  });
});

describe("bloquesPaginacion", () => {
  it("con 7 páginas o menos las muestra todas, sin campo de salto", () => {
    expect(bloquesPaginacion(1, 5)).toEqual({ inicio: [1, 2, 3, 4, 5], fin: [] });
    expect(bloquesPaginacion(4, 7)).toEqual({ inicio: [1, 2, 3, 4, 5, 6, 7], fin: [] });
  });
  it("al inicio: 3 primeras y 3 últimas", () => {
    expect(bloquesPaginacion(1, 16)).toEqual({ inicio: [1, 2, 3], fin: [14, 15, 16] });
    expect(bloquesPaginacion(2, 16)).toEqual({ inicio: [1, 2, 3], fin: [14, 15, 16] });
  });
  it("en medio, el primer grupo sigue a la página actual", () => {
    expect(bloquesPaginacion(7, 16)).toEqual({ inicio: [6, 7, 8], fin: [14, 15, 16] });
  });
  it("cerca del final no repite páginas del último grupo", () => {
    expect(bloquesPaginacion(13, 16)).toEqual({ inicio: [11, 12, 13], fin: [14, 15, 16] });
    expect(bloquesPaginacion(5, 8)).toEqual({ inicio: [3, 4, 5], fin: [6, 7, 8] });
  });
  it("en las últimas páginas, el primer grupo vuelve a las 3 primeras", () => {
    expect(bloquesPaginacion(15, 16)).toEqual({ inicio: [1, 2, 3], fin: [14, 15, 16] });
  });
});

describe("rangoPaginas", () => {
  it("con pocas páginas las muestra todas", () => {
    expect(rangoPaginas(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(rangoPaginas(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("en medio muestra primera, vecinas, última y saltos", () => {
    expect(rangoPaginas(6, 13)).toEqual([1, "…", 5, 6, 7, "…", 13]);
  });
  it("cerca del inicio o del final no pone saltos innecesarios", () => {
    expect(rangoPaginas(2, 13)).toEqual([1, 2, 3, "…", 13]);
    expect(rangoPaginas(12, 13)).toEqual([1, "…", 11, 12, 13]);
    expect(rangoPaginas(11, 13)).toEqual([1, "…", 10, 11, 12, 13]);
  });
});

describe("paginaValida", () => {
  it("acota al rango y rechaza lo que no es número", () => {
    expect(paginaValida("11", 13)).toBe(11);
    expect(paginaValida("99", 13)).toBe(13);
    expect(paginaValida("0", 13)).toBe(1);
    expect(paginaValida("", 13)).toBeNull();
    expect(paginaValida("abc", 13)).toBeNull();
  });
});
