export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return "S/ " + Number(n).toLocaleString("es-PE", { maximumFractionDigits: 0 });
}

export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function fechaCorta(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

export function ahora(): string {
  return new Date()
    .toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}
