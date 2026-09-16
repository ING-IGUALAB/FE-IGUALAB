import type {
  Analisis,
  Documento,
  Empresa,
  EstadoGri,
  EventoAuditoria,
  Reporte,
  Sector,
} from "../types";

export const SECTORES: Sector[] = ["Minería", "Petróleo y Gas", "Energía"];
export const ESTADOS_GRI: EstadoGri[] = ["OK", "Baja sustancia", "Sub-reportado"];
export const ESG_PUNTAJE: Record<EstadoGri, number> = {
  OK: 100,
  "Baja sustancia": 50,
  "Sub-reportado": 0,
};

export const EMPRESAS_SEED: Empresa[] = [
  { id: "andina", nombre: "Minera Andina S.A.A.", sector: "Minería", activa: true },
  { id: "altiplano", nombre: "Minera Altiplano S.A.", sector: "Minería", activa: true },
  { id: "amazonica", nombre: "Petrolera Amazónica S.A.", sector: "Petróleo y Gas", activa: true },
  { id: "energialima", nombre: "Energía Lima S.A.C.", sector: "Energía", activa: true },
  { id: "gassur", nombre: "Gas del Sur S.A.A.", sector: "Petróleo y Gas", activa: true },
];

export const ANALISIS_SEED: Record<string, Analisis> = {
  "andina|2024": {
    evidencia: { gri: true, sanciones: true },
    gri: [
      { codigo: "GRI 401", tema: "Empleo", estado: "Sub-reportado", cita: "«Durante 2024 se realizaron 312 nuevas contrataciones» — no se reporta rotación ni desglose por género.", doc: "Memoria Anual 2024 - Minera Andina S.A.A.", pagina: "p. 74" },
      { codigo: "GRI 413", tema: "Comunidades locales", estado: "Baja sustancia", cita: "«Se sostuvieron mesas de diálogo con comunidades del área de influencia» — sin indicadores de impacto.", doc: "Memoria Anual 2024 - Minera Andina S.A.A.", pagina: "p. 88" },
      { codigo: "GRI 306", tema: "Residuos", estado: "OK", cita: "«Se gestionaron 12,400 t de residuos con meta de reducción del 8% y trazabilidad por relave».", doc: "Memoria Anual 2024 - Minera Andina S.A.A.", pagina: "p. 102" },
      { codigo: "GRI 305", tema: "Emisiones", estado: "Baja sustancia", cita: "«Las emisiones directas Scope 1 fueron 845,200 tCO₂e» — Scope 3 no reportado.", doc: "Memoria Anual 2024 - Minera Andina S.A.A.", pagina: "p. 96" },
      { codigo: "GRI 303", tema: "Agua y efluentes", estado: "OK", cita: "«Recirculación del 71% del agua industrial con reporte de vertimientos autorizados».", doc: "Memoria Anual 2024 - Minera Andina S.A.A.", pagina: "p. 99" },
    ],
    sanciones: [
      { entidad: "Ministerio de Trabajo (SUNAFIL)", motivo: "Observaciones en consulta previa a comunidades", monto: 4200000, cita: "«Pasivo contingente por procedimiento sancionador N.° 214-2024».", doc: "Memoria Anual 2024 - Minera Andina S.A.A.", pagina: "p. 142" },
      { entidad: "OEFA", motivo: "Incumplimiento de instrumentos de gestión ambiental", monto: null, cita: "«La empresa afronta un procedimiento de OEFA cuyo monto se encuentra en determinación».", doc: "Memoria Anual 2024 - Minera Andina S.A.A.", pagina: "p. 143" },
    ],
  },
  "andina|2023": {
    evidencia: { gri: true, sanciones: true },
    gri: [
      { codigo: "GRI 401", tema: "Empleo", estado: "Sub-reportado", cita: "«Se incorporaron 280 colaboradores» — sin datos de rotación.", doc: "Memoria Anual 2023 - Minera Andina S.A.A.", pagina: "p. 68" },
      { codigo: "GRI 413", tema: "Comunidades locales", estado: "Sub-reportado", cita: "Mención genérica sin evidencia de programas comunitarios.", doc: "Memoria Anual 2023 - Minera Andina S.A.A.", pagina: "p. 80" },
      { codigo: "GRI 306", tema: "Residuos", estado: "Baja sustancia", cita: "«Se dispuso de residuos conforme a normativa» — sin metas.", doc: "Memoria Anual 2023 - Minera Andina S.A.A.", pagina: "p. 91" },
    ],
    sanciones: [
      { entidad: "OEFA", motivo: "Incumplimiento de instrumentos de gestión ambiental", monto: 1850000, cita: "«Resolución N.° 087-2023-OEFA/CD».", doc: "Memoria Anual 2023 - Minera Andina S.A.A.", pagina: "p. 138" },
    ],
  },
  "amazonica|2024": {
    evidencia: { gri: true, sanciones: true },
    gri: [
      { codigo: "GRI 305", tema: "Emisiones", estado: "Sub-reportado", cita: "«Se reportan emisiones de operaciones propias» — sin cadena de suministro (Scope 3).", doc: "Reporte de Sostenibilidad GRI 2024 - Petrolera Amazónica S.A.", pagina: "p. 41" },
      { codigo: "GRI 306", tema: "Residuos", estado: "Baja sustancia", cita: "«Gestión de lodos de perforación conforme a normativa» — sin volúmenes.", doc: "Reporte de Sostenibilidad GRI 2024 - Petrolera Amazónica S.A.", pagina: "p. 44" },
      { codigo: "GRI 304", tema: "Biodiversidad", estado: "OK", cita: "«Plan de manejo con línea base de biodiversidad y monitoreo trimestral en 3 lotes».", doc: "Reporte de Sostenibilidad GRI 2024 - Petrolera Amazónica S.A.", pagina: "p. 47" },
      { codigo: "GRI 413", tema: "Comunidades locales", estado: "Baja sustancia", cita: "«Acuerdos con comunidades nativas» — sin seguimiento de compromisos.", doc: "Reporte de Sostenibilidad GRI 2024 - Petrolera Amazónica S.A.", pagina: "p. 52" },
    ],
    sanciones: [
      { entidad: "OEFA", motivo: "Derrame no reportado oportunamente", monto: 3100000, cita: "«Multa firme por Res. N.° 145-2024-OEFA».", doc: "Reporte de Sostenibilidad GRI 2024 - Petrolera Amazónica S.A.", pagina: "p. 58" },
    ],
  },
  "energialima|2024": {
    evidencia: { gri: true, sanciones: true },
    gri: [
      { codigo: "GRI 302", tema: "Energía", estado: "OK", cita: "«35% de la generación provino de fuentes renovables, con meta a 50% al 2027».", doc: "Memoria Anual 2024 - Energía Lima S.A.C.", pagina: "p. 62" },
      { codigo: "GRI 305", tema: "Emisiones", estado: "Sub-reportado", cita: "«Emisiones Scope 1 y 2 reportadas» — Scope 3 de la cadena de suministro omitido.", doc: "Memoria Anual 2024 - Energía Lima S.A.C.", pagina: "p. 87" },
      { codigo: "GRI 308", tema: "Evaluación ambiental de proveedores", estado: "OK", cita: "«El 100% de proveedores críticos fue evaluado ambientalmente en 2024».", doc: "Memoria Anual 2024 - Energía Lima S.A.C.", pagina: "p. 90" },
    ],
    sanciones: [
      { entidad: "Osinergmin", motivo: "Reporte de emisiones incompleto", monto: 640000, cita: "«Resolución de sanción por reporte parcial de emisiones».", doc: "Memoria Anual 2024 - Energía Lima S.A.C.", pagina: "p. 120" },
    ],
  },
  "altiplano|2024": {
    evidencia: { gri: true, sanciones: false },
    gri: [
      { codigo: "GRI 403", tema: "Seguridad y salud en el trabajo", estado: "OK", cita: "«Índice de frecuencia de accidentes 1.2, con cobertura de contratistas».", doc: "Reporte de Sostenibilidad GRI 2024 - Minera Altiplano S.A.", pagina: "p. 33" },
      { codigo: "GRI 303", tema: "Agua y efluentes", estado: "Baja sustancia", cita: "«Uso responsable del agua» — sin volúmenes ni recirculación.", doc: "Reporte de Sostenibilidad GRI 2024 - Minera Altiplano S.A.", pagina: "p. 39" },
    ],
    sanciones: [],
  },
};

