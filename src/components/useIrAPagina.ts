import { useState, type FormEvent } from "react";
import { paginaValida } from "../lib/dominio";

export type PropsPaginacion = Readonly<{
  pagina: number;
  totalPaginas: number;
  onCambiar: (p: number) => void;
  deshabilitado?: boolean;
}>;

/** Lógica común de las paginaciones: cambiar de página y el campo «Ir a» (número escrito). */
export function useIrAPagina(pagina: number, totalPaginas: number, onCambiar: (p: number) => void) {
  const [ir, setIr] = useState("");

  const irA = (p: number) => {
    if (p !== pagina) onCambiar(p);
  };

  function irDirecto(e: FormEvent) {
    e.preventDefault();
    const p = paginaValida(ir, totalPaginas);
    if (p !== null) irA(p);
    setIr("");
  }

  return { ir, setIr, irA, irDirecto };
}
