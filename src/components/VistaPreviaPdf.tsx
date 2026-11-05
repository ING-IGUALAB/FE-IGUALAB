import { useEffect, useRef, useState } from "react";
import urlWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Spinner from "./Spinner";

// Ancho al que se dibuja cada hoja como máximo (A4 a 96 ppp), para que se lea igual en pantallas anchas.
const ANCHO_MAX_HOJA = 794;

/**
 * Muestra un PDF solo para leerlo: dibuja cada hoja en un <canvas>, sin el visor del navegador (sin
 * barra de herramientas, descarga ni impresión). PDF.js se carga recién cuando se abre una vista previa.
 */
export default function VistaPreviaPdf({ archivo, titulo }: Readonly<{ archivo: Blob; titulo: string }>) {
  const hojas = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => {
    const destino = hojas.current;
    if (!destino) return;
    let cancelado = false;
    let liberar = () => {};
    setEstado("cargando");

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;
      const datos = new Uint8Array(await archivo.arrayBuffer());
      const tarea = pdfjs.getDocument({ data: datos });
      liberar = () => void tarea.destroy();
      const pdf = await tarea.promise;

      const ancho = Math.min(destino.clientWidth, ANCHO_MAX_HOJA);
      for (let n = 1; n <= pdf.numPages && !cancelado; n += 1) {
        const pagina = await pdf.getPage(n);
        const base = pagina.getViewport({ scale: 1 });
        // Se dibuja a la densidad de la pantalla para que el texto se vea nítido.
        const vista = pagina.getViewport({ scale: (ancho / base.width) * (globalThis.devicePixelRatio || 1) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vista.width);
        canvas.height = Math.floor(vista.height);
        canvas.className = "block w-full bg-white rounded-sm shadow-md";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Página ${n} de ${pdf.numPages}`);
        await pagina.render({ canvas, viewport: vista }).promise;
        if (!cancelado) destino.append(canvas);
      }
      if (!cancelado) setEstado("listo");
    })().catch(() => {
      if (!cancelado) setEstado("error");
    });

    return () => {
      cancelado = true;
      liberar();
      destino.replaceChildren();
    };
  }, [archivo]);

  return (
    <section
      aria-label={titulo}
      onContextMenu={(e) => e.preventDefault()}
      className="h-[70vh] overflow-y-auto bg-surface-container-low p-md sm:p-lg select-none"
    >
      {estado === "cargando" && (
        <p className="h-full flex items-center justify-center gap-sm text-body-md text-on-surface-variant">
          <Spinner size={18} /> Preparando la vista previa…
        </p>
      )}
      {estado === "error" && (
        <p className="h-full flex items-center justify-center text-body-md text-on-surface-variant">
          No se pudo mostrar la vista previa. Inténtalo de nuevo.
        </p>
      )}
      <div ref={hojas} className="mx-auto space-y-md" style={{ maxWidth: ANCHO_MAX_HOJA }} />
    </section>
  );
}
