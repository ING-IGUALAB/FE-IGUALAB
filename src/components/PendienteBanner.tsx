export default function PendienteBanner() {
  return (
    <div className="flex items-start gap-sm rounded-xl border border-tertiary-fixed bg-tertiary-fixed/30 px-md py-sm text-on-tertiary-fixed">
      <span className="material-symbols-outlined text-[18px]">construction</span>
      <p className="text-label-md">Módulo con datos locales de demostración. Pendiente de conexión con el backend (aún no expone estos endpoints).</p>
    </div>
  );
}
