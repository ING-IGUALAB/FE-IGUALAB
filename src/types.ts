export type Rol = "superadmin" | "administrador";

// Contrato de errores del backend: { error: { code, message, details, request_id } }
export interface BackendError {
  code: string;
  message: string;
  details: unknown;
  request_id: string;
}

export interface BackendErrorResponse {
  error: BackendError;
}

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  habilitado: boolean;
  creado_en: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  rol: Rol;
  nombre: string;
}

export interface SesionActual {
  token: string;
  rol: Rol;
  nombre: string;
}

// ---- Dominio de sostenibilidad (aún sin backend, datos locales) ----
export type EstadoGri = "OK" | "Baja sustancia" | "Sub-reportado";
export type Sector = "Minería" | "Petróleo y Gas" | "Energía";
export type TipoDocumento = "Memoria Anual" | "Reporte de Sostenibilidad GRI";
export type EstadoIngesta = "Éxito" | "En proceso" | "Rechazado";

export interface Empresa {
  id: string;
  nombre: string;
  sector: Sector;
  activa: boolean;
}

export interface CodigoGri {
  codigo: string;
  tema: string;
  estado: EstadoGri;
  cita: string;
  doc: string;
  pagina: string;
}

export interface Sancion {
  entidad: string;
  motivo: string;
  monto: number | null;
  cita: string;
  doc: string;
  pagina: string;
}

export interface Analisis {
  evidencia: { gri: boolean; sanciones: boolean };
  gri: CodigoGri[];
  sanciones: Sancion[];
}

export interface Documento {
  id: string;
  empresaId: string;
  empresa: string;
  sector: Sector;
  anio: number;
  tipo: TipoDocumento;
  estado: EstadoIngesta;
  fecha: string;
  cuenta: string;
  hash: string;
  tamano: string;
}

export interface Reporte {
  id: string;
  empresaId: string;
  empresa: string;
  sector: Sector;
  anio: number;
  generadoPor: string;
  fecha: string;
}

export interface EventoAuditoria {
  id: number;
  fecha: string;
  usuario: string;
  tipo: string;
  accion: string;
}

// ---- Catálogo de empresas e ingesta de datos (backend real) ----
export type SectorApi = "MINERIA" | "PETROLEO" | "ENERGIA";
export type TipoDocumentoApi = "MEMORIA_ANUAL" | "REPORTE_SOSTENIBILIDAD_GRI";
export type EstadoProgreso =
  | "EN_PROCESO"
  | "PUBLICACION_PENDIENTE"
  | "COMPLETADO"
  | "FALLIDO_LIMPIEZA_PENDIENTE"
  | "FALLIDO";
export type EstadoOperacion =
  | "CREADA"
  | "VALIDANDO"
  | "INTERRUMPIDA"
  | "RECHAZADA"
  | "EN_PROCESO"
  | "PUBLICACION_PENDIENTE"
  | "COMPLETADO"
  | "FALLIDO"
  | "FALLIDO_LIMPIEZA_PENDIENTE";
export type ResultadoAnalisis = "CON_HALLAZGOS" | "OBSERVADO";

export interface EmpresaApi {
  id: string;
  nombre: string;
  sector: SectorApi;
  activa: boolean;
  creada_en: string;
}

export interface ErrorOperacion {
  code: string;
  message: string;
}

export interface OperacionCreada {
  operacion_id: string;
  estado: EstadoOperacion;
  creada_en: string;
  ingesta_url: string;
  progreso_url: string;
}

export interface Operacion {
  operacion_id: string;
  estado: EstadoOperacion;
  terminal: boolean;
  exitosa: boolean;
  etapa?: string | null;
  documento_id?: string | null;
  fragmentos_procesados: number;
  fragmentos_total?: number | null;
  advertencias: unknown[];
  resultado_analisis?: ResultadoAnalisis | null;
  publicacion_reintentable: boolean;
  error?: ErrorOperacion | null;
  creada_en: string;
  actualizada_en: string;
}

export interface ResultadoIngesta extends Operacion {
  motivos?: string[];
  fragmentos?: number;
}

export interface DocumentoResumen {
  id: string;
  operacion_id?: string | null;
  empresa_id: string;
  empresa_nombre: string;
  sector: SectorApi;
  anio: number;
  tipo: TipoDocumentoApi;
  nombre_archivo: string;
  sha256: string;
  tamano_bytes: number;
  estado: EstadoProgreso;
  resultado_analisis?: ResultadoAnalisis | null;
  disponible_para_rag: boolean;
  fragmentos_total?: number | null;
  cantidad_advertencias: number;
  cargado_por: string;
  creado_en: string;
  completado_en?: string | null;
}

export interface PaginaDocumentos {
  items: DocumentoResumen[];
  total: number;
  pagina: number;
  tamano: number;
  paginas: number;
}

// ---- Análisis y validación GRI (backend real, rol Administrador) ----
export type EstadoGriApi = "OK" | "BAJA_SUSTANCIA" | "SUB_REPORTADO";
export type EstadoFlujo =
  | "DOCUMENTACION_INSUFICIENTE"
  | "SIN_CODIGOS_GRI"
  | "PENDIENTE_ESTADOS"
  | "LISTO_PARA_VALIDAR"
  | "VALIDADO";
