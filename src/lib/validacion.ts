// Validación de correo SIN regex vulnerable a ReDoS (backtracking super-lineal).
// Se hace con búsquedas lineales (indexOf) en vez de un patrón con cuantificadores
// ambiguos como /^[^@\s]+@[^@\s]+\.[^@\s]+$/.
export function esCorreoValido(correo: string): boolean {
  const c = correo.trim();
  if (c.length === 0 || c.includes(" ")) return false;
  const at = c.indexOf("@");
  // Debe haber exactamente un "@", y no al inicio.
  if (at <= 0 || at !== c.lastIndexOf("@")) return false;
  const dominio = c.slice(at + 1);
  const punto = dominio.lastIndexOf(".");
  // El dominio debe tener un punto que no esté al inicio ni al final.
  return punto > 0 && punto < dominio.length - 1;
}
