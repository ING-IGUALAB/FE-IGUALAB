import { useCallback, useEffect, useState, type ReactNode } from "react";
import SectionHeader from "../components/SectionHeader";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import * as auditoriaApi from "../api/auditoria";
import * as usuariosApi from "../api/usuarios";
import { mensajeError } from "../api/client";
import { descargarBlob } from "../lib/descargas";
import { TIPOS_EVENTO_AUDITORIA, aCsv, finDiaUtc, inicioDiaUtc, totalPaginas } from "../lib/dominio";
import type { EventoAuditoriaApi, TipoEventoAuditoria, Usuario } from "../types";

const TAM_PAGINA = 20;
const CLS_CONTROL =
  "rounded-lg border border-outline-variant bg-surface-container-lowest py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "medium" });
}

export default function Auditoria() {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [eventos, setEventos] = useState<EventoAuditoriaApi[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [tipo, setTipo] = useState<"" | TipoEventoAuditoria>("");
  const [usuarioId, setUsuarioId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);

  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  const nombreUsuario = (id?: string | null) => (id ? usuarios.find((u) => u.id === id)?.nombre ?? "Usuario" : "Sistema");
  const filtros = useCallback(
    () => ({ tipoEvento: tipo || undefined, usuarioId: usuarioId || undefined, desde: inicioDiaUtc(desde), hasta: finDiaUtc(hasta) }),
    [tipo, usuarioId, desde, hasta],
  );

  useEffect(() => {
    usuariosApi
      .listarUsuarios()
      .then(setUsuarios)
      .catch((err) => toast(mensajeError(err, "No se pudieron cargar los usuarios."), "error"));
  }, [toast]);

  const cargar = useCallback(async () => {
    if (rangoInvalido) return;
    setCargando(true);
    try {
      const data = await auditoriaApi.listarEventos({ ...filtros(), pagina, tamano: TAM_PAGINA });
      setEventos(data.items);
      setTotal(data.total);
    } catch (err) {
      toast(mensajeError(err, "No se pudo cargar la auditoría."), "error");
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina, rangoInvalido, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function exportar() {
    setExportando(true);
    try {
      const todos = await auditoriaApi.listarTodosEventos(filtros());
      const filas = [
        ["fecha_hora", "usuario", "tipo_evento", "detalle"],
        ...todos.map((e) => [fechaHora(e.fecha_hora_utc), nombreUsuario(e.usuario_id), e.tipo_evento, e.detalle]),
      ];
      descargarBlob(new Blob([aCsv(filas)], { type: "text/csv;charset=utf-8" }), "auditoria_igualab.csv");
      toast(`Se exportaron ${todos.length} eventos.`, "success");
    } catch (err) {
      toast(mensajeError(err, "No se pudo exportar la auditoría."), "error");
    } finally {
      setExportando(false);
    }
  }

  function limpiar() {
    setTipo("");
    setUsuarioId("");
    setDesde("");
    setHasta("");
    setPagina(1);
  }

  const paginas = totalPaginas(total, TAM_PAGINA);

  return (
    <>
      <SectionHeader
        titulo="Auditoría de eventos"
        sub="Registro automático e inmutable de eventos sensibles. Solo lectura: consigna la cuenta, la fecha, la hora y el tipo de evento."
        acciones={
          <button onClick={exportar} disabled={exportando || total === 0} className="flex items-center gap-sm px-md py-sm bg-surface rounded-lg border border-outline-variant text-on-surface text-label-md font-semibold hover:bg-surface-container-low transition-colors disabled:opacity-50">
            {exportando ? <Spinner size={16} /> : <span className="material-symbols-outlined text-[18px]">download</span>} Exportar CSV
          </button>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-wrap gap-md items-end">
          <Filtro label="Tipo de evento">
            <select value={tipo} onChange={(e) => { setTipo(e.target.value as "" | TipoEventoAuditoria); setPagina(1); }} className={CLS_CONTROL}>
              <option value="">Todos</option>
              {TIPOS_EVENTO_AUDITORIA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Filtro>
          <Filtro label="Usuario">
            <select value={usuarioId} onChange={(e) => { setUsuarioId(e.target.value); setPagina(1); }} className={CLS_CONTROL}>
              <option value="">Todos</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Filtro>
          <Filtro label="Desde">
            <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }} className={CLS_CONTROL} />
          </Filtro>
          <Filtro label="Hasta">
            <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }} className={CLS_CONTROL} />
          </Filtro>
          <button onClick={limpiar} className="py-sm px-md rounded-lg text-label-md text-primary hover:bg-primary/5 transition-colors">Limpiar filtros</button>
        </div>
        {rangoInvalido && (
          <div className="px-lg py-sm bg-error-container text-on-error-container text-body-md">La fecha «Desde» no puede ser posterior a «Hasta».</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {["Fecha y hora", "Usuario", "Tipo de evento", "Detalle"].map((h) => (
                  <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-body-md">
              {cargando && ["a1", "a2", "a3"].map((k) => (
                <tr key={k} className="border-b border-surface-variant"><td colSpan={4} className="py-md px-md"><div className="h-5 bg-surface-variant rounded animate-pulse" /></td></tr>
              ))}
              {!cargando && eventos.length === 0 && (
                <tr><td colSpan={4} className="py-xl text-center text-on-surface-variant">Sin eventos para el filtro seleccionado.</td></tr>
              )}
              {!cargando && eventos.map((e) => (
                <tr key={e.id} className="border-b border-surface-variant hover:bg-surface/50 transition-colors">
                  <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{fechaHora(e.fecha_hora_utc)}</td>
                  <td className="py-md px-md font-medium">{nombreUsuario(e.usuario_id)}</td>
                  <td className="py-md px-md">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-surface-container-low border border-outline-variant text-label-sm text-on-surface-variant whitespace-nowrap">{e.tipo_evento}</span>
                  </td>
                  <td className="py-md px-md">{e.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-sm border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between gap-md">
          <span className="text-label-sm text-on-surface-variant">{total} eventos · Registro de solo lectura</span>
          {paginas > 1 && (
            <div className="flex items-center gap-sm">
              <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1 || cargando} className="px-md py-xs rounded-lg border border-outline-variant text-label-md disabled:opacity-40">Anterior</button>
              <span className="text-label-md text-on-surface-variant">Página {pagina} de {paginas}</span>
              <button onClick={() => setPagina((p) => Math.min(paginas, p + 1))} disabled={pagina >= paginas || cargando} className="px-md py-xs rounded-lg border border-outline-variant text-label-md disabled:opacity-40">Siguiente</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Filtro({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="text-label-sm text-on-surface-variant uppercase">{label}</span>
      {children}
    </label>
  );
}
