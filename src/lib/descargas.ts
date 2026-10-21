/** Descarga un archivo en el navegador (p. ej. el PDF de un reporte). */
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después para no cortar la descarga en navegadores lentos.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
