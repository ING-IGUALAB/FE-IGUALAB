import { useState } from "react";
import { useToast } from "./ToastProvider";
import { descargarReporte } from "../api/reportes";
import { mensajeError } from "../api/client";
import { descargarBlob } from "../lib/descargas";
import { nombreArchivoReporte } from "../lib/dominio";
import type { ReporteResumen } from "../types";

/** Descarga el PDF de un reporte ya generado (lo usan Reportes y Descargar reportes). */
export function useDescargarReporte(nombreEmpresa: (empresaId: string) => string) {
  const toast = useToast();
  const [descargando, setDescargando] = useState<string | null>(null);

  async function descargar(r: ReporteResumen) {
    setDescargando(r.id);
    try {
      const { blob, nombre } = await descargarReporte(r.id);
      descargarBlob(blob, nombre ?? nombreArchivoReporte(nombreEmpresa(r.empresa_id), r.anio));
      toast("Descarga iniciada.", "success");
    } catch (err) {
      toast(mensajeError(err, "No se pudo descargar el reporte."), "error");
    } finally {
      setDescargando(null);
    }
  }

  return { descargar, descargando };
}
