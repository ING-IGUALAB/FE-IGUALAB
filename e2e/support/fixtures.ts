import { test as base, expect, type Locator, type Page } from "@playwright/test";
import type { Rol } from "../../src/types";
import { ServicioSimulado } from "./servicio-simulado";

export { expect };
export { CREDENCIALES } from "./servicio-simulado";

/**
 * `api`: servicio simulado nuevo por prueba, conectado a la página. Es automático: se
 * instala en TODAS las pruebas aunque no lo pidan, para que nunca se llegue a un backend real.
 */
export const test = base.extend<{ api: ServicioSimulado }>({
  api: [
    async ({ page }, use) => {
      // Red de seguridad: cualquier intento de llamar a un backend real (dev/qa/uat) se corta.
      // El frontend desplegado sí se permite: en Jenkins las pruebas corren sobre él.
      await page.route(/bck-igualab\./, (r) => r.abort());
      // Contra la app servida por nginx (Jenkins/QA o el contenedor local) rige la CSP: si el
      // navegador bloquea algo (script, estilo, fuente, conexión…), la prueba falla.
      const violacionesCsp: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && msg.text().includes("Content Security Policy")) violacionesCsp.push(msg.text());
      });
      const api = new ServicioSimulado();
      await api.instalar(page);
      await use(api);
      expect(violacionesCsp, "El navegador bloqueó recursos por la CSP").toEqual([]);
    },
    { auto: true },
  ],
});

const INICIO: Record<Rol, string> = { superadmin: "/usuarios", administrador: "/ia" };

/**
 * Campo de formulario (lista, número o texto) por su nombre accesible. Se busca por rol y no
 * con getByLabel porque, cuando la etiqueta envuelve un <select>, getByLabel compara contra
 * todo el texto de la etiqueta, que incluye las opciones de la lista.
 */
export function campo(scope: Page | Locator, etiqueta: string) {
  const opciones = { name: etiqueta, exact: true };
  return scope
    .getByRole("combobox", opciones)
    .or(scope.getByRole("spinbutton", opciones))
    .or(scope.getByRole("textbox", opciones));
}

/**
 * Entra a la app con una sesión ya iniciada (sin pasar por el formulario de login, que
 * tiene sus propias pruebas). La sesión se inyecta una sola vez por pestaña, así un
 * "Cerrar sesión" posterior se respeta aunque la página se recargue.
 */
export async function entrarComo(page: Page, api: ServicioSimulado, rol: Rol, ruta = INICIO[rol]) {
  const cuenta = api.cuentaDe(rol);
  const sesion = { token: `tok-${cuenta.id}`, rol, nombre: cuenta.nombre };
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("e2e:sesion")) {
      localStorage.setItem("igualab.sesion", JSON.stringify(s));
      sessionStorage.setItem("e2e:sesion", "1");
    }
  }, sesion);
  await page.goto(ruta);
}
