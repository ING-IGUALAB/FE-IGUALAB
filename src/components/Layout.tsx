import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "./ToastProvider";
import { iniciales } from "../lib/format";
import { MENUS, TITULO_MENU, migasDePan } from "./navegacion";
import MigasDePan from "./MigasDePan";
import BotonTema from "./BotonTema";

// Preferencia de esta persona en este navegador: si no se puede leer o guardar, el menú queda visible.
const CLAVE_MENU = "igualab.menu-colapsado";

// En escritorio, con la barra colapsada, el texto de cada opción pasa a ser un rótulo que aparece al
// pasar el mouse o enfocarla. Sigue en el documento, así la opción conserva su nombre accesible.
const ROTULO_COLAPSADO =
  "md:absolute md:left-full md:ml-sm md:z-40 md:px-sm md:py-xs md:rounded-md md:bg-inverse-surface md:text-inverse-on-surface md:text-label-sm md:font-normal md:whitespace-nowrap md:opacity-0 md:pointer-events-none md:transition-opacity md:group-hover:opacity-100 md:group-focus-visible:opacity-100";

function leerMenuColapsado(): boolean {
  try {
    return localStorage.getItem(CLAVE_MENU) === "1";
  } catch {
    return false;
  }
}

function guardarMenuColapsado(colapsado: boolean) {
  try {
    localStorage.setItem(CLAVE_MENU, colapsado ? "1" : "0");
  } catch {
    // Sin almacenamiento disponible, la preferencia dura solo esta visita.
  }
}

const esEscritorio = () => globalThis.matchMedia("(min-width: 768px)").matches;

const INACTIVIDAD_MIN = 120; // 2 horas de inactividad para cerrar sesión
const INACTIVIDAD_MS = INACTIVIDAD_MIN * 60 * 1000;

