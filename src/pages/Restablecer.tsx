import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { restablecerContrasena } from "../api/auth";
import { mensajeError } from "../api/client";
import { REGLAS_PASSWORD } from "../lib/password";
import { useToast } from "../components/ToastProvider";
import Spinner from "../components/Spinner";

export default function Restablecer() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const toast = useToast();

  const [pass, setPass] = useState("");
  const [conf, setConf] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const reglas = useMemo(() => REGLAS_PASSWORD.map((r) => ({ msg: r.msg, ok: r.ok(pass) })), [pass]);
  const todoOk = reglas.every((r) => r.ok);
  const coincide = pass.length > 0 && pass === conf;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Falta el token de recuperación en el enlace.");
      return;
    }
    if (!coincide) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      await restablecerContrasena(token, pass, conf);
      toast("Contraseña actualizada. Ya puedes iniciar sesión.", "success");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(mensajeError(err, "No se pudo restablecer la contraseña."));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-md sm:p-lg relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl" />
      <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-[16px] border border-surface-variant p-xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] flex flex-col relative z-10">
        <img src="/logo.webp" alt="Igualab" className="h-10 object-contain mb-lg self-center" />
        <h1 className="text-headline-md text-on-background mb-xs text-center">Restablecer contraseña</h1>
        <p className="text-body-md text-on-surface-variant mb-xl text-center">Define tu nueva contraseña.</p>

        {!token && (
          <div className="rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md mb-md">
            Enlace inválido: falta el token. Solicita uno nuevo desde <Link to="/login" className="underline">iniciar sesión</Link>.
          </div>
        )}

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-md" noValidate>
          <label className="flex flex-col gap-xs">
            <span className="text-label-md text-on-surface-variant">Nueva contraseña</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="h-[48px] rounded-xl border border-outline-variant px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-label-md text-on-surface-variant">Confirmar contraseña</span>
            <input type="password" value={conf} onChange={(e) => setConf(e.target.value)} className="h-[48px] rounded-xl border border-outline-variant px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </label>

          <ul className="grid grid-cols-2 gap-xs text-label-sm">
            {reglas.map((r) => (
              <li key={r.msg} className={`flex items-center gap-xs ${r.ok ? "text-primary" : "text-on-surface-variant"}`}>
                <span className="material-symbols-outlined text-[16px]">{r.ok ? "check_circle" : "radio_button_unchecked"}</span>
                {r.msg}
              </li>
            ))}
          </ul>

          {error && <div className="rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">{error}</div>}

          <button type="submit" disabled={cargando || !todoOk || !coincide || !token} className="w-full h-[48px] bg-primary text-on-primary rounded-xl text-label-md font-semibold hover:bg-surface-tint transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-sm">
            {cargando && <Spinner size={18} />}
            {cargando ? "Guardando…" : "Actualizar contraseña"}
          </button>
          <Link to="/login" className="text-label-md text-secondary hover:underline self-center">Volver a iniciar sesión</Link>
        </form>
      </div>
    </div>
  );
}