export const DOCUMENTOS_SEED: Documento[] = [
  { id: "d1", empresaId: "andina", empresa: "Minera Andina S.A.A.", sector: "Minería", anio: 2024, tipo: "Memoria Anual", estado: "Éxito", fecha: "2026-08-20 10:14", cuenta: "Oscar Baldeón", hash: "sha256:9f2c…a41b", tamano: "4.2 MB" },
  { id: "d2", empresaId: "andina", empresa: "Minera Andina S.A.A.", sector: "Minería", anio: 2023, tipo: "Memoria Anual", estado: "Éxito", fecha: "2026-08-18 09:30", cuenta: "Oscar Baldeón", hash: "sha256:1a77…c093", tamano: "3.8 MB" },
  { id: "d3", empresaId: "amazonica", empresa: "Petrolera Amazónica S.A.", sector: "Petróleo y Gas", anio: 2024, tipo: "Reporte de Sostenibilidad GRI", estado: "Éxito", fecha: "2026-08-19 16:40", cuenta: "Oscar Baldeón", hash: "sha256:b3d1…7f22", tamano: "6.1 MB" },
  { id: "d4", empresaId: "energialima", empresa: "Energía Lima S.A.C.", sector: "Energía", anio: 2024, tipo: "Memoria Anual", estado: "Éxito", fecha: "2026-08-18 09:02", cuenta: "Oscar Baldeón", hash: "sha256:77ce…10ab", tamano: "3.9 MB" },
  { id: "d5", empresaId: "altiplano", empresa: "Minera Altiplano S.A.", sector: "Minería", anio: 2024, tipo: "Reporte de Sostenibilidad GRI", estado: "Éxito", fecha: "2026-08-15 11:31", cuenta: "Oscar Baldeón", hash: "sha256:5e90…dd12", tamano: "2.7 MB" },
];

