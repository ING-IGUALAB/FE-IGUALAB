import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "./ToastProvider";
import { iniciales } from "../lib/format";
import type { Rol } from "../types";

interface Item {
  to: string;
  label: string;
  icon: string;
}

const MENUS: Record<Rol, Item[]> = {
  superadmin: [
    { to: "/usuarios", label: "Usuarios y roles", icon: "group" },
    { to: "/ingesta", label: "Ingesta de documentos", icon: "upload_file" },
    { to: "/auditoria", label: "Auditoría", icon: "history" },
  ],
  administrador: [
    { to: "/ia", label: "Asistente de IA", icon: "psychology" },
    { to: "/reportes", label: "Reportes de prospección", icon: "assessment" },
    { to: "/descargas", label: "Descargar reportes", icon: "download" },
  ],
};

const INACTIVIDAD_MIN = 1; // PRUEBA: 1 min para verificar el cierre por inactividad (oficial: 30)

export default function Layout() {
  const { sesion, rol, cerrarSesion } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [restante, setRestante] = useState(INACTIVIDAD_MIN * 60);
  const idleRef = useRef(INACTIVIDAD_MIN * 60);

  const items = rol ? MENUS[rol] : [];

  // Expiración por inactividad.
  useEffect(() => {
    const reset = () => (idleRef.current = INACTIVIDAD_MIN * 60);
    const eventos = ["mousemove", "keydown", "click", "scroll"];
    eventos.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    const iv = setInterval(async () => {
      idleRef.current -= 1;
      setRestante(idleRef.current);
      if (idleRef.current <= 0) {
        clearInterval(iv);
        await cerrarSesion();
        toast("Tu sesión expiró por inactividad. Vuelve a autenticarte.", "warn");
        navigate("/login", { replace: true });
      }
    }, 1000);
    return () => {
      clearInterval(iv);
      eventos.forEach((e) => document.removeEventListener(e, reset));
    };
  }, [cerrarSesion, navigate, toast]);

  const mm = Math.floor(restante / 60);
  const ss = String(restante % 60).padStart(2, "0");

  async function onLogout() {
    await cerrarSesion();
    toast("Sesión cerrada.", "info");
    navigate("/login", { replace: true });
  }

  if (!sesion) return null;

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden md:flex flex-col w-[260px] h-screen fixed left-0 top-0 bg-surface-container-lowest border-r border-outline-variant shadow-sm z-20">
        <div className="px-lg py-lg border-b border-surface-variant flex items-center gap-md">
          <img src="/logo.webp" alt="Igualab" className="h-9 object-contain" />
        </div>
        <nav className="flex-1 overflow-y-auto py-lg px-sm">
          {items.map((m) => (
            <NavLink key={m.to} to={m.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              {({ isActive }) => (
                <>
                  <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>{m.icon}</span>
                  <span className="text-body-md">{m.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {rol === "administrador" && (
            <div className="mt-xl px-sm">
              <NavLink
                to="/ia"
                className="w-full flex items-center justify-center gap-sm bg-primary text-on-primary px-lg py-sm rounded-lg text-label-md font-bold hover:bg-primary-container transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined filled text-lg">auto_awesome</span> Nueva consulta IA
              </NavLink>
            </div>
          )}
        </nav>
        <div className="border-t border-surface-variant p-lg space-y-sm">
          <div className="flex items-center gap-md mb-sm">
            <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-semibold">
              {iniciales(sesion.nombre)}
            </div>
            <div className="min-w-0">
              <p className="text-label-md text-on-surface font-semibold truncate">{sesion.nombre}</p>
              <p className="text-label-sm text-on-surface-variant capitalize">{rol}</p>
            </div>
          </div>
          <NavLink to="/mi-cuenta" className="flex items-center gap-md text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">key</span>
            <span className="text-body-md">Cambiar contraseña</span>
          </NavLink>
          <button onClick={onLogout} className="flex items-center gap-md text-on-surface-variant hover:text-error transition-colors w-full">
            <span className="material-symbols-outlined">logout</span>
            <span className="text-body-md">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="ml-0 md:ml-[260px] min-h-screen flex flex-col">
        <header className="flex justify-between items-center w-full px-xl py-sm bg-surface-bright h-16 sticky top-0 z-10 border-b border-surface-variant">
          <img src="/logo.webp" alt="Igualab" className="h-7 md:hidden object-contain" />
          <div className="hidden md:block" />
          <div className="flex items-center gap-md">
            <span className="hidden lg:inline text-label-sm text-outline">Sesión activa · {mm}:{ss}</span>
            <div className="h-8 w-px bg-outline-variant mx-sm" />
            <div className="flex items-center gap-sm">
              <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-semibold">
                {iniciales(sesion.nombre)}
              </div>
              <div className="hidden lg:block leading-tight">
                <p className="text-label-md text-on-surface font-semibold">{sesion.nombre}</p>
                <p className="text-label-sm text-on-surface-variant capitalize">{rol}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-lg md:p-xl overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
