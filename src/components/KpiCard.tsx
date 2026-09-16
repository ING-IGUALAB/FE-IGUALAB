interface Props {
  titulo: string;
  valor: string | number;
  icono: string;
  color?: "primary" | "secondary" | "tertiary";
  pie?: number;
  extra?: string;
}

export default function KpiCard({ titulo, valor, icono, color = "primary", pie = 75, extra }: Props) {
  const barCls = color === "secondary" ? "bg-secondary" : color === "tertiary" ? "bg-tertiary" : "bg-primary";
  const iconCls =
    color === "secondary" ? "text-secondary bg-secondary/10" : color === "tertiary" ? "text-tertiary bg-tertiary/10" : "text-primary bg-primary/10";
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-lg ambient-shadow ambient-shadow-hover relative overflow-hidden">
      <div className="flex justify-between items-start mb-md">
        <h3 className="text-label-sm text-on-surface-variant uppercase tracking-wider">{titulo}</h3>
        <span className={`material-symbols-outlined p-1 rounded text-[20px] ${iconCls}`}>{icono}</span>
      </div>
      <div className="flex items-baseline gap-sm">
        <span className="text-display-lg text-on-background">{valor}</span>
      </div>
      {extra && <div className="mt-sm text-xs text-on-surface-variant">{extra}</div>}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-surface-variant">
        <div className={`h-full ${barCls}`} style={{ width: `${Math.min(pie, 100)}%` }} />
      </div>
    </div>
  );
}
