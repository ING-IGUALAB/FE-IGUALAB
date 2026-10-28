import { useId, useState } from "react";

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
  const accion = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="text-label-md text-on-surface-variant">{etiqueta}</label>
      <div className="relative flex items-center">
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
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={accion}
          aria-pressed={visible}
          title={accion}
          className="absolute right-[12px] text-outline hover:text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{visible ? "visibility_off" : "visibility"}</span>
        </button>
      </div>
    </div>
  );
}
