import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { disponibilidadReportes, reporteVigente } from "../api/reportes";
import type { AnioDisponible, ReporteVigente } from "../types";

interface DatosEmpresa {
  empresaId: string;
  anios: AnioDisponible[];
  /** No se pudo consultar y no hay datos anteriores de esta empresa que mostrar. */
  fallo: boolean;
}

const SIN_DATOS: DatosEmpresa = { empresaId: "", anios: [], fallo: false };
const SIN_ANIOS: AnioDisponible[] = [];

/**
 * Años de una empresa con su situación respecto del reporte y el año elegido. El servidor es quien
 * decide qué se puede hacer con cada año; `recargar` vuelve a preguntarle tras emitir o ante un error.
 * Las respuestas de una selección anterior se descartan.
 */
export function useDisponibilidadReportes(empresaId: string) {
  const [datos, setDatos] = useState<DatosEmpresa>(SIN_DATOS);
  const [anio, setAnio] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [vigente, setVigente] = useState<ReporteVigente | null>(null);
  const recargar = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!empresaId) return;
    let actual = true;
    disponibilidadReportes(empresaId)
      .then((d) => {
        if (actual) setDatos({ empresaId, anios: d.anios, fallo: false });
      })
      .catch(() => {
        // Si ya había datos de esta empresa se conservan; el servidor vuelve a comprobar al emitir.
        if (actual) setDatos((previo) => (previo.empresaId === empresaId ? previo : { empresaId, anios: [], fallo: true }));
      });
    return () => {
      actual = false;
    };
  }, [empresaId, revision]);

  const listos = !!empresaId && datos.empresaId === empresaId;
  const anios = listos ? datos.anios : SIN_ANIOS;
  const lista = useMemo(() => anios.map((a) => a.anio), [anios]);

  useEffect(() => {
    setAnio((elegido) => (elegido !== null && lista.includes(elegido) ? elegido : (lista[0] ?? null)));
  }, [lista]);

  const item = anios.find((a) => a.anio === anio);
  const reporteId = item?.reporte_id ?? null;
  const anioConReporte = reporteId ? anio : null;

  // Datos de la última emisión (quién y cuándo). Solo cambian si cambia la emisión.
  useEffect(() => {
    setVigente(null);
    if (!reporteId || anioConReporte === null) return;
    let actual = true;
    reporteVigente(empresaId, anioConReporte)
      .then((r) => {
        if (actual) setVigente(r);
      })
      .catch((err) => {
        // Sin estos datos la pantalla sigue funcionando con lo que dio la disponibilidad.
        if (actual && err instanceof ApiError && err.code === "REPORT_NOT_FOUND") recargar();
      });
    return () => {
      actual = false;
    };
  }, [empresaId, anioConReporte, reporteId, recargar]);

  const hayEmpresa = !!empresaId;
  return {
    anios: lista,
    items: anios,
    item,
    vigente: vigente?.id === reporteId ? vigente : null,
    anio: lista.length ? anio : null,
    setAnio,
    hayEmpresa,
    cargando: hayEmpresa && !listos,
    fallo: listos && datos.fallo,
    sinAnios: listos && !datos.fallo && lista.length === 0,
    recargar,
  };
}