export default function Layout() {
  const { sesion, rol, cerrarSesion } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Se captura la ruta en cada render: así la página que sale en la animación sigue
  // mostrando su propio contenido (con <Outlet /> mostraría la ruta nueva y la montaría dos veces).
  const outlet = useOutlet();
  const [restante, setRestante] = useState(INACTIVIDAD_MIN * 60);
  // Se mide contra la hora de la última actividad (no contando "tics"): el navegador frena
  // los temporizadores en pestañas en segundo plano y el conteo por tics se atrasaría.
  const ultimaActividad = useRef(Date.now());
  const [menuColapsado, setMenuColapsado] = useState(leerMenuColapsado); // escritorio: solo íconos
  const [menuMovil, setMenuMovil] = useState(false); // móvil: menú sobre el contenido

  const items = rol ? MENUS[rol] : [];
  // El logo lleva a la primera opción del menú del rol (la «01»).
  const inicio = items[0]?.to ?? "/";

  function alternarMenu() {
    if (esEscritorio()) {
      setMenuColapsado((colapsado) => {
        guardarMenuColapsado(!colapsado);
        return !colapsado;
      });
    } else {
      setMenuMovil((abierto) => !abierto);
    }
  }

  // En móvil, el menú se cierra al navegar y con Escape.
  useEffect(() => setMenuMovil(false), [location.pathname]);
  useEffect(() => {
    if (!menuMovil) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuMovil(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuMovil]);

  // Expiración por inactividad.
  useEffect(() => {
    const reset = () => {
      ultimaActividad.current = Date.now();
    };
    const eventos = ["mousemove", "keydown", "click", "scroll"];
    eventos.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    const iv = setInterval(async () => {
      const quedan = Math.max(0, Math.ceil((INACTIVIDAD_MS - (Date.now() - ultimaActividad.current)) / 1000));
      setRestante(quedan);
      if (quedan <= 0) {
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

  const hh = Math.floor(restante / 3600);
  const mm = Math.floor((restante % 3600) / 60);
  const ss = String(restante % 60).padStart(2, "0");
  const reloj = hh > 0 ? `${hh}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;

  async function onLogout() {
    await cerrarSesion();
    toast("Sesión cerrada.", "info");
    navigate("/login", { replace: true });
  }

  if (!sesion) return null;

  const rotulo = menuColapsado ? ROTULO_COLAPSADO : "";
  const centrado = menuColapsado ? "md:justify-center md:gap-0" : "";

  return (
    <div className="min-h-screen bg-background">
      {menuMovil && (
        <button
          type="button"
          data-testid="menu-fondo"
          aria-label="Cerrar menú"
          onClick={() => setMenuMovil(false)}
          className="md:hidden fixed inset-0 z-20 w-full h-full cursor-default bg-black/40"
        />
      )}
      <aside
        id="menu-lateral"
        className={`flex flex-col w-[260px] h-screen fixed left-0 top-0 bg-rail text-on-rail border-r border-rail-line z-30 transition-[transform,visibility,width] duration-200 ease-out md:translate-x-0 md:visible ${
          menuMovil ? "translate-x-0 visible" : "-translate-x-full invisible"
        } ${menuColapsado ? "md:w-[72px]" : "md:w-[260px]"}`}
      >
        <div className={`px-lg pt-xl pb-lg flex items-center gap-md ${menuColapsado ? "md:hidden" : ""}`}>
          {/* El logo es negro sobre transparente: sobre el riel oscuro se invierte a blanco. */}
          <Link to={inicio} aria-label="Igualab: ir al inicio" title="Ir al inicio">
            <img src="/logo.webp" alt="Igualab" className="h-9 object-contain logo-claro" />
          </Link>
        </div>
        <nav className={`flex-1 overflow-y-auto pb-lg px-md ${menuColapsado ? "md:overflow-visible md:px-0 md:pt-lg" : ""}`}>
          {rol && (
            <p className={`px-sm pb-sm text-label-sm uppercase tracking-[0.12em] text-on-rail-variant ${menuColapsado ? "md:hidden" : ""}`} aria-hidden="true">
              {TITULO_MENU[rol]}
            </p>
          )}
          {items.map((m) => (
            <NavLink key={m.to} to={m.to} className={({ isActive }) => `nav-item group ${isActive ? "active" : ""} ${menuColapsado ? "md:!justify-center md:!gap-0 md:!px-0" : ""}`}>
              {({ isActive }) => (
                <>
                  {/* Bloque de la opción actual: se desliza de una opción a otra al navegar. */}
                  {isActive && (
                    <motion.span
                      layoutId="opcion-actual"
                      aria-hidden="true"
                      className="absolute inset-0 bg-primary/15"
                      transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    />
                  )}
                  {/* Cada sección se reconoce por su ícono; colapsada (escritorio) queda solo el ícono. */}
                  <span aria-hidden="true" className={`nav-icono material-symbols-outlined relative shrink-0 ${isActive ? "filled" : ""}`}>{m.icon}</span>
                  <span className={`relative text-body-md ${rotulo}`}>{m.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={`border-t border-rail-line mx-md py-md space-y-xs ${menuColapsado ? "md:mx-0 md:px-0" : ""}`}>
          <NavLink to="/mi-cuenta" className={`group relative flex items-center gap-md min-h-10 px-sm text-on-rail-variant hover:text-on-rail transition-colors ${centrado}`}>
            <span className="material-symbols-outlined">key</span>
            <span className={`text-body-md ${rotulo}`}>Cambiar contraseña</span>
          </NavLink>
          <button onClick={onLogout} className={`group relative flex items-center gap-md min-h-10 px-sm text-on-rail-variant hover:text-on-rail transition-colors w-full ${centrado}`}>
            <span className="material-symbols-outlined">logout</span>
            <span className={`text-body-md ${rotulo}`}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className={`ml-0 min-h-screen flex flex-col transition-[margin] duration-200 ease-out ${menuColapsado ? "md:ml-[72px]" : "md:ml-[260px]"}`}>
        <header className="flex justify-between items-center w-full px-lg md:px-xl py-sm bg-surface-bright h-16 sticky top-0 z-10 border-b border-outline-variant">
          <div className="flex items-center gap-sm -ml-sm md:-ml-md min-w-0">
            <button
              type="button"
              onClick={alternarMenu}
              aria-label="Mostrar u ocultar el menú"
              title="Mostrar u ocultar el menú"
              aria-controls="menu-lateral"
              className="w-10 h-10 shrink-0 flex items-center justify-center text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined" aria-hidden="true">menu</span>
            </button>
            {/* Con la barra colapsada (o en móvil) el logo de la barra no se ve: se muestra aquí. */}
            <Link to={inicio} aria-label="Igualab: ir al inicio" title="Ir al inicio" className={`shrink-0 ${menuColapsado ? "" : "md:hidden"}`}>
              <img src="/logo.webp" alt="Igualab" className="h-7 object-contain logo-adaptativo" />
            </Link>
            <MigasDePan migas={migasDePan(rol, location.pathname)} />
          </div>
          <div className="flex items-center gap-sm md:gap-md">
            <span className="hidden lg:inline text-label-md text-on-surface-variant">Sesión activa · {reloj}</span>
            <BotonTema />
            <div className="h-8 w-px bg-outline-variant mx-sm" />
            <div className="flex items-center gap-sm">
              <div className="w-8 h-8 bg-primary text-on-primary flex items-center justify-center text-label-md font-bold">
                {iniciales(sesion.nombre)}
              </div>
              <div className="hidden lg:block leading-tight">
                <p className="text-label-md text-on-surface font-semibold">{sesion.nombre}</p>
                <p className="text-label-md text-on-surface-variant capitalize">{rol}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-lg md:p-xl overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              className="space-y-xl"
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
