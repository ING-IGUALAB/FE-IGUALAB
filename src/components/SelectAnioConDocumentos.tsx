import { textoSinAnios } from "../lib/dominio";
import type { AniosConDocumentos } from "./useAniosConDocumentos";

/** Lista de años de una empresa: solo los años en que tiene documentos subidos. */
export default function SelectAnioConDocumentos({
  seleccion,
  className,
  etiqueta = String,
}: Readonly<{ seleccion: AniosConDocumentos; className: string; etiqueta?: (anio: number) => string }>) {
  const { anios, anio, setAnio, hayEmpresa, cargando } = seleccion;
  return (
    <select value={anio ?? ""} onChange={(e) => setAnio(Number(e.target.value))} disabled={anios.length === 0} className={className}>
      {anios.length === 0 && <option value="">{textoSinAnios(hayEmpresa, cargando)}</option>}
      {anios.map((a) => <option key={a} value={a}>{etiqueta(a)}</option>)}
    </select>
  );
}
