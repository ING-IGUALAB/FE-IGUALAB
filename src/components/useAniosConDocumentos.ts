import { useEffect, useState } from "react";
import { consultarAnalisis } from "../api/analisis";
import { aniosConDocumentos, aniosDisponibles } from "../lib/dominio";

/**
 * Años en los que una empresa tiene documentos analizados (los únicos que tiene sentido consultar).
 * El Administrador no puede listar documentos, así que se consulta el análisis de cada año posible.
 */
export function useAniosConDocumentos(empresaId: string) {
  const [anios, setAnios] = useState<number[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!empresaId) {
      setAnios([]);
      return;
    }
    let vigente = true;
    const candidatos = aniosDisponibles();
    setCargando(true);
    Promise.allSettled(candidatos.map((a) => consultarAnalisis(empresaId, a, { silencioso: true })))
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

  return { anios, cargando };
}