export type EstadoPuntaje = "NO_DISPONIBLE" | "PENDIENTE_ESTADOS" | "CALCULADO_SIN_VALIDAR" | "VALIDADO";
export type TipoIdentidadGri = "EDICION_RESUELTA" | "EDICION_AMBIGUA" | "EDICION_NO_CATALOGADA";
export type MotivoNoVigente = "ESTADOS_CAMBIARON" | "DOCUMENTOS_CAMBIARON";

export interface ActorResumen {
  id: string;
  nombre: string;
}

export interface EvidenciaGri {
  documento_id: string;
  documento_nombre: string;
  seccion: string;
  rol: string;
  referencia_original: string;
  cita: string;
  inicio: number;
  en_codigo: boolean;
  edicion_mencionada?: string | null;
  motivos_revision: string[];
}

export interface AdvertenciaFila {
  codigo: string;
  mensaje: string;
  total_menciones: number;
  referencias: string[];
}

export interface FilaGri {
  identidad: string;
  codigo: string;
  edicion: string | null;
  identidad_tipo: TipoIdentidadGri;
  estandar: string;
  nombre: string | null;
  candidatos: string[];
  requiere_revision: boolean;
  estado?: EstadoGriApi | null;
  estado_etiqueta?: string | null;
  version_fila: number;
  asignado_por?: ActorResumen | null;
  asignado_en?: string | null;
  total_menciones: number;
  menciones_en_indice: number;
  menciones_en_cuerpo: number;
  documentos: string[];
  advertencias: AdvertenciaFila[];
  evidencias: EvidenciaGri[];
}

export interface DocumentoElegible {
  documento_id: string;
  nombre_archivo: string;
  tipo: TipoDocumentoApi;
  resultado_analisis: ResultadoAnalisis;
  observado: boolean;
  completado_en: string;
  version_catalogo: string;
  total_referencias_gri: number;
  total_sanciones: number;
}

export interface AdvertenciaAnalisis {
  codigo: string;
  categoria: string;
  mensaje: string;
  documento_id?: string | null;
  documento_nombre?: string | null;
}

export interface DatoTexto {
  texto: string;
}

export interface MontoVista {
  texto: string;
  unidad: string;
  separador_ambiguo: boolean;
}

export interface SancionVista {
  documento_id: string;
  documento_nombre: string;
  tipo_termino: string;
  referencia_original: string;
  cita: string;
  inicio: number;
  seccion: string;
  en_tabla: boolean;
  entidad: DatoTexto | null;
  monto: MontoVista | null;
  cuantificada: boolean;
  periodo: DatoTexto | null;
  motivos_revision: string[];
}

export interface ResumenSanciones {
  total: number;
  cuantificadas: number;
  no_cuantificadas: number;
  por_unidad: Record<string, number>;
}

export interface PuntajeEsg {
  estado: EstadoPuntaje;
  definitivo: boolean;
  valor: number | null;
  valor_presentacion: number | null;
  decimales_presentacion: number;
  suma_puntos: number | null;
  filas_contadas: number;
  filas_evaluables: number;
  filas_sin_estado: number;
  motivo: string | null;
  mensaje?: string | null;
}

export interface PendienteAnalisis {
  codigo: string;
  mensaje: string;
  cantidad?: number | null;
  identidades?: string[];
}

export interface ValidacionVista {
  numero: number;
  vigente: boolean;
  motivos_no_vigente: MotivoNoVigente[];
  validado_por: ActorResumen;
  validado_en: string;
  version_estados: number;
  huella_documentos: string;
  documentos_validados: number;
  filas_validadas: number;
  puntaje_suma: number;
  puntaje_filas: number;
}

export interface AnalisisGri {
  ambiente: string;
  empresa: { id: string; nombre: string; sector: SectorApi; activa: boolean };
  anio: number;
  version: number;
  huella_documentos: string;
  estado_flujo: EstadoFlujo;
  habilita_reporte: boolean;
  version_catalogo: string[];
  documentos: DocumentoElegible[];
  filas: FilaGri[];
  advertencias: AdvertenciaAnalisis[];
  sanciones: SancionVista[];
  resumen_sanciones: ResumenSanciones;
  puntaje: PuntajeEsg;
  pendientes: PendienteAnalisis[];
  validacion: ValidacionVista | null;
}

export interface AsignarEstadoResponse {
  identidad: string;
  cambio: boolean;
  estado_anterior: EstadoGriApi | null;
  estado: EstadoGriApi;
  version_fila: number;
  version_analisis: number;
  asignado_por: ActorResumen;
  asignado_en: string;
  validacion_previa_invalidada: boolean;
}

export interface HistorialGriItem {
  id: string;
  identidad: string;
  codigo: string;
  edicion: string | null;
  identidad_tipo: TipoIdentidadGri;
  estado_anterior: EstadoGriApi | null;
  estado_nuevo: EstadoGriApi;
  usuario: ActorResumen;
  cambiado_en: string;
  version_analisis: number;
}

export interface PaginaHistorialGri {
  items: HistorialGriItem[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface ValidarAnalisisResponse {
  validacion: ValidacionVista;
  puntaje: PuntajeEsg;
  estado_flujo: EstadoFlujo;
  habilita_reporte: boolean;
}

export interface DocumentoDetalle extends DocumentoResumen {
  etapa: string;
  fragmentos_procesados: number;
  advertencias: unknown[];
  publicacion_reintentable: boolean;
  error?: ErrorOperacion | null;
  analisis?: Record<string, unknown> | null;
  actualizado_en: string;
}
