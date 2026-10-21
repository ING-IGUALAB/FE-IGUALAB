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
  paginarLocal,
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
  it("va de 2023 al último año cerrado, del más reciente al más antiguo", () => {
    expect(ANIO_MIN_DATOS).toBe(2023);
    expect(aniosDisponibles(new Date("2026-10-20T12:00:00"))).toEqual([2025, 2024, 2023]);
  });
  it("se actualiza solo con el paso del tiempo", () => {
    expect(aniosDisponibles(new Date("2028-03-01T12:00:00"))).toEqual([2027, 2026, 2025, 2024, 2023]);
  });
  it("nunca devuelve una lista vacía", () => {
    expect(aniosDisponibles(new Date("2023-06-01T12:00:00"))).toEqual([2023]);
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
