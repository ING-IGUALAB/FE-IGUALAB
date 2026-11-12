import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { BotonVerContrasena } from "../components/CampoContrasena";
import { mensajeError } from "../api/client";
import { recuperarContrasena } from "../api/auth";
import { esCorreoValido } from "../lib/validacion";
import PortadaLogin from "../components/PortadaLogin";
import BotonTema from "../components/BotonTema";

// Entrada escalonada del formulario: cada bloque sube apenas y aparece, uno tras otro.
const ENTRADA = {
  oculto: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.23, 1, 0.32, 1] } },
};

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
    if (!esCorreoValido(correo)) {
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
    <div className="min-h-screen grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] bg-background">
      <PortadaLogin />
      <div className="relative flex items-center justify-center p-md sm:p-xl">
      <BotonTema className="absolute top-md right-md" />
      <motion.div
        initial="oculto"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        className="w-full max-w-[400px] flex flex-col"
      >
        <motion.img variants={ENTRADA} src="/logo.webp" alt="Igualab" className="h-10 w-fit object-contain mb-xl md:hidden logo-adaptativo" />
        <motion.h1 variants={ENTRADA} className="text-headline-lg text-on-background mb-xs">Bienvenido a Igualab</motion.h1>
        <motion.p variants={ENTRADA} className="text-body-md text-on-surface-variant mb-lg pb-lg border-b-2 border-on-surface">Inteligencia de sostenibilidad y prospección</motion.p>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-md" noValidate>
          <motion.div variants={ENTRADA} className="flex flex-col gap-xs">
            <label className="text-label-md font-semibold text-on-surface" htmlFor="correo">Correo electrónico</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-[12px] text-outline text-[20px]">mail</span>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@igualab.com"
                className="w-full h-[48px] pl-[44px] pr-[12px] border border-outline bg-surface-container-lowest text-on-background text-body-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none transition-all"
              />
            </div>
          </motion.div>
          <motion.div variants={ENTRADA} className="flex flex-col gap-xs">
            <label className="text-label-md font-semibold text-on-surface" htmlFor="pass">Contraseña</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-[12px] text-outline text-[20px]">lock</span>
              <input
                id="pass"
                type={verPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-[48px] pl-[44px] pr-[44px] border border-outline bg-surface-container-lowest text-on-background text-body-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none transition-all"
              />
              <BotonVerContrasena visible={verPass} onAlternar={() => setVerPass((v) => !v)} deshabilitado={!password} />
            </div>
            <div className="flex justify-end mt-sm">
              <button type="button" onClick={() => setRecOpen(true)} className="text-label-md text-primary-ink underline-offset-4 hover:underline">
                ¿Olvidó su contraseña?
              </button>
            </div>
          </motion.div>

          {error && (
            <div className="shake flex items-center gap-sm rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <motion.button
            variants={ENTRADA}
            type="submit"
            disabled={cargando || !correo.trim() || !password}
            aria-busy={cargando}
            className="w-full h-[48px] mt-sm bg-primary text-on-primary group text-body-md font-semibold hover:bg-surface-tint transition-colors flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            {cargando ? (
              <>
                <Spinner size={18} /> Ingresando…
              </>
            ) : (
              <>
                Iniciar sesión{" "}
                <span className="material-symbols-outlined text-[18px] transition-transform duration-200 ease-out group-enabled:group-hover:translate-x-1">arrow_forward</span>
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
      </div>

      <Modal open={recOpen} onClose={() => setRecOpen(false)}>
        <div className="p-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-primary-ink">lock_reset</span>
          <h3 className="text-title-lg text-on-background mt-md">Recuperar contraseña</h3>
          <p className="text-body-md text-on-surface-variant mt-sm">
            Ingresa tu correo. Si está registrado, te enviaremos un enlace de recuperación con vigencia de 30 minutos.
          </p>
          <input
            value={recMail}
            onChange={(e) => setRecMail(e.target.value)}
            className="w-full mt-lg rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary-ink focus:ring-1 focus:ring-primary-ink outline-none"
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
