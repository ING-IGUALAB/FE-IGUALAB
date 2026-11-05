import { tablaMarkdown, textoLegible } from "../lib/dominio";

const NUMERO = /^[\d\s.,%+-]+$/;

/**
 * Fragmento citado de un documento. Si es una tabla de Markdown se muestra como tabla; si no, como
 * texto sin marcas. Todo se arma con elementos de React: el contenido nunca se interpreta como HTML.
 * `maxFilas` acorta la tabla en vistas resumidas (p. ej. la tarjeta de una fuente).
 */
export default function TextoDocumento({
  texto,
  className,
  comillas = false,
  maxFilas,
}: Readonly<{ texto: string; className: string; comillas?: boolean; maxFilas?: number }>) {
  const tabla = tablaMarkdown(texto);
  if (!tabla) {
    const limpio = textoLegible(texto);
    return <p className={className}>{comillas ? `«${limpio}»` : limpio}</p>;
  }
  const filas = maxFilas ? tabla.filas.slice(0, maxFilas) : tabla.filas;
  const ocultas = tabla.filas.length - filas.length;
  // Las columnas de números (todas sus celdas lo son) se alinean a la derecha, encabezado incluido.
  const numerica = tabla.encabezados.map((_, j) => tabla.filas.every((f) => f[j] === "" || NUMERO.test(f[j])) && tabla.filas.some((f) => f[j] !== ""));
  const alinear = (j: number) => (numerica[j] ? "text-right tabular-nums whitespace-nowrap" : "");
  return (
    <div className="mt-xs space-y-xs">
      {tabla.antes && <p className="text-label-sm text-on-surface-variant">{tabla.antes}</p>}
      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left text-label-md border-collapse">
          <thead>
            <tr className="bg-surface-container-low">
              {tabla.encabezados.map((h, i) => (
                <th key={`${i}-${h}`} scope="col" className={`px-sm py-xs font-semibold text-on-surface-variant whitespace-nowrap ${alinear(i)}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={`${i}-${fila.join("|")}`} className="border-t border-surface-variant">
                {fila.map((celda, j) => (
                  <td key={`${j}-${celda}`} className={`px-sm py-xs text-on-surface ${alinear(j)}`}>{celda}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ocultas > 0 && <p className="text-label-sm text-outline">y {ocultas} {ocultas === 1 ? "fila más" : "filas más"}</p>}
    </div>
  );
}
