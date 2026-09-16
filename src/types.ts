export type Rol = "superadmin" | "administrador";

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
