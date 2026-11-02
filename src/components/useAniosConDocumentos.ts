import { useEffect, useMemo, useState } from "react";
import { consultarAnalisis } from "../api/analisis";
import { aniosConDocumentos, aniosDisponibles, estadosPorAnio, type EstadoAnio } from "../lib/dominio";

interface DatosEmpresa {
  empresaId: string;
  anios: number[];
  estados: Record<number, EstadoAnio>;
}

const SIN_DATOS: DatosEmpresa = { empresaId: "", anios: [], estados: {} };

/**
 * Años en los que una empresa tiene documentos analizados (los únicos que tiene sentido consultar),
 * el estado del análisis de cada uno y el año elegido entre ellos. El Administrador no puede listar
 * documentos, así que se consulta el análisis de cada año posible. Cuando llegan los datos de la
 * empresa se elige `anioPreferido` si está en la lista o, si no, su año más reciente (o ninguno).
 * `aniosExtra` agrega años que deben ofrecerse igual (p. ej. los que ya tienen reporte generado).
 */
export function useAniosConDocumentos(empresaId: string, anioPreferido?: number, aniosExtra: number[] = []) {
  const [datos, setDatos] = useState<DatosEmpresa>(SIN_DATOS);
  const [anio, setAnio] = useState<number | null>(null);

  useEffect(() => {
    if (!empresaId) return;
    let vigente = true;
    const candidatos = aniosDisponibles();
    Promise.allSettled(candidatos.map((a) => consultarAnalisis(empresaId, a))).then((resultados) => {
      if (!vigente) return;
      setDatos({
        empresaId,
        anios: aniosConDocumentos(candidatos, resultados),
        estados: estadosPorAnio(candidatos, resultados),
      });
    });
    return () => {
      vigente = false;
    };
  }, [empresaId]);

  // Solo se usan los datos que corresponden a la empresa elegida (no los de la anterior).
  const listos = !!empresaId && datos.empresaId === empresaId;
  const claveExtra = aniosExtra.join(",");
  const anios = useMemo(() => {
    if (!listos) return [];
    const extra = claveExtra ? claveExtra.split(",").map(Number) : [];
    return [...new Set([...datos.anios, ...extra])].sort((a, b) => b - a);
  }, [listos, datos.anios, claveExtra]);

  useEffect(() => {
    setAnio((actual) => {
      if (actual !== null && anios.includes(actual)) return actual;
      if (anioPreferido !== undefined && anios.includes(anioPreferido)) return anioPreferido;
      return anios[0] ?? null;
    });
  }, [anios, anioPreferido]);

  const hayEmpresa = !!empresaId;
  const cargando = hayEmpresa && !listos;
  return {
    anios,
    estados: listos ? datos.estados : {},
    cargando,
    anio: anios.length ? anio : null,
    setAnio,
    hayEmpresa,
    sinDocumentos: listos && anios.length === 0,
  };
}

export type AniosConDocumentos = ReturnType<typeof useAniosConDocumentos>;
