import { Navigate, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { Rol } from "../types";

export default function ProtectedRoute({
  children,
  rol,
}: {
  children: ReactNode;
  rol?: Rol;
}) {
  const { autenticado, rol: rolActual } = useAuth();
  const location = useLocation();

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (rol && rolActual !== rol) {
    // Redirige a la primera vista permitida de su rol.
    return <Navigate to={rolActual === "superadmin" ? "/usuarios" : "/ia"} replace />;
  }
  return <>{children}</>;
}
