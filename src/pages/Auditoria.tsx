import { useMemo, useState, type ReactNode } from "react";
import SectionHeader from "../components/SectionHeader";
import { useDomain } from "../data/DomainContext";
import { PendienteBanner } from "./Ingesta";

const TIPOS = [
  "Inicio de sesión",
  "Cambio de rol",
  "Cambio de estado GRI",
  "Ingesta de documento",
  "Rechazo de documento",
  "Registro de empresa",
  "Generación de reporte",
  "Descarga",
  "Consulta IA",
];

export default function Auditoria() {
  const { audit } = useDomain();
  const [tipo, setTipo] = useState("");
  const [usuario, setUsuario] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const usuarios = useMemo(() => [...new Set(audit.map((a) => a.usuario))], [audit]);

  const filtrados = useMemo(() => {
    return audit
      .filter((a) => (!tipo || a.tipo === tipo) && (!usuario || a.usuario === usuario) && (!desde || a.fecha >= desde) && (!hasta || a.fecha.slice(0, 10) <= hasta))
      .slice()
      .reverse();
  }, [audit, tipo, usuario, desde, hasta]);

  function exportar() {
    const rows = [["fecha", "usuario", "tipo", "accion"], ...filtrados.map((a) => [a.fecha, a.usuario, a.tipo, a.accion])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "auditoria_igualab.csv";
    a.click();
  }

  function limpiar() {
    setTipo(""); setUsuario(""); setDesde(""); setHasta("");
  }

  return (
    <>
      <SectionHeader
        titulo="Auditoría de eventos"
        sub="Registro automático e inmutable de eventos sensibles. Solo lectura (RN-029). Consigna cuenta, fecha, hora y tipo (RN-028)."
        acciones={
          <button onClick={exportar} className="flex items-center gap-sm px-md py-sm bg-surface rounded-lg border border-outline-variant text-on-surface text-label-md font-semibold hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span> Exportar
          </button>
        }
      />
      <PendienteBanner />

      <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-wrap gap-md items-end">
          <Filtro label="Tipo de evento">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-lowest py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
              <option value="">Todos</option>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Filtro>
          <Filtro label="Usuario">
            <select value={usuario} onChange={(e) => setUsuario(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-lowest py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none">
              <option value="">Todos</option>
              {usuarios.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Filtro>
          <Filtro label="Desde">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-lowest py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </Filtro>
          <Filtro label="Hasta">
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-lowest py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </Filtro>
          <button onClick={limpiar} className="py-sm px-md rounded-lg text-label-md text-primary hover:bg-primary/5 transition-colors">Limpiar filtros</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {["Fecha y hora", "Usuario", "Tipo de evento", "Acción"].map((h) => (
                  <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-body-md">
              {filtrados.length ? filtrados.map((a) => (
                <tr key={a.id} className="border-b border-surface-variant hover:bg-surface/50 transition-colors">
                  <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{a.fecha}</td>
                  <td className="py-md px-md font-medium">{a.usuario}</td>
                  <td className="py-md px-md"><span className="inline-flex items-center px-2 py-1 rounded-full bg-surface-container-low border border-outline-variant text-label-sm text-on-surface-variant">{a.tipo}</span></td>
                  <td className="py-md px-md">{a.accion}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-xl text-center text-on-surface-variant">Sin resultados para el filtro seleccionado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-sm border-t border-outline-variant bg-surface-container-lowest">
          <span className="text-label-sm text-on-surface-variant">{filtrados.length} eventos · Registro de solo lectura</span>
        </div>
      </div>
    </>
  );
}

function Filtro({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-xs">
      <label className="text-label-sm text-on-surface-variant uppercase">{label}</label>
      {children}
    </div>
  );
}
