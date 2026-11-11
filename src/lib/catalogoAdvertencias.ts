/**
 * Catálogo de advertencias: un solo lugar con la explicación de cada aviso que devuelve el análisis,
 * para que se lea igual en todas las pantallas. La clave es el `codigo` que manda el backend.
 */
export interface EntradaAdvertencia {
  titulo: string;
  /** Qué significa la advertencia. */
  significado: string;
  /** Por qué aparece. */
  motivo: string;
  /** Qué debe hacer la persona. */
  accion: string;
}

export const AYUDA_REQUIERE_REVISION: EntradaAdvertencia = {
  titulo: "Requiere revisión",
  significado: "El sistema encontró algo en este código GRI que no pudo resolver por sí solo y necesita que una persona lo confirme.",
  motivo: "Nunca se completa ni se supone información que el documento no dice con claridad.",
  accion: "Lee las evidencias antes de asignar el estado. No impide validar el análisis.",
};

export const CATALOGO_ADVERTENCIAS: Readonly<Record<string, EntradaAdvertencia>> = {
  GRI_EDICION_AMBIGUA: {
    titulo: "Edición del estándar sin precisar",
    significado: "Este estándar GRI tiene más de una edición y el documento lo menciona sin decir cuál usa.",
    motivo: "Para no inventar un dato, el sistema no elige ninguna edición: muestra el código tal como aparece y deja el nombre sin completar.",
    accion: "Revisa las evidencias para ver qué edición sigue la empresa y asigna el estado según lo que encuentres. No impide validar el análisis.",
  },
  GRI_EDICION_NO_CATALOGADA: {
    titulo: "Edición que no está en el catálogo",
    significado: "El documento cita una edición de este estándar que el catálogo GRI del sistema no registra.",
    motivo: "Puede ser un error de escritura en el documento o una edición que el catálogo no incluye. Se conserva tal como está escrita, sin corregirla.",
    accion: "Confirma en las evidencias que la edición citada es la correcta antes de asignar el estado.",
  },
  GRI_FORMATO_A_REVISAR: {
    titulo: "Referencia escrita de forma poco clara",
    significado: "Algunas menciones de este estándar tienen un formato poco habitual o no corresponden al tipo de estándar.",
    motivo: "El sistema las conserva tal cual, sin reinterpretarlas, para que puedas comprobarlas.",
    accion: "Lee las evidencias y verifica que de verdad se refieren a este estándar antes de asignar el estado.",
  },
  GRI_REFERENCIA_DESCONOCIDA: {
    titulo: "Código que no está en el catálogo GRI",
    significado: "El documento menciona un código con apariencia de GRI que no existe en el catálogo.",
    motivo: "No se corrige ni se supone que sea un estándar GRI, por eso no aparece entre los códigos a evaluar.",
    accion: "Revisa la mención en el documento. Si es un error de la empresa, no hace falta hacer nada en el análisis.",
  },
  SANCION_A_REVISAR: {
    titulo: "Sanción con un dato por revisar",
    significado: "Se detectó una sanción, pero alguno de sus datos (importe, autoridad o fecha) no está claro en el documento.",
    motivo: "El sistema no completa ni estima datos que el documento no dice con claridad.",
    accion: "Verifica ese dato en el documento original antes de usar la sanción en tus conclusiones.",
  },
  POSIBLE_SANCION_DUPLICADA: {
    titulo: "Posible sanción duplicada",
    significado: "Dos o más menciones parecen describir la misma sanción.",
    motivo: "No se juntan automáticamente para no perder información si en realidad son sanciones distintas.",
    accion: "Compáralas en el documento y confirma si son la misma antes de considerar el total de sanciones.",
  },
  DATOS_EN_CONFLICTO: {
    titulo: "Datos que se contradicen",
    significado: "Varias menciones de una sanción tienen datos diferentes entre sí, por ejemplo importes distintos.",
    motivo: "Se conservan por separado: el sistema no decide cuál de los datos es el correcto.",
    accion: "Revisa el documento original para saber qué dato es el válido.",
  },
  IMPORTE_A_REVISAR: {
    titulo: "Importe por revisar",
    significado: "El importe de la sanción no se pudo leer con certeza.",
    motivo: "Un importe dudoso no se estima ni se convierte, para no mostrar una cifra equivocada.",
    accion: "Consulta el importe en el documento original.",
  },
  MARKDOWN_TABLE_INCONSISTENT: {
    titulo: "Tabla con formato irregular",
    significado: "Alguna tabla del documento tiene filas con distinta cantidad de columnas.",
    motivo: "Suele ocurrir al convertir el PDF a Markdown. El documento se admitió igual, pero las citas de esa tabla pueden verse desordenadas.",
    accion: "Si una evidencia viene de esa tabla, confírmala en el documento original. Si el desorden es grande, vuelve a convertir y cargar el documento.",
  },
};

/** Explicación de una advertencia; si el código no está en el catálogo, la explicación general. */
export function ayudaAdvertencia(codigo: string): EntradaAdvertencia {
  return CATALOGO_ADVERTENCIAS[codigo] ?? AYUDA_REQUIERE_REVISION;
}

/** Explicaciones de un conjunto de advertencias, sin repetir; sin advertencias, la explicación general. */
export function ayudasDeAdvertencias(codigos: string[]): EntradaAdvertencia[] {
  const entradas = [...new Set(codigos.map(ayudaAdvertencia))];
  return entradas.length > 0 ? entradas : [AYUDA_REQUIERE_REVISION];
}
