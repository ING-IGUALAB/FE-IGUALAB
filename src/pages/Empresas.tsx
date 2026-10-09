import { useCallback, useEffect, useState, type ReactNode } from "react";
import SectionHeader from "../components/SectionHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import * as empresasApi from "../api/empresas";
import { mensajeError } from "../api/client";
import { SECTORES_API, etiquetaSector } from "../lib/dominio";
import type { EmpresaApi, SectorApi } from "../types";

const SKELETON = ["s1", "s2", "s3", "s4"];

export default function Empresas() {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sector, setSector] = useState<"" | SectorApi>("");
  const [soloActivas, setSoloActivas] = useState(false);
  const [crearOpen, setCrearOpen] = useState(false);
  const [editando, setEditando] = useState<EmpresaApi | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await empresasApi.listarEmpresas({
        soloActivas,
        sector: sector || undefined,
      });
      setEmpresas(data);
    } catch (err) {
      toast(mensajeError(err, "No se pudieron cargar las empresas."), "error");
    } finally {
      setCargando(false);
    }
  }, [sector, soloActivas, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(empresa: EmpresaApi) {
    try {
      const actualizada = empresa.activa
        ? await empresasApi.desactivarEmpresa(empresa.id)
        : await empresasApi.activarEmpresa(empresa.id);
      setEmpresas((prev) => prev.map((e) => (e.id === actualizada.id ? actualizada : e)));
      toast(`Empresa ${actualizada.activa ? "activada" : "desactivada"}.`, "success");
    } catch (err) {
      toast(mensajeError(err, "No se pudo cambiar el estado."), "error");
    }
  }

  return (
    <>
      <SectionHeader
        titulo="Catálogo de empresas"
        sub="Registra y administra las empresas emisoras de la Bolsa de Valores de Lima que serán analizadas (RN-014, RN-019)."
      />

      <div className="flex flex-col sm:flex-row sm:items-end gap-md justify-between">
        <div className="flex flex-wrap items-end gap-md">
          <Campo label="Sector">
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as "" | SectorApi)}
              className="rounded-lg border border-outline-variant bg-surface-container-low py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">Todos</option>
              {SECTORES_API.map((s) => (
                <option key={s} value={s}>{etiquetaSector(s)}</option>
              ))}
            </select>
          </Campo>
          <label className="flex items-center gap-sm text-body-md text-on-surface-variant pb-sm cursor-pointer">
            <input type="checkbox" checked={soloActivas} onChange={(e) => setSoloActivas(e.target.checked)} className="accent-primary w-4 h-4" />
            Sólo activas
          </label>
        </div>
        <button
          onClick={() => setCrearOpen(true)}
          className="flex items-center justify-center gap-sm px-md py-sm bg-primary text-on-primary rounded-lg text-label-md font-semibold hover:bg-surface-tint transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add_business</span> Agregar empresa
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {["Empresa", "Sector", "Estado", "Registrada", "Acciones"].map((h) => (
                  <th key={h} className="py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-body-md">
              {cargando && SKELETON.map((k) => (
                <tr key={k} className="border-b border-surface-variant">
                  <td colSpan={5} className="py-md px-md"><div className="h-5 bg-surface-variant rounded animate-pulse" /></td>
                </tr>
              ))}
              {!cargando && empresas.length === 0 && (
                <tr><td colSpan={5} className="py-xl px-md text-center text-on-surface-variant">No hay empresas que coincidan con el filtro.</td></tr>
              )}
              {!cargando && empresas.map((e) => (
                <tr key={e.id} className="border-b border-surface-variant hover:bg-surface/50 transition-colors">
                  <td className="py-md px-md font-medium text-on-background">{e.nombre}</td>
                  <td className="py-md px-md text-on-surface-variant">{etiquetaSector(e.sector)}</td>
                  <td className="py-md px-md">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-label-sm ${e.activa ? "bg-primary-container text-on-primary-container" : "bg-surface-variant text-on-surface-variant"}`}>
                      {e.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="py-md px-md text-on-surface-variant whitespace-nowrap">{fechaCorta(e.creada_en)}</td>
                  <td className="py-md px-md">
                    <div className="flex items-center gap-sm">
                      <button onClick={() => setEditando(e)} className="text-primary hover:underline text-label-md flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[16px]">edit</span> Editar
                      </button>
                      <button onClick={() => cambiarEstado(e)} className={`text-label-md flex items-center gap-xs hover:underline ${e.activa ? "text-error" : "text-primary"}`}>
                        <span className="material-symbols-outlined text-[16px]">{e.activa ? "block" : "check_circle"}</span>
                        {e.activa ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EmpresaModal
        modo="crear"
        abierto={crearOpen}
        onClose={() => setCrearOpen(false)}
        onGuardado={() => { setCrearOpen(false); cargar(); }}
      />
      <EmpresaModal
        modo="editar"
        empresa={editando}
        abierto={editando !== null}
        onClose={() => setEditando(null)}
        onGuardado={() => { setEditando(null); cargar(); }}
      />
    </>
  );
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-PE", { dateStyle: "medium" });
}

function Campo({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      {children}
    </div>
  );
}

function EmpresaModal({
  modo,
  empresa,
  abierto,
  onClose,
  onGuardado,
}: Readonly<{
  modo: "crear" | "editar";
  empresa?: EmpresaApi | null;
  abierto: boolean;
  onClose: () => void;
  onGuardado: () => void;
}>) {
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [sector, setSector] = useState<SectorApi>(SECTORES_API[0]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setNombre(empresa?.nombre ?? "");
      setSector(empresa?.sector ?? SECTORES_API[0]);
      setError("");
    }
  }, [abierto, empresa]);

  async function guardar() {
    setError("");
    if (!nombre.trim()) {
      setError("El nombre es obligatorio (RF-053).");
      return;
    }
    setCargando(true);
    try {
      if (modo === "crear") {
        await empresasApi.crearEmpresa({ nombre: nombre.trim(), sector });
        toast(`Empresa '${nombre.trim()}' registrada.`, "success");
      } else if (empresa) {
        await empresasApi.editarEmpresa(empresa.id, { nombre: nombre.trim(), sector });
        toast("Empresa actualizada.", "success");
      }
      onGuardado();
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar la empresa."));
    } finally {
      setCargando(false);
    }
  }

  const titulo = modo === "crear" ? "Agregar empresa" : "Editar empresa";
  const accion = modo === "crear" ? "Registrar" : "Guardar cambios";

  return (
    <Modal open={abierto} onClose={onClose}>
      <div className="p-xl">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">{modo === "crear" ? "add_business" : "edit"}</span> {titulo}
        </h3>
        <div className="space-y-md">
          <label className="flex flex-col gap-xs">
            <span className="text-label-md text-on-surface-variant">Nombre de la empresa</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="Ej. Compañía Minera del Norte S.A.A."
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-label-md text-on-surface-variant">Sector (RN-019)</span>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as SectorApi)}
              className="w-full rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            >
              {SECTORES_API.map((s) => (
                <option key={s} value={s}>{etiquetaSector(s)}</option>
              ))}
            </select>
          </label>
          {error && <div className="rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">{error}</div>}
        </div>
        <div className="flex justify-end gap-sm mt-lg">
          <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low">Cancelar</button>
          <button onClick={guardar} disabled={cargando} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint disabled:opacity-60 flex items-center gap-sm">
            {cargando && <Spinner size={16} />}{cargando ? "Guardando…" : accion}
          </button>
        </div>
      </div>
    </Modal>
  );
}
