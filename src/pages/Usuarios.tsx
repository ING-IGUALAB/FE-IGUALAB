import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useToast } from "../components/ToastProvider";
import Spinner from "../components/Spinner";
import { useAuth } from "../auth/AuthContext";
import { mensajeError } from "../api/client";
import * as usuariosApi from "../api/usuarios";
import { REGLAS_PASSWORD } from "../lib/password";
import { fechaCorta } from "../lib/format";
import type { Usuario } from "../types";

export default function Usuarios() {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [crearOpen, setCrearOpen] = useState(false);
  const [transferir, setTransferir] = useState<Usuario | null>(null);
  const [toggle, setToggle] = useState<Usuario | null>(null);

  async function cargar() {
    setCargando(true);
    setErrorCarga("");
    try {
      setUsuarios(await usuariosApi.listarUsuarios());
    } catch (err) {
      setErrorCarga(mensajeError(err, "No se pudieron cargar los usuarios."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <SectionHeader
        titulo="Usuarios y roles"
        sub="Ciclo de vida de cuentas. Toda cuenta nueva nace como Administrador; el rol SuperAdmin solo se obtiene por transferencia."
        acciones={
          <button onClick={() => setCrearOpen(true)} className="flex items-center gap-sm px-md py-sm bg-primary text-on-primary rounded-lg text-label-md font-semibold hover:bg-surface-tint transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px]">person_add</span> Crear usuario
          </button>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-surface-variant shadow-sm overflow-hidden">
        {errorCarga && (
          <div className="p-md bg-error-container text-on-error-container text-body-md flex items-center justify-between gap-md">
            <span className="flex items-center gap-sm"><span className="material-symbols-outlined text-[18px]">error</span>{errorCarga}</span>
            <button onClick={cargar} className="flex items-center gap-xs px-md py-1.5 rounded-lg bg-on-error-container/10 hover:bg-on-error-container/20 text-label-md font-semibold">
              <span className="material-symbols-outlined text-[16px]">refresh</span> Reintentar
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {["Usuario", "Correo", "Estado", "Rol", "Creado", "Acciones"].map((h) => (
                  <th key={h} className={`py-sm px-md text-label-sm text-on-surface-variant uppercase tracking-wider ${h === "Acciones" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-body-md">
              {cargando ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-surface-variant">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="py-md px-md"><div className="skeleton h-4" style={{ width: j === 0 ? "60%" : j === 5 ? "40%" : "80%" }} /></td>
                    ))}
                  </tr>
                ))
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={6} className="py-xl text-center text-on-surface-variant">Sin usuarios.</td></tr>
              ) : (
                usuarios.map((u) => {
                  const esSuper = u.rol === "superadmin";
                  return (
                    <tr key={u.id} className="border-b border-surface-variant hover:bg-surface/50 transition-colors">
                      <td className="py-md px-md font-medium">{u.nombre}</td>
                      <td className="py-md px-md text-on-surface-variant">{u.correo}</td>
                      <td className="py-md px-md"><Badge estado={u.habilitado ? "Activo" : "Inactivo"} /></td>
                      <td className="py-md px-md">
                        <span className={`text-label-md ${esSuper ? "text-tertiary font-bold" : "text-secondary font-bold"}`}>
                          {esSuper ? "SuperAdmin" : "Administrador"}
                        </span>
                      </td>
                      <td className="py-md px-md text-on-surface-variant">{fechaCorta(u.creado_en)}</td>
                      <td className="py-md px-md text-right">
                        <div className="flex justify-end gap-xs">
                          <button
                            onClick={() => setToggle(u)}
                            disabled={esSuper}
                            title={esSuper ? "El SuperAdmin no puede deshabilitarse" : u.habilitado ? "Deshabilitar" : "Habilitar"}
                            className={`p-1.5 rounded-lg ${esSuper ? "text-outline-variant cursor-not-allowed" : "text-on-surface-variant hover:text-tertiary hover:bg-tertiary-fixed/20"}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">{u.habilitado ? "person_off" : "how_to_reg"}</span>
                          </button>
                          <button
                            onClick={() => setTransferir(u)}
                            disabled={esSuper || !u.habilitado}
                            title={esSuper ? "Ya es SuperAdmin" : !u.habilitado ? "Requiere cuenta habilitada" : "Transferir rol SuperAdmin"}
                            className={`p-1.5 rounded-lg ${esSuper || !u.habilitado ? "text-outline-variant cursor-not-allowed" : "text-on-surface-variant hover:text-tertiary hover:bg-tertiary-fixed/20"}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-sm border-t border-outline-variant bg-surface-container-lowest">
          <span className="text-label-sm text-on-surface-variant">{usuarios.length} cuentas · Exactamente una es SuperAdmin · Deshabilitar cierra sus sesiones y preserva el historial.</span>
        </div>
      </div>

      <CrearUsuarioModal open={crearOpen} onClose={() => setCrearOpen(false)} onCreado={cargar} />
      <ToggleModal usuario={toggle} onClose={() => setToggle(null)} onHecho={cargar} />
      <TransferirModal usuario={transferir} onClose={() => setTransferir(null)} />
    </>
  );
}

function CrearUsuarioModal({ open, onClose, onCreado }: { open: boolean; onClose: () => void; onCreado: () => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const reglas = useMemo(() => REGLAS_PASSWORD.map((r) => ({ msg: r.msg, ok: r.ok(password, correo) })), [password, correo]);

  function reset() {
    setNombre(""); setCorreo(""); setPassword(""); setError("");
  }

  async function guardar() {
    setError("");
    if (!nombre.trim() || !correo.trim()) return setError("Nombre y correo son obligatorios.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return setError("Formato de correo inválido.");
    if (!reglas.every((r) => r.ok)) return setError("La contraseña no cumple la política de seguridad.");
    setCargando(true);
    try {
      await usuariosApi.crearUsuario({ nombre: nombre.trim(), correo: correo.trim(), password });
      toast("Cuenta creada como Administrador.", "success");
      reset();
      onClose();
      onCreado();
    } catch (err) {
      setError(mensajeError(err, "No se pudo crear la cuenta."));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-xl">
        <h3 className="text-title-lg text-on-background mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">person_add</span> Crear usuario
        </h3>
        <div className="space-y-md">
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant">Nombre completo</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Ej. Ana García" />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant">Correo electrónico</label>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="ana@igualab.com" />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-label-md text-on-surface-variant">Contraseña</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-outline-variant py-sm px-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Mín. 8 · mayús., minús., dígito y símbolo" />
            <ul className="grid grid-cols-2 gap-xs text-label-sm mt-xs">
              {reglas.map((r) => (
                <li key={r.msg} className={`flex items-center gap-xs ${r.ok ? "text-primary" : "text-on-surface-variant"}`}>
                  <span className="material-symbols-outlined text-[16px]">{r.ok ? "check_circle" : "radio_button_unchecked"}</span>
                  {r.msg}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-sm rounded-lg bg-surface-container-low p-sm border border-outline-variant">
            <span className="material-symbols-outlined text-secondary text-[18px]">badge</span>
            <p className="text-label-sm text-on-surface-variant">La cuenta se crea con rol <strong className="text-on-surface">Administrador</strong>.</p>
          </div>
          {error && <div className="rounded-lg bg-error-container text-on-error-container px-md py-sm text-body-md">{error}</div>}
        </div>
        <div className="flex justify-end gap-sm mt-lg">
          <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant hover:bg-surface-container-low">Cancelar</button>
          <button onClick={guardar} disabled={cargando} className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-surface-tint disabled:opacity-60 flex items-center gap-sm">{cargando && <Spinner size={16} />}{cargando ? "Creando…" : "Crear"}</button>
        </div>
      </div>
    </Modal>
  );
}

function ToggleModal({ usuario, onClose, onHecho }: { usuario: Usuario | null; onClose: () => void; onHecho: () => void }) {
  const toast = useToast();
  const [cargando, setCargando] = useState(false);
  if (!usuario) return null;
  const habilitar = !usuario.habilitado;

  async function confirmar() {
    setCargando(true);
    try {
      if (habilitar) await usuariosApi.habilitarUsuario(usuario!.id);
      else await usuariosApi.deshabilitarUsuario(usuario!.id);
      toast(`Cuenta ${habilitar ? "habilitada" : "deshabilitada"}.`, "success");
      onClose();
      onHecho();
    } catch (err) {
      toast(mensajeError(err, "No se pudo actualizar la cuenta."), "error");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal open={!!usuario} onClose={onClose}>
      <div className="p-xl text-center">
        <span className={`material-symbols-outlined text-[48px] ${habilitar ? "text-primary" : "text-tertiary"}`}>{habilitar ? "how_to_reg" : "person_off"}</span>
        <h3 className="text-title-lg text-on-background mt-md">{habilitar ? "Habilitar" : "Deshabilitar"} a {usuario.nombre}?</h3>
        <p className="text-body-md text-on-surface-variant mt-sm">
          {habilitar ? "La cuenta recuperará el acceso a la plataforma." : "Perderá acceso inmediato y se cerrarán sus sesiones activas."}
        </p>
        <div className="flex justify-center gap-sm mt-lg">
          <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant">Cancelar</button>
          <button onClick={confirmar} disabled={cargando} className={`px-lg py-sm rounded-lg text-label-md font-semibold disabled:opacity-60 flex items-center gap-sm ${habilitar ? "bg-primary text-on-primary" : "bg-tertiary text-on-tertiary"}`}>{cargando && <Spinner size={16} />}{cargando ? "Procesando…" : habilitar ? "Habilitar" : "Deshabilitar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function TransferirModal({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { actualizarRol } = useAuth();
  const [cargando, setCargando] = useState(false);
  if (!usuario) return null;

  async function confirmar() {
    setCargando(true);
    try {
      await usuariosApi.transferirSuperadmin(usuario!.id);
      // Tras la transferencia, la cuenta actual pasa a Administrador (RF-050).
      toast(`Rol SuperAdmin transferido a ${usuario!.nombre}. Ahora eres Administrador.`, "success");
      actualizarRol("administrador"); // actualiza sesión + localStorage
      onClose();
      // Ya no tiene permiso sobre /usuarios: no re-consultar; redirigir a /ia.
      navigate("/ia", { replace: true });
    } catch (err) {
      toast(mensajeError(err, "No se pudo transferir el rol."), "error");
      setCargando(false);
    }
  }

  return (
    <Modal open={!!usuario} onClose={onClose}>
      <div className="p-xl text-center">
        <span className="material-symbols-outlined text-[48px] text-tertiary">swap_horiz</span>
        <h3 className="text-title-lg text-on-background mt-md">Transferir rol SuperAdmin</h3>
        <p className="text-body-md text-on-surface-variant mt-sm">
          Se transferirá el rol <strong>SuperAdmin</strong> a <strong>{usuario.nombre}</strong>. La operación es atómica: tu cuenta pasará a Administrador.
        </p>
        <div className="flex justify-center gap-sm mt-lg">
          <button onClick={onClose} className="px-lg py-sm rounded-lg border border-outline-variant text-body-md text-on-surface-variant">Cancelar</button>
          <button onClick={confirmar} disabled={cargando} className="px-lg py-sm rounded-lg bg-tertiary text-on-tertiary text-label-md font-semibold disabled:opacity-60 flex items-center gap-sm">{cargando && <Spinner size={16} />}{cargando ? "Transfiriendo…" : "Confirmar transferencia"}</button>
        </div>
      </div>
    </Modal>
  );
}
