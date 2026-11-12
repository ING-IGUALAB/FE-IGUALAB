import { useId, useState } from "react";

/**
 * Botón de ojo para mostrar u ocultar una contraseña. Ocupa todo el alto del campo y centra el ícono
 * (el contenedor debe ser `relative`).
 */
export function BotonVerContrasena({
  visible,
  onAlternar,
  deshabilitado = false,
}: Readonly<{ visible: boolean; onAlternar: () => void; deshabilitado?: boolean }>) {
  const accion = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  return (
    <button
      type="button"
      onClick={onAlternar}
      disabled={deshabilitado}
      aria-label={accion}
      aria-pressed={visible}
      title={accion}
      className="absolute inset-y-0 right-0 w-11 flex items-center justify-center rounded-r-xl text-on-surface-variant enabled:hover:text-primary-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{visible ? "visibility_off" : "visibility"}</span>
    </button>
  );
}

/**
 * Campo de contraseña: oculta lo que se escribe y tiene un botón para mostrarla u ocultarla.
 * La etiqueta va aparte del contenedor (htmlFor) para que el nombre accesible del campo sea solo
 * la etiqueta y no incluya el texto del botón.
 */
export default function CampoContrasena({
  etiqueta,
  valor,
  onCambiar,
  autoComplete,
  className,
  placeholder,
  invalido = false,
  idDescripcion,
}: Readonly<{
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  autoComplete: "current-password" | "new-password";
  className: string;
  placeholder?: string;
  invalido?: boolean;
  idDescripcion?: string;
}>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="text-label-md text-on-surface-variant">{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalido || undefined}
          aria-describedby={idDescripcion}
          className={`w-full pr-[44px] ${className}`}
        />
        <BotonVerContrasena visible={visible} onAlternar={() => setVisible((v) => !v)} />
      </div>
    </div>
  );
}
