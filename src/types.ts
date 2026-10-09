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

export interface DocumentoDetalle extends DocumentoResumen {
  etapa: string;
  fragmentos_procesados: number;
  advertencias: unknown[];
  publicacion_reintentable: boolean;
  error?: ErrorOperacion | null;
  analisis?: Record<string, unknown> | null;
  actualizado_en: string;
}
