import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { mensajeError } from "../api/client";
import { recuperarContrasena } from "../api/auth";

export default function Login() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const [recOpen, setRecOpen] = useState(false);
  const [recMail, setRecMail] = useState("");
  const [recCargando, setRecCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
      setError("Ingrese un correo válido.");
      return;
    }
    setCargando(true);
    try {
      const s = await iniciarSesion(correo.trim(), password);
      toast(`Bienvenido, ${s.nombre.split(" ")[0]}`, "success");
      navigate(s.rol === "superadmin" ? "/usuarios" : "/ia", { replace: true });
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesión."));
    } finally {
      setCargando(false);
    }
  }

  async function enviarRecuperacion() {
    setRecCargando(true);
    try {
      await recuperarContrasena(recMail.trim());
    } catch {
      /* respuesta idéntica por seguridad (RNF-007) */
    } finally {
      setRecCargando(false);
      setRecOpen(false);
      setRecMail("");
      toast("Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.", "info");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-md sm:p-lg relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary-fixed/20 rounded-full blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="w-full max-w-[440px] bg-surface-container-lowest rounded-[16px] border border-surface-variant p-xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] flex flex-col items-center relative z-10"
      >
        <img src="/logo.webp" alt="Igualab" className="h-12 object-contain mb-lg" />
        <h1 className="text-headline-md text-on-background mb-xs text-center">Bienvenido a Igualab</h1>
        <p className="text-body-md text-on-surface-variant mb-xl text-center">Inteligencia de sostenibilidad y prospección</p>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-md" noValidate>
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant" htmlFor="correo">Correo electrónico</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-[12px] text-outline-variant text-[20px]">mail</span>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@igualab.com"
                className="w-full h-[48px] pl-[44px] pr-[12px] rounded-xl border border-outline-variant bg-surface-container-lowest text-on-background text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant" htmlFor="pass">Contraseña</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-[12px] text-outline-variant text-[20px]">lock</span>
              <input
                id="pass"
                type={verPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-[48px] pl-[44px] pr-[44px] rounded-xl border border-outline-variant bg-surface-container-lowest text-on-background text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setVerPass((v) => !v)}
                disabled={!password}
                aria-label="Mostrar contraseña"
                className="absolute right-[12px] text-outline-variant enabled:hover:text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">{verPass ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
            <div className="flex justify-end mt-sm">
              <button type="button" onClick={() => setRecOpen(true)} className="text-label-md text-primary hover:text-surface-tint hover:underline">
                ¿Olvidó su contraseña?
              </button>
            </div>
          </div>

          {error && (
            <div className="shake flex items-center gap-sm rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando || !correo.trim() || !password}
            className="w-full h-[48px] mt-sm bg-primary text-on-primary rounded-xl text-label-md font-semibold hover:bg-surface-tint transition-colors shadow-sm flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            {cargando ? (
              <>
                <Spinner size={18} /> Ingresando…
              </>
            ) : (
              <>
                Iniciar sesión
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </motion.div>

      <Modal open={recOpen} onClose={() => setRecOpen(false)}>
        <div className="p-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-primary">lock_reset</span>
          <h3 className="text-title-lg text-on-background mt-md">Recuperar contraseña</h3>
          <p className="text-body-md text-on-surface-variant mt-sm">
            Ingresa tu correo. Si está registrado, te enviaremos un enlace de recuperación con vigencia de 30 minutos.
          </p>
          <input
            value={recMail}
            onChange={(e) => setRecMail(e.target.value)}
            className="w-full mt-lg rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            placeholder="tu@igualab.com"
          />
          <div className="flex justify-center gap-sm mt-lg">
            <button onClick={() => setRecOpen(false)} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant">Cancelar</button>
            <button onClick={enviarRecuperacion} disabled={recCargando} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold disabled:opacity-60 flex items-center gap-sm">
              {recCargando && <Spinner size={16} />}
              {recCargando ? "Enviando…" : "Enviar enlace"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
