import type { Page, Request, Route } from "@playwright/test";
import type {
  AnalisisGri,
  DocumentoResumen,
  EmpresaApi,
  EstadoGriApi,
  EstadoProgreso,
  EventoAuditoriaApi,
  FilaGri,
  HistorialGriItem,
  PuntajeEsg,
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

function error(status: number, code: string, message: string): Respuesta {
  return { status, body: { error: { code, message, details: null, request_id: "e2e" } } };
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
  private fallos: FalloForzado[] = [];
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

  /** Deja validado el análisis de una empresa y año (requisito para generar su reporte). */
  validarAnalisisPorFuera(empresaId: string, anio: number) {
    const s = this.estadoDe(empresaId, anio);
    s.filas.forEach((f) => Object.assign(f, { estado: f.estado ?? "OK" }));
    s.validacion = {
      numero: 1,
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
      { metodo: "GET", patron: /^\/documentos$/, fn: (_m, _r, q) => ok(this.listarDocumentos(q)) },
      { metodo: "GET", patron: /^\/documentos\/([^/]+)$/, fn: (m) => this.detalleDocumento(m[1]) },
      // Asistente de IA
      { metodo: "POST", patron: /^\/asistente\/consultas$/, fn: (_m, req) => this.consultarAsistente(req) },
      // Reportes de prospección
      { metodo: "GET", patron: /^\/reportes$/, fn: () => ok(this.reportes) },
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
      estado: "COMPLETADO",
      resultado_analisis: "CON_HALLAZGOS",
      disponible_para_rag: true,
      fragmentos_total: 4,
      cantidad_advertencias: 0,
      cargado_por: "Oscar Baldeón",
      creado_en: "2026-10-14T16:00:00Z",
      completado_en: "2026-10-14T16:00:05Z",
    };
    this.documentos.unshift(doc);
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
      advertencias: [],
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
    const cuerpo = req.postDataJSON() as { pregunta?: string; sector?: SectorApi; empresa_id?: string; anio?: number };
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
    if (/f[uú]tbol/i.test(cuerpo.pregunta ?? "")) {
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
    const reporte: ReporteResumen = {
      id: this.nuevoId("r"),
      empresa_id: v.empresa!.id,
      anio: v.anio,
      generado_por: "u-admin",
      sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      creado_en: "2026-10-16T15:00:00Z",
    };
    this.reportes.unshift(reporte);
    return ok(reporte, 201);
  }

  private archivoReporte(id: string): Respuesta {
    const r = this.reportes.find((x) => x.id === id);
    if (!r) return error(404, "REPORT_NOT_FOUND", "Reporte inexistente.");
    const empresa = this.empresas.find((e) => e.id === r.empresa_id)?.nombre ?? "empresa";
    return {
      status: 200,
      archivo: { contenido: pdfMinimo(`Reporte - ${empresa} ${r.anio}`), tipo: "application/pdf", nombre: `reporte-${r.id}.pdf` },
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
      cargado_por: "Oscar Baldeón",
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
      advertencias: [],
      evidencias: [evidencia(`Mención de ${estandar} en el documento.`, identidad.length * 10)],
    });
    this.reportes = [
      {
        id: "r-andina-2023",
        empresa_id: "e-andina",
        anio: 2023,
        generado_por: "u-admin",
        sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        creado_en: "2026-10-10T14:00:00Z",
      },
      {
        id: "r-psur-2024",
        empresa_id: "e-psur",
        anio: 2024,
        generado_por: "u-admin",
        sha256: "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
        creado_en: "2026-10-12T09:30:00Z",
      },
    ];

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
