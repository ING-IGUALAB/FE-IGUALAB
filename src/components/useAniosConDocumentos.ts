import { useEffect, useState } from "react";
import { consultarAnalisis } from "../api/analisis";
import { aniosConDocumentos, aniosDisponibles } from "../lib/dominio";

interface DatosEmpresa {
  empresaId: string;
  anios: number[];
}

const SIN_DATOS: DatosEmpresa = { empresaId: "", anios: [] };
const SIN_ANIOS: number[] = [];

/**
 * Años en los que una empresa tiene documentos analizados (los únicos que tiene sentido consultar) y
 * el año elegido entre ellos. El Administrador no puede listar documentos, así que se consulta el
 * análisis de cada año posible. Cuando llegan los datos de la empresa se elige `anioPreferido` si
 * está en la lista o, si no, su año más reciente (o ninguno).
 */
export function useAniosConDocumentos(empresaId: string, anioPreferido?: number) {
  const [datos, setDatos] = useState<DatosEmpresa>(SIN_DATOS);
  const [anio, setAnio] = useState<number | null>(null);

  useEffect(() => {
    if (!empresaId) return;
    let vigente = true;
    const candidatos = aniosDisponibles();
    Promise.allSettled(candidatos.map((a) => consultarAnalisis(empresaId, a))).then((resultados) => {
      if (!vigente) return;
      setDatos({ empresaId, anios: aniosConDocumentos(candidatos, resultados) });
    });
    return () => {
      vigente = false;
    };
  }, [empresaId]);

  // Solo se usan los datos que corresponden a la empresa elegida (no los de la anterior).
  const listos = !!empresaId && datos.empresaId === empresaId;
  const anios = listos ? datos.anios : SIN_ANIOS;

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
    cargando,
    anio: anios.length ? anio : null,
    setAnio,
    hayEmpresa,
    sinDocumentos: listos && anios.length === 0,
  };
}

export type AniosConDocumentos = ReturnType<typeof useAniosConDocumentos>;