export const REPORTES_SEED: Reporte[] = [
  { id: "r1", empresaId: "andina", empresa: "Minera Andina S.A.A.", sector: "Minería", anio: 2024, generadoPor: "María López", fecha: "2026-08-21 12:03" },
];

export const AUDIT_SEED: EventoAuditoria[] = [
  { id: 1, fecha: "2026-08-25 09:31", usuario: "Oscar Baldeón", tipo: "Ingesta de documento", accion: "Ingestó 'Memoria Anual 2024 - Minera Andina S.A.A.' (Minería · 2024)" },
  { id: 2, fecha: "2026-08-25 09:48", usuario: "Oscar Baldeón", tipo: "Rechazo de documento", accion: "Rechazó carga duplicada (misma empresa, tipo y año) — RN-033" },
  { id: 3, fecha: "2026-08-25 11:20", usuario: "María López", tipo: "Cambio de estado GRI", accion: "Asignó estado 'Baja sustancia' a GRI 305 · Minera Andina 2024" },
  { id: 4, fecha: "2026-08-25 11:44", usuario: "María López", tipo: "Generación de reporte", accion: "Generó reporte de prospección · Minera Andina S.A.A. (2024)" },
];

// ---- Utilidades de dominio ----
export function analisisKey(empresaId: string, anio: number) {
  return `${empresaId}|${anio}`;
}

export function esgScore(gri: { estado: EstadoGri }[]): number | null {
  if (!gri.length) return null;
  const suma = gri.reduce((a, g) => a + (ESG_PUNTAJE[g.estado] ?? 0), 0);
  return Math.round(suma / gri.length);
}

export function riesgoDesdeEsg(esg: number | null): string {
  if (esg == null) return "Sin datos";
  if (esg >= 70) return "Bajo";
  if (esg >= 45) return "Medio";
  return "Alto";
}

export function conteoEstados(gri: { estado: EstadoGri }[]) {
  const c: Record<EstadoGri, number> = { OK: 0, "Baja sustancia": 0, "Sub-reportado": 0 };
  gri.forEach((g) => (c[g.estado] += 1));
  return c;
}

export function resumenSanciones(sanciones: { monto: number | null }[]) {
  const cuantificadas = sanciones.filter((s) => s.monto != null) as { monto: number }[];
  const total = cuantificadas.reduce((a, s) => a + s.monto, 0);
  return { total, sinMonto: sanciones.length - cuantificadas.length, cantidad: sanciones.length };
}
