import { useEffect, useState } from "react";

/**
 * Segundos que faltan de una cuenta regresiva que empieza al montar el componente. Se calcula con la
 * hora real, así no se acorta ni se atrasa aunque el navegador frene los temporizadores de la pestaña.
 */
export function useCuentaRegresiva(segundos: number): number {
  const [restante, setRestante] = useState(segundos);

  useEffect(() => {
    const fin = Date.now() + segundos * 1000;
    const id = setInterval(() => {
      const falta = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
      setRestante(falta);
      if (falta === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [segundos]);

  return restante;
}
