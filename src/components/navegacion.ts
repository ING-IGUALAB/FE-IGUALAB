import type { Rol } from "../types";

export interface ItemMenu {
  to: string;
  label: string;
  icon: string;
}

// Secciones de cada rol, en el orden en que se trabaja. Cada una se reconoce por su ícono.
export const MENUS: Record<Rol, ItemMenu[]> = {
  superadmin: [
    { to: "/usuarios", label: "Usuarios y roles", icon: "group" },
    { to: "/empresas", label: "Catálogo de empresas", icon: "apartment" },
    { to: "/ingesta", label: "Ingesta de documentos", icon: "upload_file" },
    { to: "/auditoria", label: "Auditoría", icon: "history" },
  ],
  administrador: [
    { to: "/ia", label: "Asistente de IA", icon: "psychology" },
    { to: "/analisis", label: "Análisis GRI", icon: "fact_check" },
    { to: "/reportes", label: "Reportes de prospección", icon: "assessment" },
    { to: "/descargas", label: "Descargar reportes", icon: "download" },
  ],
};

export const TITULO_MENU: Record<Rol, string> = {
  superadmin: "Administración",
  administrador: "Flujo de trabajo",
};

/** Ícono de la sección de una ruta, o null si la ruta no es una sección del menú. */
export function iconoDeRuta(ruta: string): string | null {
  for (const items of Object.values(MENUS)) {
    const item = items.find((m) => m.to === ruta);
    if (item) return item.icon;
  }
  return null;
}

/** Un paso de las migas de pan: con `to` es un enlace; sin él, solo texto (la sección o la página actual). */
export interface Miga {
  etiqueta: string;
  to?: string;
  icono?: string;
}

/**
 * Migas de pan de una ruta: Inicio (la opción 01 del rol) › sección del menú › página actual.
 * La sección no es una página, por eso va como texto.
 */
export function migasDePan(rol: Rol | null, ruta: string): Miga[] {
  const items = rol ? MENUS[rol] : [];
  const inicio: Miga = { etiqueta: "Inicio", to: items[0]?.to ?? "/" };
  const i = items.findIndex((m) => m.to === ruta);
  if (rol && i >= 0) return [inicio, { etiqueta: TITULO_MENU[rol] }, { etiqueta: items[i].label, icono: items[i].icon }];
  if (ruta === "/mi-cuenta") return [inicio, { etiqueta: "Mi cuenta" }, { etiqueta: "Cambiar contraseña", icono: "key" }];
  return [inicio];
}
