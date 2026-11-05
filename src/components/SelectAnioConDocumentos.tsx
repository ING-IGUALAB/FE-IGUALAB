import { textoSinAnios } from "../lib/dominio";
import type { AniosConDocumentos } from "./useAniosConDocumentos";

/** Lista de años de una empresa: solo los que tiene sentido consultar. */
export default function SelectAnioConDocumentos({
  seleccion,
  className,
  etiqueta = String,
}: Readonly<{ seleccion: Pick<AniosConDocumentos, "anios" | "anio" | "setAnio" | "hayEmpresa" | "cargando">; className: string; etiqueta?: (anio: number) => string }>) {
  const { anios, anio, setAnio, hayEmpresa, cargando } = seleccion;
  return (
    <select value={anio ?? ""} onChange={(e) => setAnio(Number(e.target.value))} disabled={anios.length === 0} className={className}>
      {anios.length === 0 && <option value="">{textoSinAnios(hayEmpresa, cargando)}</option>}
      {anios.map((a) => <option key={a} value={a}>{etiqueta(a)}</option>)}
    </select>
  );
}
