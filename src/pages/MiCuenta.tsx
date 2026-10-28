import { useMemo, useState, type FormEvent } from "react";
import SectionHeader from "../components/SectionHeader";
import { cambiarMiContrasena } from "../api/auth";
import { mensajeError } from "../api/client";
import { REGLAS_PASSWORD } from "../lib/password";
import { useToast } from "../components/ToastProvider";
import Spinner from "../components/Spinner";
import CampoContrasena from "../components/CampoContrasena";

const CLS_CAMPO = "h-[44px] rounded-xl border border-outline-variant px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none";

export default function MiCuenta() {
  const toast = useToast();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [conf, setConf] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const reglas = useMemo(() => REGLAS_PASSWORD.map((r) => ({ msg: r.msg, ok: r.ok(nueva) })), [nueva]);
  const todoOk = reglas.every((r) => r.ok);
  const coincide = nueva.length > 0 && nueva === conf;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!coincide) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }
    setCargando(true);
    try {
      await cambiarMiContrasena(actual, nueva);
      toast("Contraseña actualizada correctamente.", "success");
      setActual("");
      setNueva("");
      setConf("");
    } catch (err) {
      setError(mensajeError(err, "No se pudo cambiar la contraseña."));
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <SectionHeader titulo="Mi cuenta" />
      <div className="max-w-lg bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow">
        <form onSubmit={onSubmit} className="flex flex-col gap-md">
          <CampoContrasena etiqueta="Contraseña actual" valor={actual} onCambiar={setActual} autoComplete="current-password" className={CLS_CAMPO} />
          <CampoContrasena etiqueta="Nueva contraseña" valor={nueva} onCambiar={setNueva} autoComplete="new-password" className={CLS_CAMPO} />
          <CampoContrasena etiqueta="Confirmar nueva contraseña" valor={conf} onCambiar={setConf} autoComplete="new-password" className={CLS_CAMPO} />
          <ul className="grid grid-cols-2 gap-xs text-label-sm">
            {reglas.map((r) => (
              <li key={r.msg} className={`flex items-center gap-xs ${r.ok ? "text-primary" : "text-on-surface-variant"}`}>
                <span className="material-symbols-outlined text-[16px]">{r.ok ? "check_circle" : "radio_button_unchecked"}</span>
                {r.msg}
              </li>
            ))}
          </ul>
          {error && <div className="rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">{error}</div>}
          <div className="flex justify-end">
            <button type="submit" disabled={cargando || !todoOk || !coincide || !actual} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint disabled:opacity-50 flex items-center gap-sm">
              {cargando && <Spinner size={16} />}
              {cargando ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
