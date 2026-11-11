import { Fragment } from "react";
import { Link } from "react-router-dom";
import type { Miga } from "./navegacion";

/**
 * Migas de pan: dónde está la persona dentro del sistema (Inicio › sección › página) y un atajo para
 * volver al inicio. El último paso es la página actual y no es enlace.
 */
export default function MigasDePan({ migas }: Readonly<{ migas: Miga[] }>) {
  return (
    <nav aria-label="Migas de pan" className="hidden md:block min-w-0">
      <ol className="flex items-center gap-xs text-label-md text-on-surface-variant min-w-0">
        {migas.map((m, i) => {
          const ultima = i === migas.length - 1;
          return (
            <Fragment key={`${m.etiqueta}-${i}`}>
              {i > 0 && (
                <li aria-hidden="true" className="material-symbols-outlined text-[18px] text-outline select-none">
                  chevron_right
                </li>
              )}
              <li className={`min-w-0 ${ultima ? "truncate" : "shrink-0"}`}>
                {ultima && (
                  <span aria-current="page" className="inline-flex items-center gap-xs font-semibold text-on-surface">
                    {m.icono && <span className="material-symbols-outlined text-[18px] text-primary-ink" aria-hidden="true">{m.icono}</span>}
                    {m.etiqueta}
                  </span>
                )}
                {!ultima && m.to && (
                  <Link to={m.to} className="inline-flex items-center gap-xs hover:text-primary-ink hover:underline">
                    {i === 0 && <span className="material-symbols-outlined text-[18px]" aria-hidden="true">home</span>}
                    {m.etiqueta}
                  </Link>
                )}
                {!ultima && !m.to && <span>{m.etiqueta}</span>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
