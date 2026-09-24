interface Props {
  titulo: string;
  valor: string | number;
  icono: string;
  color?: "primary" | "secondary" | "tertiary";
  pie?: number;
  extra?: string;
}

const BAR_CLS = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
} as const;

const ICON_CLS = {
  primary: "text-primary bg-primary/10",
  secondary: "text-secondary bg-secondary/10",
  tertiary: "text-tertiary bg-tertiary/10",
} as const;

export default function KpiCard({ titulo, valor, icono, color = "primary", pie = 75, extra }: Readonly<Props>) {
  const barCls = BAR_CLS[color];
  const iconCls = ICON_CLS[color];
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
