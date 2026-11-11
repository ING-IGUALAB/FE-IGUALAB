import { avanceDePasos, type EstadoPaso, type ProgresoPasos } from "../lib/progresoIngesta";

const SEGMENTO: Record<EstadoPaso, string> = {
  pendiente: "bg-surface-variant",
  activo: "bg-primary/40 animate-pulse",
  completado: "bg-primary",
  pausado: "bg-tertiary",
  fallido: "bg-error",
  cancelado: "bg-outline",
};

const PASO: Record<EstadoPaso, string> = {
  pendiente: "text-outline",
  activo: "bg-primary/10 text-primary-ink",
  completado: "text-on-surface",
  pausado: "bg-tertiary-fixed text-on-tertiary-fixed",
  fallido: "bg-error-container text-on-error-container",
  cancelado: "bg-surface-container-low text-on-surface-variant",
};

const ICONO: Partial<Record<EstadoPaso, string>> = {
  completado: "check_circle",
  pausado: "pause_circle",
  fallido: "error",
  cancelado: "block",
};

const ESTADO_LEIDO: Record<EstadoPaso, string> = {
  pendiente: "pendiente",
  activo: "en curso",
  completado: "completado",
  pausado: "en pausa",
  fallido: "con error",
  cancelado: "cancelado",
};

/**
 * Barra de progreso de la ingesta: 9 segmentos, uno por paso, y debajo los pasos con su estado.
 * Avanza solo con lo que informa el servidor. Es el único indicador de carga mientras se procesa.
 */
export default function TiraEtapasIngesta({ progreso, sinConexion = false }: Readonly<{ progreso: ProgresoPasos; sinConexion?: boolean }>) {
  const porcentaje = Math.round(avanceDePasos(progreso) * 100);
  return (
    <section aria-label="Progreso de la ingesta" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md space-y-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-xs">
        <h4 className="text-label-md font-semibold text-on-surface">Progreso de la ingesta</h4>
        <p role="status" aria-live="polite" className="text-label-sm text-on-surface-variant">
          {progreso.titulo}
          {progreso.fragmentos && ` · ${progreso.fragmentos.procesados} de ${progreso.fragmentos.total} fragmentos`}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Avance de la ingesta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        aria-valuetext={progreso.titulo}
        className="flex gap-[3px]"
      >
        {progreso.pasos.map(({ paso, estado }) => (
          <span key={paso.numero} className={`h-2 flex-1 first:rounded-l-full last:rounded-r-full transition-colors duration-300 ${SEGMENTO[estado]}`} />
        ))}
      </div>

      {/* Tres filas de tres: se lee en orden sin desplazar de lado, también en móvil. */}
      <ol className="grid grid-cols-3 gap-xs">
        {progreso.pasos.map(({ paso, estado }) => (
          <li
            key={paso.numero}
            aria-current={estado === "activo" || estado === "pausado" ? "step" : undefined}
            className={`min-w-0 rounded-lg px-xs sm:px-sm py-xs transition-colors ${PASO[estado]}`}
          >
            {/* Número e ícono arriba, nombre debajo: entra completo también en móvil. */}
            <span className="flex items-center justify-between gap-xs">
              <span className="text-label-sm font-semibold tabular-nums">{String(paso.numero).padStart(2, "0")}</span>
              {ICONO[estado] && (
                <span className={`material-symbols-outlined text-[16px] ${estado === "completado" ? "text-primary-ink" : ""}`} aria-hidden="true">
                  {ICONO[estado]}
                </span>
              )}
            </span>
            <span className="block text-[11px] sm:text-label-sm font-semibold leading-tight truncate">{paso.titulo}</span>
            <span className="hidden sm:block text-[11px] leading-tight opacity-80 truncate">{paso.detalle}</span>
            <span className="sr-only">: {ESTADO_LEIDO[estado]}</span>
          </li>
        ))}
      </ol>

      {sinConexion && (
        <p className="flex items-center gap-xs text-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">wifi_off</span>
          No se pudo consultar el avance. Se vuelve a intentar; la carga sigue en curso.
        </p>
      )}
    </section>
  );
}
