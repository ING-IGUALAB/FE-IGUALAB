// Política de contraseñas (RNF-001). Se valida en el front para feedback
// inmediato; el backend vuelve a validar.
export interface ReglaPassword {
  ok: (p: string, correo?: string) => boolean;
  msg: string;
}

export const REGLAS_PASSWORD: ReglaPassword[] = [
  { ok: (p) => p.length >= 8, msg: "Mínimo 8 caracteres" },
  { ok: (p) => /[A-Z]/.test(p), msg: "Una letra mayúscula" },
  { ok: (p) => /[a-z]/.test(p), msg: "Una letra minúscula" },
  { ok: (p) => /\d/.test(p), msg: "Un dígito" },
  { ok: (p) => /[^A-Za-z0-9]/.test(p), msg: "Un carácter especial" },
  { ok: (p, correo) => p.toLowerCase() !== correo?.toLowerCase(), msg: "Distinta al correo" },
];

export function passwordValida(p: string, correo?: string): boolean {
  return REGLAS_PASSWORD.every((r) => r.ok(p, correo));
}
