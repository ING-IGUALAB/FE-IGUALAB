import { type ReactNode } from "react";

interface Props {
  titulo: string;
  sub?: string;
  acciones?: ReactNode;
}

export default function SectionHeader({ titulo, sub, acciones }: Readonly<Props>) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
      <div>
        <h2 className="text-headline-lg text-on-background">{titulo}</h2>
        {sub && <p className="text-body-md text-on-surface-variant mt-1">{sub}</p>}
      </div>
      {acciones}
    </div>
  );
}
