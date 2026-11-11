import { useCallback, useEffect, useRef, useState } from "react";
import * as documentosApi from "../api/documentos";
import { ApiError } from "../api/client";
import { necesitaDecision } from "../lib/dominio";
import type { Operacion } from "../types";

export const INTERVALO_PROGRESO_MS = 1500;

/** Una consulta del avance: la operación, o null si falló (y si conviene dejar de preguntar). */
async function consultarSinFallar(operacionId: string): Promise<{ op: Operacion | null; cortar: boolean }> {
  try {
    return { op: await documentosApi.consultarOperacion(operacionId), cortar: false };
  } catch (err) {
    // Sin permiso o sin la operación no tiene sentido seguir preguntando.
    return { op: null, cortar: err instanceof ApiError && [401, 403, 404].includes(err.status) };
  }
}

/**
 * Sigue el avance de una operación de carga consultando al servidor cada 1,5 s, también MIENTRAS la
 * petición de carga sigue en curso (el backend la procesa de una vez y solo responde al terminar o
 * al pausarse). Se detiene al terminar, al quedar en pausa esperando una decisión o con `detener()`.
 * Un fallo puntual de la consulta no corta el seguimiento: se marca y se vuelve a intentar.
 */
export function useProgresoIngesta() {
  const [operacion, setOperacion] = useState<Operacion | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  // Cada seguimiento tiene su número: al detener o empezar otro, el anterior deja de actualizar.
  const corrida = useRef(0);

  useEffect(
    () => () => {
      corrida.current += 1;
    },
    [],
  );

  const detener = useCallback(() => {
    corrida.current += 1;
    setSinConexion(false);
  }, []);

  /**
   * Devuelve la última operación vista (o null si se detuvo antes de ver alguna). `maxConsultas`
   * acota la espera cuando ya no hay una petición en curso que la termine.
   */
  const seguir = useCallback(async (operacionId: string, inicial: Operacion | null = null, maxConsultas = Infinity): Promise<Operacion | null> => {
    corrida.current += 1;
    const mia = corrida.current;
    const vigente = () => corrida.current === mia;
    let actual = inicial;
    if (actual) setOperacion(actual);
    setSinConexion(false);
    let consultas = 0;
    const continuar = () => vigente() && !actual?.terminal && !necesitaDecision(actual) && consultas < maxConsultas;

    while (continuar()) {
      consultas += 1;
      await new Promise((r) => setTimeout(r, INTERVALO_PROGRESO_MS));
      if (!vigente()) break;
      const { op, cortar } = await consultarSinFallar(operacionId);
      if (!vigente()) break;
      // Un fallo puntual no corta el seguimiento: se marca y se vuelve a intentar.
      setSinConexion(op === null);
      if (op) {
        actual = op;
        setOperacion(op);
      }
      if (cortar) break;
    }
    return actual;
  }, []);

  return { operacion, setOperacion, sinConexion, seguir, detener };
}
