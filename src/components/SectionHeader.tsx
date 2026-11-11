import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { numeralDeRuta } from "./navegacion";

interface Props {
  titulo: string;
  sub?: string;
  acciones?: ReactNode;
}

/**
 * Cabecera de sección del manual: numeral grande en azul (posición de la pantalla en el menú),
 * título y bajada, acciones a la derecha y una regla en tinta que cierra la cabecera.
 */
export default function SectionHeader({ titulo, sub, acciones }: Readonly<Props>) {
  const { pathname } = useLocation();
  const numeral = numeralDeRuta(pathname);
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-md border-b-2 border-on-surface pb-lg">
      <div className="flex items-end gap-lg min-w-0">
        {numeral && (
          // El numeral sube desde detrás de la regla al entrar a la sección, como un índice que se pasa.
          <span aria-hidden="true" className="hidden sm:block overflow-hidden shrink-0 select-none pb-[2px]">
            <motion.span
              className="block text-numeral text-primary"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            >
              {numeral}
            </motion.span>
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-headline-lg text-on-background text-balance">{titulo}</h2>
          {sub && <p className="text-body-md text-on-surface-variant mt-1 max-w-[70ch]">{sub}</p>}
        </div>
      </div>
      {acciones}
    </div>
  );
}
