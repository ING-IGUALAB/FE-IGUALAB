import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas e2e de Igualab (frontend).
 *
 * - Por defecto corren contra el build de producción servido con `vite preview`.
 * - Con E2E_BASE_URL corren contra una app YA DESPLEGADA (Jenkins, rama qa, después del
 *   deploy: https://qa-igualab.ingsoftware.lat).
 * - En ambos casos NO usan el backend real: cada prueba levanta un servicio simulado
 *   (ver e2e/support) que intercepta /env.js y las llamadas HTTP de la app. Así son
 *   repetibles y no ensucian datos de ningún entorno.
 * - En Jenkins (CI=true) guardan evidencia de TODAS las pruebas (video y captura), pasen o
 *   fallen, y generan el reporte HTML y el JUnit (e2e-results/junit.xml).
 */
const CI = !!process.env.CI;
const PUERTO = 4173;
const URL_DESPLEGADA = process.env.E2E_BASE_URL;

// Modos para mirar/grabar, según el script de npm que se ejecutó (funciona igual en Windows y Mac):
//   npm run e2e:ver     -> navegador visible, una prueba a la vez y en cámara lenta.
//   npm run e2e:grabar  -> lo mismo + un video de CADA prueba (en el reporte HTML).
const SCRIPT = process.env.npm_lifecycle_event ?? "";
const GRABAR = SCRIPT === "e2e:grabar";
const MIRAR = GRABAR || SCRIPT === "e2e:ver";
const EVIDENCIA_COMPLETA = CI || GRABAR;

function trabajadores() {
  if (CI) return 2;
  if (MIRAR) return 1;
  return undefined;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: trabajadores(),
  timeout: MIRAR ? 90_000 : 30_000,
  expect: { timeout: 7_000 },
  reporter: CI
    ? [["line"], ["junit", { outputFile: "e2e-results/junit.xml" }], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: URL_DESPLEGADA ?? `http://127.0.0.1:${PUERTO}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
    screenshot: EVIDENCIA_COMPLETA ? "on" : "only-on-failure",
    video: EVIDENCIA_COMPLETA ? { mode: "on", size: { width: 1280, height: 720 } } : "retain-on-failure",
    // Cámara lenta al mirar/grabar para que se vea qué hace cada paso.
    launchOptions: { slowMo: MIRAR ? 500 : 0 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Contra una URL desplegada no hace falta levantar un servidor local.
  webServer: URL_DESPLEGADA
    ? undefined
    : {
        command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PUERTO} --strictPort`,
        url: `http://127.0.0.1:${PUERTO}`,
        reuseExistingServer: !CI,
        timeout: 120_000,
      },
});
