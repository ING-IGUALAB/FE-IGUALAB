import { useMemo, useState, type FormEvent } from "react";
import SectionHeader from "../components/SectionHeader";
import { cambiarMiContrasena } from "../api/auth";
import { mensajeError } from "../api/client";
import { REGLAS_PASSWORD } from "../lib/password";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/Spinner";

export default function MiCuenta() {
  const toast = useToast();
  const { sesion } = useAuth();
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
      <SectionHeader titulo="Mi cuenta" sub={`Sesión de ${sesion?.nombre}. Actualiza tu contraseña.`} />
      <div className="max-w-lg bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow">
        <form onSubmit={onSubmit} className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant">Contraseña actual</label>
            <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} className="h-[44px] rounded-xl border border-outline-variant px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant">Nueva contraseña</label>
            <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} className="h-[44px] rounded-xl border border-outline-variant px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant">Confirmar nueva contraseña</label>
            <input type="password" value={conf} onChange={(e) => setConf(e.target.value)} className="h-[44px] rounded-xl border border-outline-variant px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </div>
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
