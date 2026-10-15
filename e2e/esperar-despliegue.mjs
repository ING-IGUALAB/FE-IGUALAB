// Espera a que la app desplegada responda antes de correr las pruebas e2e en Jenkins.
// Uso: E2E_BASE_URL=https://qa-igualab.ingsoftware.lat node e2e/esperar-despliegue.mjs
const url = process.env.E2E_BASE_URL;
const MAX_SEGUNDOS = 120;

if (!url) {
  console.error("Falta la variable E2E_BASE_URL.");
  process.exit(1);
}

const inicio = Date.now();
let ultimoError = "";
while (Date.now() - inicio < MAX_SEGUNDOS * 1000) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      console.log(`App disponible en ${url} (HTTP ${r.status}).`);
      process.exit(0);
    }
    ultimoError = `HTTP ${r.status}`;
  } catch (e) {
    ultimoError = e.cause?.code ?? e.message;
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

console.error(`La app no respondió en ${MAX_SEGUNDOS}s (${url}). Último error: ${ultimoError}`);
process.exit(1);
