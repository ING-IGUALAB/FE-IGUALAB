import { useState } from "react";
import { useToast } from "./ToastProvider";
import { descargarReporte, mensajeErrorReporte } from "../api/reportes";
import { tipoAviso } from "../api/client";
import { descargarBlob } from "../lib/descargas";
import { nombreArchivoReporte } from "../lib/dominio";
import type { ReporteResumen } from "../types";

/** Descarga el PDF de una versión concreta, también histórica (la usan Reportes y Descargar reportes). */
export function useDescargarReporte() {
  const toast = useToast();
  const [descargando, setDescargando] = useState<string | null>(null);

  async function descargar(r: Pick<ReporteResumen, "id" | "empresa_nombre" | "anio" | "version">) {
    setDescargando(r.id);
    try {
      const { blob } = await descargarReporte(r.id);
      // El nombre lleva la versión para que no se confundan los archivos de un mismo año.
      descargarBlob(blob, nombreArchivoReporte(r.empresa_nombre, r.anio, r.version));
      toast("Descarga iniciada.", "success");
    } catch (err) {
      toast(mensajeErrorReporte(err, "No se pudo descargar el reporte."), tipoAviso(err));
    } finally {
      setDescargando(null);
    }
  }

  return { descargar, descargando };
}
