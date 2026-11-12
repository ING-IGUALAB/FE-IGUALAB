import type { Page, Request, Route } from "@playwright/test";
import type {
  AdvertenciaAnalisis,
  ConsultaAsistente,
  ConversacionDetalle,
  MensajeGuardado,
  AnioDisponible,
  AnalisisGri,
  DocumentoResumen,
  EmpresaApi,
  EstadoGriApi,
  EstadoProgreso,
  EventoAuditoriaApi,
  FilaGri,
  HistorialGriItem,
  PuntajeEsg,
  ReporteEmision,
  ReporteResumen,
  Rol,
  SancionVista,
  SectorApi,
  TipoDocumentoApi,
  TipoEventoAuditoria,
  Usuario,
  ValidacionVista,
} from "../../src/types";

/**
 * Servicio simulado para las pruebas e2e.
 *
 * Reemplaza al backend real interceptando las llamadas HTTP de la app (page.route).
 * Respeta los contratos del Swagger de Igualab (rutas, cuerpos y errores
 * `{ error: { code, message } }`) y guarda estado en memoria, así una prueba puede
 * crear algo y verlo aparecer después. Cada prueba recibe una instancia nueva.
 */

/** Base de la API que se inyecta a la app vía /env.js (mismo origen: sin CORS). */
export const API_BASE = "/mock-api";

interface Respuesta {
  status: number;
  body?: unknown;
  /** Respuesta binaria (p. ej. un PDF). */
  archivo?: { contenido: Buffer; tipo: string; nombre?: string };
}
interface FalloForzado {
  metodo: string;
  ruta: string;
  respuesta: Respuesta;
}
interface Cuenta extends Usuario {
  password: string;
}
interface EstadoAnalisis {
  version: number;
  filas: FilaGri[];
  sanciones: SancionVista[];
  validacion: ValidacionVista | null;
  historial: HistorialGriItem[];
  /** Avisos del análisis que no son filas evaluables (calidad del documento, referencias desconocidas…). */
  advertencias?: AdvertenciaAnalisis[];
}
interface Llamada {
  metodo: string;
  ruta: string;
  query: URLSearchParams;
  cuerpo: unknown;
}
type Manejador = (m: RegExpMatchArray, req: Request, q: URLSearchParams) => Respuesta;

const AHORA = "2026-10-01T15:00:00Z";
const PUNTOS: Record<EstadoGriApi, number> = { OK: 100, BAJA_SUSTANCIA: 50, SUB_REPORTADO: 0 };

/** Estado del espacio empresa/año/tipo según el documento que lo reserva (sin documento, libre). */
function espacioDe(doc: DocumentoResumen | undefined): string {
  if (!doc) return "DISPONIBLE";
  if (doc.estado === "COMPLETADO") return "OCUPADO";
  if (doc.estado === "FALLIDO_LIMPIEZA_PENDIENTE") return "LIMPIEZA_PENDIENTE";
  return doc.estado === "PUBLICACION_PENDIENTE" ? "PUBLICACION_PENDIENTE" : "EN_PROCESO";
}

function error(status: number, code: string, message: string, details: unknown = null): Respuesta {
  return { status, body: { error: { code, message, details, request_id: "e2e" } } };
}
const ok = (body: unknown, status = 200): Respuesta => ({ status, body });

/** Credenciales de prueba (solo existen dentro del servicio simulado). */
export const CREDENCIALES = {
  superadmin: { correo: "super@igualab.com", password: "Super123!", nombre: "Oscar Baldeón" },
  administrador: { correo: "admin@igualab.com", password: "Admin123!", nombre: "Ana García" },
} as const;

export class ServicioSimulado {
  cuentas: Cuenta[] = [];
  empresas: EmpresaApi[] = [];
  documentos: DocumentoResumen[] = [];
  analisis = new Map<string, EstadoAnalisis>();
  llamadas: Llamada[] = [];
  reportes: ReporteResumen[] = [];
  eventos: EventoAuditoriaApi[] = [];
  /** Doble check: la próxima carga se pausa tras el análisis (202 CONFIRMACION_PENDIENTE). */
  pausarIngesta = false;
  /** Doble check: al confirmar, la publicación falla (502) y el documento queda pendiente de publicar. */
  fallarPublicacionAlConfirmar = false;
  /**
   * Avance de la barra de progreso: mientras la carga (o la confirmación) sigue sin responder, cada
   * consulta de la operación devuelve la siguiente etapa de esta lista. Úsese con `retrasar`.
   */
  etapasDuranteIngesta: string[] = [];
  etapasDuranteConfirmacion: string[] = [];
  private enCurso = new Map<string, { etapas: string[]; i: number }>();
  /** Chats guardados del asistente (más reciente al final) y claves ya usadas al guardar. */
  conversaciones: ConversacionDetalle[] = [];
  private clavesGuardado = new Map<string, { id: string; contenido: string }>();
  private rechazadas = new Set<string>();
  private fallos: FalloForzado[] = [];
  private demoras: { metodo: string; ruta: RegExp; ms: number }[] = [];
  private retenciones: { metodo: string; ruta: RegExp; espera: Promise<void> }[] = [];
  private sesionesExpiradas = false;
  private seq = 100;
  private readonly rutas: { metodo: string; patron: RegExp; fn: Manejador }[];

  constructor() {
    this.cargarDatosIniciales();
    this.rutas = this.definirRutas();
  }

  // ---------------------------------------------------------------- API para las pruebas
  async instalar(page: Page) {
    await page.route("**/env.js", (r) =>
      r.fulfill({ contentType: "application/javascript", body: `window.__ENV__ = { VITE_API_URL: "${API_BASE}" };` }),
    );
    await page.route(`**${API_BASE}/**`, (r) => this.atender(r));
  }

  cuentaDe(rol: Rol): Cuenta {
    return this.cuentas.find((c) => c.correo === CREDENCIALES[rol].correo)!;
  }

  /** A partir de ahora toda llamada autenticada responde 401 SESSION_EXPIRED. */
  expirarSesiones() {
    this.sesionesExpiradas = true;
  }

  /** Simula que OTRO usuario cambió el estado de una fila (provoca conflicto de versión). */
  cambiarEstadoPorFuera(empresaId: string, anio: number, identidad: string, estado: EstadoGriApi) {
    const fila = this.analisis.get(`${empresaId}:${anio}`)!.filas.find((f) => f.identidad === identidad)!;
    fila.estado = estado;
    fila.version_fila += 5;
  }

  /** La próxima llamada a `metodo ruta` responde este error (una sola vez). */
  fallarProxima(metodo: string, ruta: string, status: number, code: string, message: string) {
    this.fallos.push({ metodo, ruta, respuesta: error(status, code, message) });
  }

  /** Hace que las respuestas a `metodo ruta` tarden `ms` (para probar los indicadores de carga). */
  retrasar(metodo: string, ruta: RegExp, ms: number) {
    this.demoras.push({ metodo, ruta, ms });
  }

  /**
   * La próxima respuesta a `metodo ruta` se procesa pero no se entrega hasta llamar a la función
   * devuelta: así una prueba controla cuándo «termina» una petición sin depender del tiempo real.
   */
  retener(metodo: string, ruta: RegExp): () => void {
    let soltar: () => void = () => undefined;
    const espera = new Promise<void>((resolve) => {
      soltar = resolve;
    });
    this.retenciones.push({ metodo, ruta, espera });
    return () => soltar();
  }

  /** Agrega `n` documentos más (para probar la paginación con muchas páginas). */
  agregarDocumentos(n: number) {
    const base = this.documentos[0];
    for (let i = 0; i < n; i += 1) {
      this.documentos.push({ ...base, id: `d-extra-${i + 1}`, nombre_archivo: `extra-${i + 1}.md` });
    }
  }

  /** Agrega `n` eventos de auditoría más antiguos (para probar la paginación con muchas páginas). */
  agregarEventos(n: number) {
    for (let i = 0; i < n; i += 1) {
      const dia = String(1 + (i % 28)).padStart(2, "0");
      this.eventos.push({
        id: `ev-extra-${i + 1}`,
        usuario_id: i % 2 === 0 ? "u-super" : "u-admin",
        tipo_evento: "Inicio de sesión",
        detalle: `Evento histórico #${i + 1}`,
        fecha_hora_utc: `2026-09-${dia}T10:00:00Z`,
      });
    }
  }

  /** Deja validado el análisis de una empresa y año (requisito para generar su reporte). */
  validarAnalisisPorFuera(empresaId: string, anio: number) {
    const s = this.estadoDe(empresaId, anio);
    s.filas.forEach((f) => Object.assign(f, { estado: f.estado ?? "OK" }));
    s.validacion = {
      numero: (s.validacion?.numero ?? 0) + 1,
      vigente: true,
      motivos_no_vigente: [],
      validado_por: { id: "u-admin", nombre: "Ana García" },
      validado_en: AHORA,
      version_estados: s.version,
      huella_documentos: "huella-1",
      documentos_validados: 1,
      filas_validadas: s.filas.length,
      puntaje_suma: 0,
      puntaje_filas: s.filas.length,
    };
  }

