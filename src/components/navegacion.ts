import type { Rol } from "../types";

export interface ItemMenu {
  to: string;
  label: string;
  icon: string;
}

// Secciones de cada rol, en el orden en que se trabaja. Su posición da el numeral de sección.
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

export const numeral = (indice: number) => String(indice + 1).padStart(2, "0");

/** Numeral de la sección de una ruta («01», «02»…), o null si la ruta no es una sección del menú. */
export function numeralDeRuta(ruta: string): string | null {
  for (const items of Object.values(MENUS)) {
    const i = items.findIndex((m) => m.to === ruta);
    if (i >= 0) return numeral(i);
  }
  return null;
}
