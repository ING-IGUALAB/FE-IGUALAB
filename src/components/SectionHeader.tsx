import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { iconoDeRuta } from "./navegacion";

interface Props {
  titulo: string;
  sub?: string;
  acciones?: ReactNode;
}

/**
 * Cabecera de sección: el ícono de la sección (el mismo del menú y de las migas de pan), título y
 * bajada, acciones a la derecha y una regla en tinta que cierra la cabecera.
 */
export default function SectionHeader({ titulo, sub, acciones }: Readonly<Props>) {
  const { pathname } = useLocation();
  const icono = iconoDeRuta(pathname);
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-md border-b-2 border-on-surface pb-lg">
      <div className="flex items-center gap-md min-w-0">
        {icono && (
          // El ícono sube desde detrás de la regla al entrar a la sección.
          <span aria-hidden="true" className="hidden sm:block overflow-hidden shrink-0 select-none">
            <motion.span
              className="w-14 h-14 rounded-2xl bg-primary/15 text-primary-ink flex items-center justify-center"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="material-symbols-outlined filled text-[32px]">{icono}</span>
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
