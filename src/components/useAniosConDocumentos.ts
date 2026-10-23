import { useEffect, useState } from "react";
import { consultarAnalisis } from "../api/analisis";
import { aniosConDocumentos, aniosDisponibles } from "../lib/dominio";

/**
 * Años en los que una empresa tiene documentos analizados (los únicos que tiene sentido consultar)
 * y el año elegido entre ellos. El Administrador no puede listar documentos, así que se consulta el
 * análisis de cada año posible. Al cambiar de empresa se elige su año más reciente (o ninguno).
 */
export function useAniosConDocumentos(empresaId: string) {
  const [anios, setAnios] = useState<number[]>([]);
  const [cargando, setCargando] = useState(false);
  const [anio, setAnio] = useState<number | null>(null);

  useEffect(() => {
    if (!empresaId) {
      setAnios([]);
      return;
    }
    let vigente = true;
    const candidatos = aniosDisponibles();
    setCargando(true);
    Promise.allSettled(candidatos.map((a) => consultarAnalisis(empresaId, a)))
      .then((resultados) => {
        if (vigente) setAnios(aniosConDocumentos(candidatos, resultados));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [empresaId]);

  useEffect(() => {
    setAnio((actual) => (actual !== null && anios.includes(actual) ? actual : anios[0] ?? null));
  }, [anios]);

  const hayEmpresa = !!empresaId;
  return { anios, cargando, anio, setAnio, hayEmpresa, sinDocumentos: hayEmpresa && !cargando && anios.length === 0 };
}

export type AniosConDocumentos = ReturnType<typeof useAniosConDocumentos>;