  /** Cambia el análisis sin volver a validarlo: la última validación deja de estar vigente. */
  invalidarAnalisisPorFuera(empresaId: string, anio: number) {
    const s = this.estadoDe(empresaId, anio);
    if (s.validacion) s.validacion = { ...s.validacion, vigente: false };
  }

  /** Otra persona emite el reporte después de que se cargó la pantalla. */
  emitirReportePorFuera(empresaId: string, anio: number) {
    this.emitir(this.empresas.find((e) => e.id === empresaId)!, anio);
  }

  llamadasA(metodo: string, ruta: string | RegExp) {
    return this.llamadas.filter((l) => l.metodo === metodo && (typeof ruta === "string" ? l.ruta === ruta : ruta.test(l.ruta)));
  }

  // ---------------------------------------------------------------- despacho
  private async atender(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const ruta = url.pathname.slice(url.pathname.indexOf(API_BASE) + API_BASE.length);
    const metodo = req.method();
    this.llamadas.push({ metodo, ruta, query: url.searchParams, cuerpo: this.leerCuerpo(req) });

    let r: Respuesta = error(404, "NOT_FOUND", `Ruta no simulada: ${metodo} ${ruta}`);
    const publica = ruta.startsWith("/auth/") && ruta !== "/auth/mi-contrasena" && ruta !== "/auth/logout";
    const fallo = this.fallos.findIndex((f) => f.metodo === metodo && f.ruta === ruta);
    if (fallo >= 0) {
      r = this.fallos.splice(fallo, 1)[0].respuesta;
    } else if (this.sesionesExpiradas && !publica) {
      r = error(401, "SESSION_EXPIRED", "Tu sesión expiró.");
    } else {
      for (const { metodo: m, patron, fn } of this.rutas) {
        const match = ruta.match(patron);
        if (m === metodo && match) {
          r = fn(match, req, url.searchParams);
          break;
        }
      }
    }
    const demora = this.demoras.find((d) => d.metodo === metodo && d.ruta.test(ruta));
    if (demora) await new Promise((resolve) => setTimeout(resolve, demora.ms));
    const retenida = this.retenciones.findIndex((x) => x.metodo === metodo && x.ruta.test(ruta));
    if (retenida >= 0) await this.retenciones.splice(retenida, 1)[0].espera;
    // Al responder la carga o la confirmación, la operación deja de estar «en curso».
    const carga = /^\/documentos\/operaciones\/([^/]+)\/(ingesta|confirmar)$/.exec(ruta);
    if (carga) {
      this.enCurso.delete(carga[1]);
      if (carga[2] === "ingesta" && r.status >= 400) this.rechazadas.add(carga[1]);
    }
    if (r.status === 204) return route.fulfill({ status: 204 });
    if (r.archivo) {
      const headers: Record<string, string> = {};
      if (r.archivo.nombre) headers["content-disposition"] = `attachment; filename="${r.archivo.nombre}"`;
      return route.fulfill({ status: r.status, contentType: r.archivo.tipo, headers, body: r.archivo.contenido });
    }
    return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body ?? null) });
  }

  private leerCuerpo(req: Request): unknown {
    const tipo = req.headers()["content-type"] ?? "";
    if (tipo.includes("application/json")) return req.postDataJSON();
    const crudo = req.postData();
    const boundary = /boundary=([^;]+)/.exec(tipo)?.[1];
    if (!crudo || !boundary) return crudo ?? null;
    // multipart/form-data: extrae los campos de texto y el nombre del archivo.
    const campos: Record<string, string> = {};
    for (const parte of crudo.split(`--${boundary}`)) {
      const nombre = /name="([^"]+)"/.exec(parte)?.[1];
      if (!nombre) continue;
      const archivo = /filename="([^"]*)"/.exec(parte)?.[1];
      const valor = parte.split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, "");
      campos[nombre] = archivo ?? valor;
      if (archivo !== undefined) campos[`${nombre}__contenido`] = valor;
    }
    return campos;
  }

  private cuentaDeToken(req: Request): Cuenta | undefined {
    const token = (req.headers()["authorization"] ?? "").replace("Bearer ", "");
    return this.cuentas.find((c) => `tok-${c.id}` === token);
  }

  private publica(c: Cuenta): Usuario {
    const { password: _omitido, ...u } = c;
    return u;
  }

  private nuevoId(prefijo: string) {
    this.seq += 1;
    return `${prefijo}-${this.seq}`;
  }

  // ---------------------------------------------------------------- rutas
  private definirRutas(): { metodo: string; patron: RegExp; fn: Manejador }[] {
    const A = "^/analisis-gri/empresas/([^/]+)/anios/(\\d+)";
    return [
      // Autenticación
      { metodo: "POST", patron: /^\/auth\/login$/, fn: (_m, req) => this.login(req) },
      { metodo: "POST", patron: /^\/auth\/logout$/, fn: () => ({ status: 204 }) },
      {
        metodo: "POST",
        patron: /^\/auth\/recuperar-contrasena$/,
        fn: () => ok({ mensaje: "Si el correo está registrado, recibirás un enlace." }),
      },
      { metodo: "POST", patron: /^\/auth\/restablecer-contrasena$/, fn: (_m, req) => this.restablecer(req) },
      { metodo: "PATCH", patron: /^\/auth\/mi-contrasena$/, fn: (_m, req) => this.cambiarMiContrasena(req) },
      // Usuarios
      { metodo: "GET", patron: /^\/usuarios$/, fn: () => ok(this.cuentas.map((c) => this.publica(c))) },
      { metodo: "POST", patron: /^\/usuarios$/, fn: (_m, req) => this.crearUsuario(req) },
      { metodo: "POST", patron: /^\/usuarios\/transferir-superadmin$/, fn: (_m, req) => this.transferir(req) },
      { metodo: "PATCH", patron: /^\/usuarios\/([^/]+)\/(habilitar|deshabilitar)$/, fn: (m) => this.habilitar(m[1], m[2] === "habilitar") },
      // Empresas
      { metodo: "GET", patron: /^\/empresas$/, fn: (_m, _r, q) => ok(this.listarEmpresas(q)) },
      { metodo: "POST", patron: /^\/empresas$/, fn: (_m, req) => this.crearEmpresa(req) },
      { metodo: "PATCH", patron: /^\/empresas\/([^/]+)\/(activar|desactivar)$/, fn: (m) => this.activarEmpresa(m[1], m[2] === "activar") },
      { metodo: "GET", patron: /^\/empresas\/([^/]+)$/, fn: (m) => this.conEmpresa(m[1], (e) => ok(e)) },
      { metodo: "PATCH", patron: /^\/empresas\/([^/]+)$/, fn: (m, req) => this.editarEmpresa(m[1], req) },
      // Documentos / ingesta
      { metodo: "POST", patron: /^\/documentos\/operaciones$/, fn: () => this.crearOperacion() },
      { metodo: "POST", patron: /^\/documentos\/operaciones\/([^/]+)\/ingesta$/, fn: (m, req) => this.ingerir(m[1], req) },
      { metodo: "GET", patron: /^\/documentos\/operaciones\/([^/]+)$/, fn: (m) => this.consultarOperacion(m[1]) },
      { metodo: "POST", patron: /^\/documentos\/operaciones\/([^/]+)\/confirmar$/, fn: (m) => this.conOperacion(m[1], (d) => this.confirmarIngesta(d)) },
      { metodo: "POST", patron: /^\/documentos\/operaciones\/([^/]+)\/cancelar$/, fn: (m) => this.conOperacion(m[1], (d) => this.cancelarIngesta(d)) },
      { metodo: "POST", patron: /^\/documentos\/operaciones\/([^/]+)\/reintentar-publicacion$/, fn: (m) => this.conOperacion(m[1], (d) => this.reintentarPublicacion(d)) },
      { metodo: "GET", patron: /^\/documentos$/, fn: (_m, _r, q) => ok(this.listarDocumentos(q)) },
      { metodo: "GET", patron: /^\/documentos\/disponibilidad$/, fn: (_m, _r, q) => this.disponibilidadIngesta(q) },
      { metodo: "GET", patron: /^\/documentos\/([^/]+)$/, fn: (m) => this.detalleDocumento(m[1]) },
      { metodo: "POST", patron: /^\/documentos\/([^/]+)\/deshabilitar$/, fn: (m, req) => this.deshabilitarDocumento(m[1], req) },
      // Asistente de IA
      { metodo: "POST", patron: /^\/asistente\/consultas$/, fn: (_m, req) => this.consultarAsistente(req) },
      { metodo: "POST", patron: /^\/asistente\/conversaciones$/, fn: (_m, req) => this.guardarConversacion(req) },
      { metodo: "GET", patron: /^\/asistente\/conversaciones$/, fn: (_m, _r, q) => this.listarConversaciones(q) },
      { metodo: "GET", patron: /^\/asistente\/conversaciones\/([^/]+)$/, fn: (m) => this.conConversacion(m[1], (c) => ok(c)) },
      { metodo: "POST", patron: /^\/asistente\/conversaciones\/([^/]+)\/consultas$/, fn: (m, req) => this.conConversacion(m[1], (c) => this.continuarConversacion(c, req)) },
      // Reportes de prospección
      { metodo: "GET", patron: /^\/reportes$/, fn: () => ok(this.reportes) },
      { metodo: "GET", patron: /^\/reportes\/disponibilidad$/, fn: (_m, _r, q) => this.disponibilidad(q) },
      { metodo: "GET", patron: /^\/reportes\/vigente$/, fn: (_m, _r, q) => this.vigente(q) },
      { metodo: "GET", patron: /^\/reportes\/vigente\/archivo$/, fn: (_m, _r, q) => this.archivoVigente(q) },
      { metodo: "POST", patron: /^\/reportes$/, fn: (_m, req) => this.generarReporte(req) },
      { metodo: "POST", patron: /^\/reportes\/vista-previa$/, fn: (_m, req) => this.vistaPrevia(req) },
      { metodo: "GET", patron: /^\/reportes\/([^/]+)\/archivo$/, fn: (m) => this.archivoReporte(m[1]) },
      // Auditoría
      { metodo: "GET", patron: /^\/auditoria$/, fn: (_m, _r, q) => ok(this.listarEventos(q)) },
      // Análisis y validación GRI
      { metodo: "PUT", patron: new RegExp(`${A}/codigos/([^/]+)/estado$`), fn: (m, req) => this.asignarEstado(m, req) },
      { metodo: "GET", patron: new RegExp(`${A}/historial$`), fn: (m) => this.historial(m) },
      { metodo: "POST", patron: new RegExp(`${A}/validacion$`), fn: (m, req) => this.validar(m, req) },
      { metodo: "GET", patron: new RegExp(`${A}$`), fn: (m) => this.consultarAnalisis(m[1], Number(m[2])) },
    ];
  }

  // ---------------------------------------------------------------- autenticación
  private login(req: Request): Respuesta {
    const { correo, password } = req.postDataJSON() as { correo: string; password: string };
    const c = this.cuentas.find((x) => x.correo === correo);
    if (!c || c.password !== password) return error(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
    if (!c.habilitado) return error(403, "ACCOUNT_DISABLED", "La cuenta está deshabilitada.");
    return ok({ access_token: `tok-${c.id}`, token_type: "bearer", rol: c.rol, nombre: c.nombre });
  }

  private restablecer(req: Request): Respuesta {
    const { token } = req.postDataJSON() as { token: string };
    if (token !== "token-valido") return error(400, "INVALID_RESET_TOKEN", "El enlace de recuperación no es válido o expiró.");
    return ok({ mensaje: "Contraseña restablecida." });
  }

  private cambiarMiContrasena(req: Request): Respuesta {
    const c = this.cuentaDeToken(req);
    const { password_actual, password_nueva } = req.postDataJSON() as { password_actual: string; password_nueva: string };
    if (!c) return error(401, "INVALID_SESSION", "Sesión inválida.");
    if (c.password !== password_actual) return error(401, "CURRENT_PASSWORD_INVALID", "La contraseña actual no es correcta.");
    c.password = password_nueva;
    return ok({ mensaje: "Contraseña actualizada." });
  }

  // ---------------------------------------------------------------- usuarios
  private crearUsuario(req: Request): Respuesta {
    const { nombre, correo, password } = req.postDataJSON() as { nombre: string; correo: string; password: string };
    if (this.cuentas.some((c) => c.correo.toLowerCase() === correo.toLowerCase())) {
      return error(409, "EMAIL_ALREADY_REGISTERED", "Ya existe una cuenta con ese correo.");
    }
    const c: Cuenta = { id: this.nuevoId("u"), nombre, correo, rol: "administrador", habilitado: true, creado_en: AHORA, password };
    this.cuentas.push(c);
    return ok(this.publica(c), 201);
  }

  private habilitar(id: string, habilitar: boolean): Respuesta {
    const c = this.cuentas.find((x) => x.id === id);
    if (!c) return error(404, "USER_NOT_FOUND", "Usuario inexistente.");
    c.habilitado = habilitar;
    return ok(this.publica(c));
  }

  private transferir(req: Request): Respuesta {
    const origen = this.cuentaDeToken(req);
    const { cuenta_destino_id } = req.postDataJSON() as { cuenta_destino_id: string };
    const destino = this.cuentas.find((c) => c.id === cuenta_destino_id);
    if (!origen || !destino) return error(404, "USER_NOT_FOUND", "Usuario inexistente.");
    origen.rol = "administrador";
    destino.rol = "superadmin";
    return { status: 204 };
  }

  // ---------------------------------------------------------------- empresas
  private listarEmpresas(q: URLSearchParams) {
    return this.empresas.filter(
      (e) => (q.get("solo_activas") !== "true" || e.activa) && (!q.get("sector") || e.sector === q.get("sector")),
    );
  }

  private conEmpresa(id: string, fn: (e: EmpresaApi) => Respuesta): Respuesta {
    const e = this.empresas.find((x) => x.id === id);
    return e ? fn(e) : error(404, "COMPANY_NOT_FOUND", "Empresa inexistente.");
  }

  private crearEmpresa(req: Request): Respuesta {
    const { nombre, sector } = req.postDataJSON() as { nombre: string; sector: SectorApi };
    if (this.empresas.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase())) {
      return error(409, "COMPANY_ALREADY_EXISTS", "Ya existe una empresa con ese nombre.");
    }
    const e: EmpresaApi = { id: this.nuevoId("e"), nombre, sector, activa: true, creada_en: AHORA };
    this.empresas.push(e);
    return ok(e, 201);
  }

  private editarEmpresa(id: string, req: Request): Respuesta {
    const cambios = req.postDataJSON() as Partial<EmpresaApi>;
    return this.conEmpresa(id, (e) => ok(Object.assign(e, cambios)));
  }

  private activarEmpresa(id: string, activa: boolean): Respuesta {
    return this.conEmpresa(id, (e) => ok(Object.assign(e, { activa })));
  }

  // ---------------------------------------------------------------- documentos / ingesta
  private crearOperacion(): Respuesta {
    const id = this.nuevoId("op");
    return ok(
      {
        operacion_id: id,
        estado: "CREADA",
        creada_en: AHORA,
        ingesta_url: `/documentos/operaciones/${id}/ingesta`,
        progreso_url: `/documentos/operaciones/${id}`,
      },
      201,
    );
  }

  private ingerir(operacionId: string, req: Request): Respuesta {
    const f = this.leerCuerpo(req) as Record<string, string>;
    const empresa = this.empresas.find((e) => e.id === f.empresa_id);
    if (!empresa) return error(404, "COMPANY_NOT_FOUND", "Empresa inexistente.");
    const doc: DocumentoResumen = {
      id: this.nuevoId("d"),
      operacion_id: operacionId,
      empresa_id: empresa.id,
      empresa_nombre: empresa.nombre,
      sector: empresa.sector,
      anio: Number(f.anio),
      tipo: f.tipo_documento as TipoDocumentoApi,
      nombre_archivo: f.archivo,
      sha256: "abc123",
      tamano_bytes: (f.archivo__contenido ?? "").length,
      estado: this.pausarIngesta ? "CONFIRMACION_PENDIENTE" : "COMPLETADO",
      resultado_analisis: "CON_HALLAZGOS",
      disponible_para_rag: !this.pausarIngesta,
      fragmentos_total: 4,
      cantidad_advertencias: 0,
      cargado_por: "u-super",
      creado_en: "2026-10-14T16:00:00Z",
      completado_en: this.pausarIngesta ? null : "2026-10-14T16:00:05Z",
    };
    this.documentos.unshift(doc);
    if (this.etapasDuranteIngesta.length > 0) this.enCurso.set(operacionId, { etapas: [...this.etapasDuranteIngesta], i: 0 });
    // Doble check: el análisis terminó y la carga espera que alguien decida (202, no es un error).
    if (this.pausarIngesta) return ok(this.vistaOperacion(doc), 202);
    return ok(
      {
        operacion_id: operacionId,
        estado: "COMPLETADO",
        terminal: true,
        exitosa: true,
        etapa: "COMPLETADO",
        documento_id: doc.id,
        fragmentos_procesados: 4,
        fragmentos_total: 4,
        advertencias: [],
        resultado_analisis: "CON_HALLAZGOS",
        publicacion_reintentable: false,
        error: null,
        creada_en: AHORA,
        actualizada_en: AHORA,
        motivos: [],
        fragmentos: 4,
      },
      201,
    );
  }

  /** Progreso de una operación: en curso según el guion de etapas, o según su documento. */
  private consultarOperacion(operacionId: string): Respuesta {
    const curso = this.enCurso.get(operacionId);
    const doc = this.documentos.find((d) => d.operacion_id === operacionId);
    if (curso && doc) {
      const etapa = curso.etapas[Math.min(curso.i, curso.etapas.length - 1)];
      curso.i += 1;
      const indexando = etapa === "INDEXANDO";
      return ok({
        ...this.vistaOperacion(doc),
        estado: "EN_PROCESO",
        terminal: false,
        exitosa: false,
        etapa,
        confirmacion_pendiente: false,
        resumen_confirmacion: null,
        fragmentos_procesados: indexando ? 2 : 0,
        fragmentos_total: indexando ? 4 : null,
      });
    }
    if (doc) return ok(this.vistaOperacion(doc));
    // Sin documento: todavía no se reservó o la carga se rechazó antes de reservarlo.
    const rechazada = this.rechazadas.has(operacionId);
    return ok({
      operacion_id: operacionId,
      estado: rechazada ? "RECHAZADA" : "VALIDANDO",
      terminal: rechazada,
      exitosa: false,
      etapa: null,
      documento_id: null,
      fragmentos_procesados: 0,
      fragmentos_total: null,
      advertencias: [],
      resultado_analisis: null,
      publicacion_reintentable: false,
      confirmacion_pendiente: false,
      resumen_confirmacion: null,
      error: rechazada ? { code: "DOCUMENT_REJECTED", message: "La carga fue rechazada." } : null,
      creada_en: AHORA,
      actualizada_en: AHORA,
    });
  }

  private conOperacion(operacionId: string, fn: (d: DocumentoResumen) => Respuesta): Respuesta {
    const doc = this.documentos.find((d) => d.operacion_id === operacionId);
    return doc ? fn(doc) : error(404, "OPERATION_NOT_FOUND", "Operación inexistente.");
  }

  /** Vista de la operación según el estado de su documento (como `GET /documentos/operaciones/{id}`). */
  private vistaOperacion(doc: DocumentoResumen, error: { code: string; message: string } | null = null) {
    const pausada = doc.estado === "CONFIRMACION_PENDIENTE";
    const completado = doc.estado === "COMPLETADO";
    const fallido = doc.estado === "FALLIDO" || doc.estado === "FALLIDO_LIMPIEZA_PENDIENTE";
    return {
      operacion_id: doc.operacion_id,
      estado: doc.estado,
      terminal: completado || fallido,
      exitosa: completado,
      etapa: doc.estado,
      documento_id: doc.id,
      fragmentos_procesados: completado ? 4 : 0,
      fragmentos_total: 4,
      advertencias: [],
      resultado_analisis: completado ? doc.resultado_analisis : null,
      publicacion_reintentable: doc.estado === "PUBLICACION_PENDIENTE",
      confirmacion_pendiente: pausada,
      resumen_confirmacion: pausada
        ? {
            resultado: "CON_HALLAZGOS",
            referencias_gri: 3,
            sanciones: 1,
            motivos: ["referencias_gri_catalogadas", "sanciones_economicas"],
            advertencias: [{ codigo: "GRI_EDICION_AMBIGUA", mensaje: "Estándar conocido con varias ediciones y sin edición en el texto." }],
            mensaje: "El análisis detectó 3 grupo(s) GRI y 1 mención(es) de sanciones. ¿Desea continuar con la ingesta o cancelarla?",
          }
        : null,
      error: error ?? (fallido ? { code: "UNEXPECTED_ERROR", message: "La ingesta no se completó." } : null),
      creada_en: AHORA,
      actualizada_en: AHORA,
    };
  }

  private noPendiente(): Respuesta {
    return error(409, "CONFIRMATION_NOT_PENDING", "La operación no está esperando una confirmación.");
  }

  private confirmarIngesta(doc: DocumentoResumen): Respuesta {
    if (doc.estado !== "CONFIRMACION_PENDIENTE") return this.noPendiente();
    if (this.fallarPublicacionAlConfirmar) {
      doc.estado = "PUBLICACION_PENDIENTE";
      return error(502, "VECTOR_PUBLICATION_PENDING", "El documento se completó, pero la publicación quedó pendiente.");
    }
    doc.estado = "COMPLETADO";
    doc.disponible_para_rag = true;
    doc.completado_en = "2026-10-14T16:01:00Z";
    if (this.etapasDuranteConfirmacion.length > 0) {
      this.enCurso.set(doc.operacion_id!, { etapas: [...this.etapasDuranteConfirmacion], i: 0 });
    }
    return ok({ ...this.vistaOperacion(doc), motivos: [], fragmentos: 4 }, 201);
  }

  private cancelarIngesta(doc: DocumentoResumen): Respuesta {
    if (doc.estado !== "CONFIRMACION_PENDIENTE") return this.noPendiente();
    doc.estado = "FALLIDO";
    return ok(this.vistaOperacion(doc, { code: "CONFIRMACION_RECHAZADA", message: "La carga fue cancelada." }));
  }

  private reintentarPublicacion(doc: DocumentoResumen): Respuesta {
    if (doc.estado !== "PUBLICACION_PENDIENTE") return error(409, "DOCUMENT_STATE_CONFLICT", "No hay publicación pendiente.");
    doc.estado = "COMPLETADO";
    return ok(this.vistaOperacion(doc));
  }

  /** Un documento de cada tipo por empresa y año: los tipos ya cargados quedan OCUPADO. */
  private disponibilidadIngesta(q: URLSearchParams): Respuesta {
    const empresa = this.empresas.find((e) => e.id === q.get("empresa_id"));
    if (!empresa) return error(404, "COMPANY_NOT_FOUND", "Empresa inexistente.");
    const anio = Number(q.get("anio"));
    const tipos: TipoDocumentoApi[] = ["MEMORIA_ANUAL", "REPORTE_SOSTENIBILIDAD_GRI"];
    return ok({
      ambiente: "dev",
      empresa_id: empresa.id,
      empresa_nombre: empresa.nombre,
      empresa_activa: empresa.activa,
      anio,
      tipos: tipos.map((tipo) => {
        const doc = this.documentos.find(
          (d) => d.empresa_id === empresa.id && d.anio === anio && d.tipo === tipo && d.estado !== "FALLIDO" && !d.deshabilitado,
        );
        return {
          tipo,
          estado: espacioDe(doc),
          cargable: !doc && empresa.activa,
          documento_id: doc?.id ?? null,
          nombre_archivo: doc?.nombre_archivo ?? null,
          reservado_en: doc ? doc.creado_en : null,
        };
      }),
    });
  }

  private listarDocumentos(q: URLSearchParams) {
    const xs = this.documentos.filter(
      (d) =>
        (!q.get("empresa_id") || d.empresa_id === q.get("empresa_id")) &&
        (!q.get("anio") || d.anio === Number(q.get("anio"))) &&
        (!q.get("tipo") || d.tipo === q.get("tipo")) &&
        (!q.get("estado") || d.estado === (q.get("estado") as EstadoProgreso)),
    );
    const pagina = Number(q.get("pagina") ?? 1);
    const tamano = Number(q.get("tamano") ?? 20);
    return {
      items: xs.slice((pagina - 1) * tamano, pagina * tamano),
      total: xs.length,
      pagina,
      tamano,
      paginas: Math.max(1, Math.ceil(xs.length / tamano)),
    };
  }

  /** Como el backend: solo un documento completado; idempotente; libera su lugar; no se revierte. */
  private deshabilitarDocumento(id: string, req: Request): Respuesta {
    const d = this.documentos.find((x) => x.id === id);
    if (!d) return error(404, "DOCUMENT_NOT_FOUND", "Documento inexistente.");
    const { motivo } = req.postDataJSON() as { motivo?: string };
    if (!motivo?.trim()) return error(422, "REQUEST_VALIDATION_ERROR", "El motivo es obligatorio.");
    if (d.estado !== "COMPLETADO") return error(409, "DOCUMENT_NOT_DISABLEABLE", "Solo se puede deshabilitar un documento completado.");
    const ya = !!d.deshabilitado;
    if (!ya) {
      Object.assign(d, { deshabilitado: true, deshabilitado_en: "2026-11-11T15:00:00Z", deshabilitado_por: "u-super", motivo_deshabilitacion: motivo.trim(), disponible_para_rag: false });
    }
    return ok({
      documento_id: d.id,
      empresa_id: d.empresa_id,
      anio: d.anio,
      tipo: d.tipo,
      estado: d.estado,
      deshabilitado: true,
      deshabilitado_en: d.deshabilitado_en,
      deshabilitado_por: d.deshabilitado_por,
      motivo_deshabilitacion: d.motivo_deshabilitacion,
      ya_estaba_deshabilitado: ya,
    });
  }

  private detalleDocumento(id: string): Respuesta {
    const d = this.documentos.find((x) => x.id === id);
    if (!d) return error(404, "DOCUMENT_NOT_FOUND", "Documento inexistente.");
    return ok({
      ...d,
      etapa: "COMPLETADO",
      fragmentos_procesados: d.fragmentos_total ?? 0,
      advertencias: [],
      publicacion_reintentable: false,
      error: null,
      analisis: null,
      actualizado_en: d.creado_en,
    });
  }

  // ---------------------------------------------------------------- análisis GRI
  private estadoDe(empresaId: string, anio: number): EstadoAnalisis {
    const clave = `${empresaId}:${anio}`;
    if (!this.analisis.has(clave)) {
      this.analisis.set(clave, { version: 1, filas: [], sanciones: [], validacion: null, historial: [] });
    }
    return this.analisis.get(clave)!;
  }

  private puntaje(s: EstadoAnalisis): PuntajeEsg {
    const con = s.filas.filter((f) => f.estado);
    const base = { decimales_presentacion: 1, filas_evaluables: s.filas.length, motivo: null, mensaje: null };
    if (s.filas.length === 0) {
      return { ...base, estado: "NO_DISPONIBLE", definitivo: false, valor: null, valor_presentacion: null, suma_puntos: null, filas_contadas: 0, filas_sin_estado: 0 };
    }
    if (con.length < s.filas.length) {
      return { ...base, estado: "PENDIENTE_ESTADOS", definitivo: false, valor: null, valor_presentacion: null, suma_puntos: null, filas_contadas: con.length, filas_sin_estado: s.filas.length - con.length };
    }
    const suma = con.reduce((a, f) => a + PUNTOS[f.estado as EstadoGriApi], 0);
    const valor = suma / con.length;
    const vigente = !!s.validacion?.vigente;
    return {
      ...base,
      estado: vigente ? "VALIDADO" : "CALCULADO_SIN_VALIDAR",
      definitivo: vigente,
      valor,
      valor_presentacion: Math.round(valor * 10) / 10,
      suma_puntos: suma,
      filas_contadas: con.length,
      filas_sin_estado: 0,
    };
  }

  private consultarAnalisis(empresaId: string, anio: number): Respuesta {
    const empresa = this.empresas.find((e) => e.id === empresaId);
    if (!empresa) return error(404, "COMPANY_NOT_FOUND", "Empresa inexistente.");
    const s = this.estadoDe(empresaId, anio);
    const sinEstado = s.filas.filter((f) => !f.estado);
    let estado_flujo: AnalisisGri["estado_flujo"] = "DOCUMENTACION_INSUFICIENTE";
    if (s.filas.length > 0) {
      if (sinEstado.length > 0) estado_flujo = "PENDIENTE_ESTADOS";
      else estado_flujo = s.validacion?.vigente ? "VALIDADO" : "LISTO_PARA_VALIDAR";
    }
    const docs = this.documentos.filter((d) => d.empresa_id === empresaId && d.anio === anio && s.filas.length > 0);
    const analisis: AnalisisGri = {
      ambiente: "e2e",
      empresa: { id: empresa.id, nombre: empresa.nombre, sector: empresa.sector, activa: empresa.activa },
      anio,
      version: s.version,
      huella_documentos: "huella-1",
      estado_flujo,
      habilita_reporte: estado_flujo === "VALIDADO",
      version_catalogo: ["2024.1"],
      documentos: docs.map((d) => ({
        documento_id: d.id,
        nombre_archivo: d.nombre_archivo,
        tipo: d.tipo,
        resultado_analisis: "CON_HALLAZGOS",
        observado: false,
        completado_en: d.completado_en ?? AHORA,
        version_catalogo: "2024.1",
        total_referencias_gri: 4,
        total_sanciones: s.sanciones.length,
      })),
      filas: s.filas,
      advertencias: s.advertencias ?? [],
      sanciones: s.sanciones,
      resumen_sanciones: {
        total: s.sanciones.length,
        cuantificadas: s.sanciones.filter((x) => x.cuantificada).length,
        no_cuantificadas: s.sanciones.filter((x) => !x.cuantificada).length,
        por_unidad: {},
      },
      puntaje: this.puntaje(s),
      pendientes: sinEstado.length
        ? [{ codigo: "FILAS_SIN_ESTADO", mensaje: `Faltan estados en ${sinEstado.length} código(s) GRI.`, cantidad: sinEstado.length }]
        : [],
      validacion: s.validacion,
    };
    return ok(analisis);
  }

  private asignarEstado(m: RegExpMatchArray, req: Request): Respuesta {
    const s = this.estadoDe(m[1], Number(m[2]));
    const identidad = decodeURIComponent(m[3]);
    const { estado, version_fila_esperada } = req.postDataJSON() as { estado: EstadoGriApi; version_fila_esperada: number };
    const fila = s.filas.find((f) => f.identidad === identidad);
    if (!fila) return error(404, "GRI_IDENTITY_NOT_FOUND", "Identidad GRI inexistente en el análisis.");
    if (fila.version_fila !== version_fila_esperada) {
      return error(409, "ANALYSIS_ROW_VERSION_CONFLICT", "La fila cambió desde que se consultó.");
    }
    const usuario = this.cuentaDeToken(req) ?? this.cuentaDe("administrador");
    const anterior = fila.estado ?? null;
    const invalidada = !!s.validacion?.vigente;
    Object.assign(fila, {
      estado,
      version_fila: fila.version_fila + 1,
      asignado_por: { id: usuario.id, nombre: usuario.nombre },
      asignado_en: "2026-10-14T16:10:00Z",
    });
    s.version += 1;
    if (invalidada && s.validacion) s.validacion = { ...s.validacion, vigente: false, motivos_no_vigente: ["ESTADOS_CAMBIARON"] };
    s.historial.unshift({
      id: this.nuevoId("h"),
      identidad,
      codigo: fila.codigo,
      edicion: fila.edicion,
      identidad_tipo: fila.identidad_tipo,
      estado_anterior: anterior,
      estado_nuevo: estado,
      usuario: { id: usuario.id, nombre: usuario.nombre },
      cambiado_en: "2026-10-14T16:10:00Z",
      version_analisis: s.version,
    });
    return ok({
      identidad,
      cambio: true,
      estado_anterior: anterior,
      estado,
      version_fila: fila.version_fila,
      version_analisis: s.version,
      asignado_por: { id: usuario.id, nombre: usuario.nombre },
      asignado_en: "2026-10-14T16:10:00Z",
      validacion_previa_invalidada: invalidada,
    });
  }

  private historial(m: RegExpMatchArray): Respuesta {
    const s = this.estadoDe(m[1], Number(m[2]));
    return ok({ items: s.historial, total: s.historial.length, pagina: 1, tamano: 10 });
  }

  private validar(m: RegExpMatchArray, req: Request): Respuesta {
    const s = this.estadoDe(m[1], Number(m[2]));
    const { version } = req.postDataJSON() as { version: number };
    if (version !== s.version) return error(409, "ANALYSIS_VERSION_CONFLICT", "El análisis cambió; vuelve a consultarlo.");
    if (s.filas.some((f) => !f.estado)) return error(409, "ANALYSIS_PENDING_STATES", "Faltan estados por asignar.");
    const usuario = this.cuentaDeToken(req) ?? this.cuentaDe("administrador");
    s.validacion = {
      numero: (s.validacion?.numero ?? 0) + 1,
      vigente: true,
      motivos_no_vigente: [],
      validado_por: { id: usuario.id, nombre: usuario.nombre },
      validado_en: "2026-10-14T16:20:00Z",
      version_estados: s.version,
      huella_documentos: "huella-1",
      documentos_validados: 1,
      filas_validadas: s.filas.length,
      puntaje_suma: 0,
      puntaje_filas: s.filas.length,
    };
    return ok({ validacion: s.validacion, puntaje: this.puntaje(s), estado_flujo: "VALIDADO", habilita_reporte: true }, 201);
  }

  // ---------------------------------------------------------------- asistente de IA
  private consultarAsistente(req: Request): Respuesta {
    return this.responderAsistente(req.postDataJSON() as { pregunta?: string; sector?: SectorApi; empresa_id?: string; anio?: number });
  }

  // ---------------------------------------------------------------- conversaciones guardadas
  private contextoDe(empresa: EmpresaApi, anio: number) {
    return { empresa_id: empresa.id, empresa_nombre: empresa.nombre, empresa_activa: empresa.activa, sector: empresa.sector, anio };
  }

  private mensajeGuardado(orden: number, m: { rol: "usuario"; contenido: string } | { rol: "asistente"; respuesta: ConsultaAsistente }, procedencia: string): MensajeGuardado {
    return {
      id: this.nuevoId("msg"),
      orden,
      rol: m.rol,
      contenido: m.rol === "usuario" ? m.contenido : m.respuesta.respuesta || "Sin evidencia suficiente.",
      respuesta: m.rol === "asistente" ? m.respuesta : null,
      procedencia: procedencia as MensajeGuardado["procedencia"],
      creado_en: AHORA,
    };
  }

  /** Guarda un chat tal como lo aporta el cliente; la misma clave con el mismo contenido no duplica. */
  guardarConversacion(req: Request | { postDataJSON: () => unknown }): Respuesta {
    const b = req.postDataJSON() as {
      clave_idempotencia: string;
      empresa_id: string;
      sector: SectorApi;
      anio: number;
      mensajes: ({ rol: "usuario"; contenido: string } | { rol: "asistente"; respuesta: ConsultaAsistente })[];
    };
    const empresa = this.empresas.find((e) => e.id === b.empresa_id);
    if (!empresa) return error(404, "COMPANY_NOT_FOUND", "La empresa no existe.");
    if (b.mensajes.length < 2 || b.mensajes.length > 40) return error(422, "REQUEST_VALIDATION_ERROR", "La conversación debe tener entre 2 y 40 mensajes.");
    const contenido = JSON.stringify(b.mensajes);
    const previa = this.clavesGuardado.get(b.clave_idempotencia);
    if (previa) {
      if (previa.contenido !== contenido) return error(409, "CONVERSATION_IDEMPOTENCY_CONFLICT", "Esa clave ya se usó con otro contenido.");
      return ok({ ...this.conversaciones.find((c) => c.id === previa.id), reutilizada: true });
    }
    const primera = b.mensajes[0];
    const c: ConversacionDetalle = {
      id: this.nuevoId("conv"),
      titulo: (primera.rol === "usuario" ? primera.contenido : "").slice(0, 80),
      contexto: this.contextoDe(empresa, b.anio),
      total_mensajes: b.mensajes.length,
      creada_en: AHORA,
      actualizada_en: `2026-11-11T16:${String(this.conversaciones.length).padStart(2, "0")}:00Z`,
      mensajes: b.mensajes.map((m, i) => this.mensajeGuardado(i + 1, m, "APORTADO_POR_CLIENTE")),
    };
    this.conversaciones.push(c);
    this.clavesGuardado.set(b.clave_idempotencia, { id: c.id, contenido });
    return ok({ ...c, reutilizada: false }, 201);
  }

  private listarConversaciones(q: URLSearchParams) {
    const pagina = Number(q.get("pagina") ?? 1);
    const tamano = Number(q.get("tamano") ?? 20);
    const todas = [...this.conversaciones]
      .sort((a, b) => b.actualizada_en.localeCompare(a.actualizada_en))
      .map(({ mensajes: _m, ...resumen }) => ({ ...resumen, contexto: this.contextoActual(resumen.contexto) }));
    return ok({ items: todas.slice((pagina - 1) * tamano, pagina * tamano), pagina, tamano, total: todas.length });
  }

  /** El nombre y el estado de la empresa son los actuales, no los del momento de guardar. */
  private contextoActual(ctx: ConversacionDetalle["contexto"]) {
    const e = this.empresas.find((x) => x.id === ctx.empresa_id);
    return e ? { ...ctx, empresa_nombre: e.nombre, empresa_activa: e.activa } : ctx;
  }

  private conConversacion(id: string, fn: (c: ConversacionDetalle) => Respuesta): Respuesta {
    const c = this.conversaciones.find((x) => x.id === id);
    return c ? fn({ ...c, contexto: this.contextoActual(c.contexto) }) : error(404, "CONVERSATION_NOT_FOUND", "La conversación no existe.");
  }

  private continuarConversacion(c: ConversacionDetalle, req: Request): Respuesta {
    const { clave_idempotencia, pregunta } = req.postDataJSON() as { clave_idempotencia: string; pregunta: string };
    if (!c.contexto.empresa_activa) return error(409, "COMPANY_INACTIVE", "La empresa está desactivada.");
    if (c.total_mensajes + 2 > 40) return error(409, "CONVERSATION_MESSAGE_LIMIT_REACHED", "Este chat llegó a su límite de 20 preguntas. Empieza uno nuevo.");
    const r = this.responderAsistente({ pregunta, sector: c.contexto.sector, empresa_id: c.contexto.empresa_id, anio: c.contexto.anio });
    if (r.status !== 200) return r;
    const guardada = this.conversaciones.find((x) => x.id === c.id)!;
    const preguntaG = this.mensajeGuardado(guardada.mensajes.length + 1, { rol: "usuario", contenido: pregunta }, "ENVIADO_POR_USUARIO");
    const respuestaG = this.mensajeGuardado(guardada.mensajes.length + 2, { rol: "asistente", respuesta: r.body as ConsultaAsistente }, "GENERADO_POR_SERVIDOR");
    guardada.mensajes.push(preguntaG, respuestaG);
    guardada.total_mensajes = guardada.mensajes.length;
    guardada.actualizada_en = "2026-11-11T17:00:00Z";
    return ok(
      {
        conversacion_id: c.id,
        clave_idempotencia,
        pregunta: preguntaG,
        respuesta: respuestaG,
        total_mensajes: guardada.total_mensajes,
        actualizada_en: guardada.actualizada_en,
        reutilizado: false,
      },
      201,
    );
  }

  private responderAsistente(cuerpo: { pregunta?: string; sector?: SectorApi; empresa_id?: string; anio?: number }): Respuesta {
    // Igual que el backend: sector, empresa y año son obligatorios (422 "Field required").
    const faltan = (["pregunta", "sector", "empresa_id", "anio"] as const).filter((k) => cuerpo[k] === undefined || cuerpo[k] === null);
    if (faltan.length > 0) {
      return {
        status: 422,
        body: {
          error: {
            code: "REQUEST_VALIDATION_ERROR",
            message: "Datos inválidos.",
            details: faltan.map((k) => ({ loc: ["body", k], msg: "Field required", type: "missing" })),
            request_id: "e2e",
          },
        },
      };
    }
    const empresa = this.empresas.find((e) => e.id === cuerpo.empresa_id);
    if (!empresa) return error(404, "COMPANY_NOT_FOUND", "La empresa no existe.");
    if (empresa.sector !== cuerpo.sector) return error(400, "COMPANY_SECTOR_MISMATCH", "La empresa no pertenece al sector indicado.");
    const doc = this.documentos.find((d) => d.empresa_id === empresa.id && d.anio === cuerpo.anio);
    const pregunta = cuerpo.pregunta ?? "";
    // Pregunta de solo estado de un código GRI: se responde desde Análisis GRI, sin buscar en los documentos.
    const codigo = /estado[^?]*GRI\s*(\d+)/i.exec(pregunta)?.[1];
    if (codigo) {
      const texto = [
        `Estado registrado en Análisis GRI (${empresa.nombre}, ${cuerpo.anio}):`,
        `- GRI ${codigo} (2016): OK. No cuenta con validación vigente: el análisis aún no se ha validado.`,
        "El estado lo asigna una persona en Análisis GRI; detectar un código en el documento no demuestra cumplimiento ni una brecha.",
      ].join("\n");
      return ok({
        respuesta: texto,
        afirmaciones: [],
        citas: [],
        sin_evidencia: false,
        motivo: null,
        mensaje: null,
        afirmaciones_descartadas: 0,
        interpretacion: null,
        interpretacion_descartada: false,
        estado_registrado: {
          fuente: "ANALISIS_GRI",
          texto,
          codigos_solicitados: [`GRI ${codigo}`],
          filas: [{ identidad: `${codigo}:2016`, codigo, edicion: "2016", estandar: `GRI ${codigo} (2016)`, estado: "OK", estado_etiqueta: "OK" }],
          validacion_vigente: false,
          validacion: null,
        },
        busqueda_documental: "NO_REALIZADA",
      });
    }
    if (/f[uú]tbol/i.test(pregunta)) {
      return ok({
        respuesta: "",
        afirmaciones: [],
        citas: [],
        sin_evidencia: true,
        motivo: "FUERA_DE_DOMINIO",
        mensaje: null,
        afirmaciones_descartadas: 0,
      });
    }
    if (!doc) {
      return ok({ respuesta: "", afirmaciones: [], citas: [], sin_evidencia: true, motivo: "SIN_FRAGMENTOS", mensaje: null, afirmaciones_descartadas: 0 });
    }
    const cita = "OEFA impuso una multa de 59.078 UIT por incumplimiento ambiental.";
    return ok({
      respuesta: `Se identifica una multa del OEFA de 59.078 UIT [1].`,
      afirmaciones: [{ texto: "Se identifica una multa del OEFA de 59.078 UIT por incumplimiento ambiental.", referencias: [1], cita_textual: cita }],
      citas: [
        {
          referencia: 1,
          documento_id: doc.id,
          documento_nombre: doc.nombre_archivo,
          empresa_id: empresa.id,
          empresa_nombre: empresa.nombre,
          anio: doc.anio,
          seccion: "Memoria Anual > Contingencias",
          extracto: `En el ejercicio, ${cita}`,
        },
      ],
      sin_evidencia: false,
      motivo: null,
      mensaje: null,
      afirmaciones_descartadas: 1,
      // Si la pregunta pide analizar o proyectar, el asistente agrega su interpretación (aparte de los hechos citados).
      interpretacion: /expectativ|analiz|interpret|conclu|implic|evalú|riesgo/i.test(pregunta)
        ? "La multa sugiere un riesgo regulatorio ambiental relevante; podría indicar que la empresa necesita reforzar sus controles. La evidencia es parcial: solo consta una sanción."
        : null,
      interpretacion_descartada: false,
      estado_registrado: null,
      busqueda_documental: "REALIZADA",
    });
  }

  // ---------------------------------------------------------------- reportes
  private validarReporte(req: Request): { empresa?: EmpresaApi; anio: number; error?: Respuesta } {
    const { empresa_id, anio } = req.postDataJSON() as { empresa_id: string; anio: number };
    const empresa = this.empresas.find((e) => e.id === empresa_id);
    if (!empresa) return { anio, error: error(404, "COMPANY_NOT_FOUND", "Empresa inexistente.") };
    if (!this.analisis.get(`${empresa_id}:${anio}`)?.validacion?.vigente) {
      return { anio, error: error(409, "ANALYSIS_NOT_VALIDATED", "El análisis GRI de esta empresa y año no está validado.") };
    }
    return { empresa, anio };
  }

  private vistaPrevia(req: Request): Respuesta {
    const v = this.validarReporte(req);
    if (v.error) return v.error;
    return { status: 200, archivo: { contenido: pdfMinimo(`Vista previa - ${v.empresa!.nombre} ${v.anio}`), tipo: "application/pdf" } };
  }

  private generarReporte(req: Request): Respuesta {
    const v = this.validarReporte(req);
    if (v.error) return v.error;
    const emision = this.emitir(v.empresa!, v.anio);
    return ok(emision, emision.reutilizado ? 200 : 201);
  }

  /** Una versión por validación: si esa validación ya tiene la suya, se reutiliza. */
  private emitir(empresa: EmpresaApi, anio: number): ReporteEmision {
    const validacion = this.estadoDe(empresa.id, anio).validacion!;
    const previo = this.reportes.find((r) => r.empresa_id === empresa.id && r.anio === anio && r.validacion_numero === validacion.numero);
    if (previo) return { ...previo, reutilizado: true };
    const anteriores = this.reportes.filter((r) => r.empresa_id === empresa.id && r.anio === anio);
    anteriores.forEach((r) => Object.assign(r, { es_ultima_version: false }));
    const version = anteriores.reduce((max, r) => Math.max(max, r.version), 0) + 1;
    const reporte: ReporteResumen = {
      id: this.nuevoId("r"),
      empresa_id: empresa.id,
      empresa_nombre: empresa.nombre,
      anio,
      version,
      es_ultima_version: true,
      validacion_id: `val-${validacion.numero}`,
      validacion_numero: validacion.numero,
      generado_por: "u-admin",
      generado_por_nombre: "Ana García",
      sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      creado_en: new Date(Date.parse("2026-10-16T15:00:00Z") + this.seq * 60_000).toISOString(),
    };
    this.reportes.unshift(reporte);
    return { ...reporte, reutilizado: false };
  }

  private ultimaEmision(empresaId: string, anio: number): ReporteResumen | undefined {
    return this.reportes.find((r) => r.empresa_id === empresaId && r.anio === anio && r.es_ultima_version);
  }

  /** Situación de un año, con las mismas reglas que describe el contrato del backend. */
  private anioDisponible(empresaId: string, anio: number): AnioDisponible {
    const s = this.estadoDe(empresaId, anio);
    const ultima = this.ultimaEmision(empresaId, anio);
    const validacion = s.validacion;
    const origen = ultima ? !!ultima.validacion_id : null;
    const respaldaUltima = !!ultima && !!validacion && ultima.validacion_numero === validacion.numero;
    const actualizacionPendiente = !!ultima && !!origen && !!validacion?.vigente && !respaldaUltima;

    let estado: AnioDisponible["estado"] = "VALIDACION_VIGENTE";
    if (s.filas.length === 0 && !validacion) estado = "SIN_DOCUMENTACION_ELEGIBLE";
    else if (s.filas.some((f) => !f.estado)) estado = "PENDIENTE_REVISION";
    else if (!validacion?.vigente) estado = "PENDIENTE_VALIDACION";
    else if (respaldaUltima) estado = "REPORTE_GENERADO";
    else if (actualizacionPendiente) estado = "ACTUALIZACION_PENDIENTE";

    const puede_generar = estado === "VALIDACION_VIGENTE" || estado === "ACTUALIZACION_PENDIENTE";
    return {
      anio,
      estado,
      puede_generar,
      motivo_no_generar: puede_generar ? null : "PENDIENTE_REVISION",
      validacion_anterior_no_vigente: !!validacion && !validacion.vigente,
      reporte_id: ultima?.id ?? null,
      reporte_version: ultima?.version ?? null,
      reporte_creado_en: ultima?.creado_en ?? null,
      reporte_validacion_numero: ultima?.validacion_numero ?? null,
      versiones_emitidas: this.reportes.filter((r) => r.empresa_id === empresaId && r.anio === anio).length,
      ultima_validacion_numero: validacion?.numero ?? null,
      origen_verificable: origen,
      reporte_actualizado: ultima ? respaldaUltima && !!validacion?.vigente : null,
      actualizacion_pendiente: actualizacionPendiente,
    };
  }

  private disponibilidad(q: URLSearchParams): Respuesta {
    const empresa = this.empresas.find((e) => e.id === q.get("empresa_id"));
    if (!empresa) return error(404, "COMPANY_NOT_FOUND", "Empresa inexistente.");
    const conDocumentos = this.documentos.filter((d) => d.empresa_id === empresa.id && this.estadoDe(empresa.id, d.anio).filas.length > 0).map((d) => d.anio);
    const conReporte = this.reportes.filter((r) => r.empresa_id === empresa.id).map((r) => r.anio);
    const anios = [...new Set([...conDocumentos, ...conReporte])].sort((a, b) => b - a);
    return ok({
      ambiente: "e2e",
      empresa_id: empresa.id,
      empresa_nombre: empresa.nombre,
      empresa_activa: empresa.activa,
      anios: anios.map((a) => this.anioDisponible(empresa.id, a)),
      aviso: "Consulta informativa.",
    });
  }

  private vigente(q: URLSearchParams): Respuesta {
    const empresaId = q.get("empresa_id") ?? "";
    const anio = Number(q.get("anio"));
    const ultima = this.ultimaEmision(empresaId, anio);
    if (!ultima) return error(404, "REPORT_NOT_FOUND", "No hay reportes para ese año.");
    const a = this.anioDisponible(empresaId, anio);
    return ok({
      ...ultima,
      ultima_validacion_numero: a.ultima_validacion_numero,
      origen_verificable: a.origen_verificable,
      validacion_anterior_no_vigente: a.validacion_anterior_no_vigente,
      reporte_actualizado: a.reporte_actualizado,
      actualizacion_pendiente: a.actualizacion_pendiente,
      puede_generar: a.puede_generar,
      motivo_no_generar: a.motivo_no_generar,
    });
  }

  private archivoVigente(q: URLSearchParams): Respuesta {
    const empresaId = q.get("empresa_id") ?? "";
    const anio = Number(q.get("anio"));
    const ultima = this.ultimaEmision(empresaId, anio);
    if (!ultima) return error(404, "REPORT_NOT_FOUND", "No hay reportes para ese año.");
    const a = this.anioDisponible(empresaId, anio);
    if (a.reporte_actualizado) return this.archivoReporte(ultima.id);
    const detalles = { reporte_id: ultima.id, version: ultima.version, estado: a.estado, puede_generar: a.puede_generar, motivo_no_generar: a.motivo_no_generar };
    if (a.actualizacion_pendiente) return error(409, "REPORT_UPDATE_PENDING", "Hay una validación posterior sin emitir.", { ...detalles, accion_sugerida: "EMITIR" });
    if (a.origen_verificable === false) return error(409, "REPORT_ORIGIN_UNVERIFIABLE", "El origen no puede verificarse.", { ...detalles, accion_sugerida: "DESCARGAR_VERSION_HISTORICA" });
    return error(409, "REPORT_ANALYSIS_NOT_CURRENT", "El análisis actual no está respaldado.", { ...detalles, accion_sugerida: "VALIDAR" });
  }

  private archivoReporte(id: string): Respuesta {
    const r = this.reportes.find((x) => x.id === id);
    if (!r) return error(404, "REPORT_NOT_FOUND", "Reporte inexistente.");
    return {
      status: 200,
      archivo: { contenido: pdfMinimo(`Reporte - ${r.empresa_nombre} ${r.anio} v${r.version}`), tipo: "application/pdf", nombre: `reporte-${r.id}.pdf` },
    };
  }

  // ---------------------------------------------------------------- auditoría
  private listarEventos(q: URLSearchParams) {
    const desde = q.get("desde");
    const hasta = q.get("hasta");
    const xs = this.eventos.filter(
      (e) =>
        (!q.get("tipo_evento") || e.tipo_evento === q.get("tipo_evento")) &&
        (!q.get("usuario_id") || e.usuario_id === q.get("usuario_id")) &&
        (!desde || e.fecha_hora_utc >= desde) &&
        (!hasta || e.fecha_hora_utc <= hasta),
    );
    const pagina = Number(q.get("pagina") ?? 1);
    const tamano = Number(q.get("tamano") ?? 20);
    return { items: xs.slice((pagina - 1) * tamano, pagina * tamano), pagina, tamano, total: xs.length };
  }

  // ---------------------------------------------------------------- datos de prueba
  private cargarDatosIniciales() {
    const cuenta = (id: string, nombre: string, correo: string, rol: Rol, password: string, habilitado = true): Cuenta => ({
      id,
      nombre,
      correo,
      rol,
      habilitado,
      creado_en: AHORA,
      password,
    });
    this.cuentas = [
      cuenta("u-super", CREDENCIALES.superadmin.nombre, CREDENCIALES.superadmin.correo, "superadmin", CREDENCIALES.superadmin.password),
      cuenta("u-admin", CREDENCIALES.administrador.nombre, CREDENCIALES.administrador.correo, "administrador", CREDENCIALES.administrador.password),
      cuenta("u-luis", "Luis Pérez", "luis@igualab.com", "administrador", "Luis123!"),
      cuenta("u-carla", "Carla Ruiz", "carla@igualab.com", "administrador", "Carla123!", false),
    ];

    const empresa = (id: string, nombre: string, sector: SectorApi, activa = true): EmpresaApi => ({ id, nombre, sector, activa, creada_en: AHORA });
    this.empresas = [
      empresa("e-andina", "Minera Andina S.A.A.", "MINERIA"),
      empresa("e-altiplano", "Minera Altiplano S.A.", "MINERIA"),
      empresa("e-pnorte", "Petro Norte S.A.", "PETROLEO", false),
      empresa("e-psur", "Petro Sur S.A.", "PETROLEO"),
      empresa("e-utec", "Utec ELEC S.A.", "ENERGIA"),
    ];

    const doc = (id: string, e: EmpresaApi, anio: number, tipo: TipoDocumentoApi, archivo: string): DocumentoResumen => ({
      id,
      operacion_id: null,
      empresa_id: e.id,
      empresa_nombre: e.nombre,
      sector: e.sector,
      anio,
      tipo,
      nombre_archivo: archivo,
      sha256: "f00ba4",
      tamano_bytes: 1843,
      estado: "COMPLETADO",
      resultado_analisis: "CON_HALLAZGOS",
      disponible_para_rag: true,
      fragmentos_total: 3,
      cantidad_advertencias: 0,
      cargado_por: "u-super",
      creado_en: "2026-10-09T15:00:00Z",
      completado_en: "2026-10-09T15:00:05Z",
    });
    const [andina, , pnorte, psur, utec] = this.empresas;
    this.documentos = [
      doc("d-andina-2024", andina, 2024, "MEMORIA_ANUAL", "memoria-andina-2024.md"),
      doc("d-psur-2024", psur, 2024, "REPORTE_SOSTENIBILIDAD_GRI", "gri-petro-sur-2024.md"),
      doc("d-pnorte-2025", pnorte, 2025, "MEMORIA_ANUAL", "memoria-petro-norte-2025.md"),
      doc("d-utec-2025", utec, 2025, "MEMORIA_ANUAL", "memoria-utec-2025.md"),
    ];

    // Un chat ya guardado del Administrador (Minera Andina 2024), para el historial.
    const respuestaGuardada: ConsultaAsistente = {
      respuesta: "Se identifica una multa del OEFA de 59.078 UIT [1].",
      afirmaciones: [{ texto: "Se identifica una multa del OEFA de 59.078 UIT.", referencias: [1], cita_textual: "OEFA impuso una multa de 59.078 UIT." }],
      citas: [
        {
          referencia: 1,
          documento_id: "d-andina-2024",
          documento_nombre: "memoria-andina-2024.md",
          empresa_id: andina.id,
          empresa_nombre: andina.nombre,
          anio: 2024,
          seccion: "Memoria Anual > Contingencias",
          extracto: "En el ejercicio, OEFA impuso una multa de 59.078 UIT.",
        },
      ],
      sin_evidencia: false,
      motivo: null,
      mensaje: null,
      afirmaciones_descartadas: 0,
    };
    this.conversaciones = [
      {
        id: "conv-andina",
        titulo: "¿Qué multas recibió en 2024?",
        contexto: { empresa_id: andina.id, empresa_nombre: andina.nombre, empresa_activa: true, sector: andina.sector, anio: 2024 },
        total_mensajes: 2,
        creada_en: "2026-11-10T09:00:00Z",
        actualizada_en: "2026-11-10T09:00:00Z",
        mensajes: [
          { id: "msg-1", orden: 1, rol: "usuario", contenido: "¿Qué multas recibió en 2024?", respuesta: null, procedencia: "APORTADO_POR_CLIENTE", creado_en: "2026-11-10T09:00:00Z" },
          { id: "msg-2", orden: 2, rol: "asistente", contenido: respuestaGuardada.respuesta, respuesta: respuestaGuardada, procedencia: "APORTADO_POR_CLIENTE", creado_en: "2026-11-10T09:00:00Z" },
        ],
      },
    ];

    // Minera Andina 2024: dos códigos GRI sin estado y una sanción.
    const evidencia = (cita: string, inicio: number, rol = "cuerpo") => ({
      documento_id: "d-andina-2024",
      documento_nombre: "memoria-andina-2024.md",
      seccion: "Capítulo 4 · Medio ambiente",
      rol,
      referencia_original: "GRI",
      cita,
      inicio,
      en_codigo: false,
      edicion_mencionada: null,
      motivos_revision: [],
    });
    const fila = (identidad: string, codigo: string, edicion: string | null, estandar: string, nombre: string | null): FilaGri => ({
      identidad,
      codigo,
      edicion,
      identidad_tipo: edicion ? "EDICION_RESUELTA" : "EDICION_AMBIGUA",
      estandar,
      nombre,
      candidatos: edicion ? [] : ["2016", "2021"],
      requiere_revision: !edicion,
      estado: null,
      version_fila: 0,
      total_menciones: 2,
      menciones_en_indice: 1,
      menciones_en_cuerpo: 1,
      documentos: ["d-andina-2024"],
      // Mismo aviso que manda el backend para un estándar con varias ediciones y sin edición en el texto.
      advertencias: edicion
        ? []
        : [
            {
              codigo: "GRI_EDICION_AMBIGUA",
              mensaje: "Estándar con varias ediciones y sin edición en el texto. Se conserva como identidad ambigua; no se asumió ninguna edición.",
              total_menciones: 2,
              referencias: [`GRI ${codigo}-1`],
            },
          ],
      evidencias: [evidencia(`Mención de ${estandar} en el documento.`, identidad.length * 10)],
    });
    const emitido = (id: string, empresa_id: string, empresa_nombre: string, anio: number, sha256: string, creado_en: string): ReporteResumen => ({
      id,
      empresa_id,
      empresa_nombre,
      anio,
      version: 1,
      es_ultima_version: true,
      validacion_id: "val-1",
      validacion_numero: 1,
      generado_por: "u-admin",
      generado_por_nombre: "Ana García",
      sha256,
      creado_en,
    });
    this.reportes = [
      emitido("r-andina-2023", "e-andina", "Minera Andina S.A.A.", 2023, "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae", "2026-10-10T14:00:00Z"),
      emitido("r-psur-2024", "e-psur", "Petro Sur S.A.", 2024, "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9", "2026-10-12T09:30:00Z"),
    ];
    // Esos reportes respaldan la validación 1 de su análisis.
    this.reportes.forEach((r) => this.validarAnalisisPorFuera(r.empresa_id, r.anio));

    // 25 eventos de auditoría (2 páginas de 20), del más reciente al más antiguo.
    const tipos: TipoEventoAuditoria[] = ["Inicio de sesión", "Ingesta de datos", "Generación de reporte", "Descarga", "Cambio de rol"];
    this.eventos = Array.from({ length: 25 }, (_, i) => {
      const tipo = tipos[i % tipos.length];
      const dia = String(15 - Math.floor(i / 5)).padStart(2, "0");
      return {
        id: `ev-${i + 1}`,
        usuario_id: i % 2 === 0 ? "u-super" : "u-admin",
        tipo_evento: tipo,
        detalle: `${tipo} #${i + 1}`,
        fecha_hora_utc: `2026-10-${dia}T15:${String(59 - i).padStart(2, "0")}:00Z`,
      };
    });

    this.analisis.set("e-andina:2024", {
      version: 1,
      filas: [
        fila("305:2016", "305", "2016", "GRI 305 (2016)", "Emisiones"),
        fila("102:ambigua", "102", null, "GRI 102 (edición sin resolver)", null),
      ],
      sanciones: [
        {
          documento_id: "d-andina-2024",
          documento_nombre: "memoria-andina-2024.md",
          tipo_termino: "multa",
          referencia_original: "multa",
          cita: "OEFA impuso una multa de 59.078 UIT por incumplimiento ambiental.",
          inicio: 1500,
          seccion: "Contingencias",
          en_tabla: false,
          entidad: { texto: "OEFA" },
          monto: { texto: "59.078 UIT", unidad: "UIT", separador_ambiguo: true },
          cuantificada: true,
          periodo: null,
          motivos_revision: [],
        },
      ],
      validacion: null,
      historial: [],
    });
  }
}

/** PDF mínimo válido de una página con una línea de texto (ASCII), para simular los reportes. */
function pdfMinimo(texto: string): Buffer {
  const limpio = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[()\\]/g, "");
  const contenido = `BT /F1 18 Tf 60 760 Td (${limpio}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
