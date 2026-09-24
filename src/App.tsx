import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Restablecer from "./pages/Restablecer";
import Usuarios from "./pages/Usuarios";
import Ingesta from "./pages/Ingesta";
import Auditoria from "./pages/Auditoria";
import Asistente from "./pages/Asistente";
import Reportes from "./pages/Reportes";
import Descargas from "./pages/Descargas";
import MiCuenta from "./pages/MiCuenta";

function InicioSegunRol() {
  const { autenticado, rol } = useAuth();
  if (!autenticado) return <Navigate to="/login" replace />;
  return <Navigate to={rol === "superadmin" ? "/usuarios" : "/ia"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/restablecer" element={<Restablecer />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* SuperAdmin */}
        <Route path="/usuarios" element={<ProtectedRoute rol="superadmin"><Usuarios /></ProtectedRoute>} />
        <Route path="/ingesta" element={<ProtectedRoute rol="superadmin"><Ingesta /></ProtectedRoute>} />
        <Route path="/auditoria" element={<ProtectedRoute rol="superadmin"><Auditoria /></ProtectedRoute>} />
        {/* Administrador */}
        <Route path="/ia" element={<ProtectedRoute rol="administrador"><Asistente /></ProtectedRoute>} />
        <Route path="/reportes" element={<ProtectedRoute rol="administrador"><Reportes /></ProtectedRoute>} />
        <Route path="/descargas" element={<ProtectedRoute rol="administrador"><Descargas /></ProtectedRoute>} />
        {/* Compartida */}
        <Route path="/mi-cuenta" element={<MiCuenta />} />
      </Route>

      <Route path="/" element={<InicioSegunRol />} />
      <Route path="*" element={<InicioSegunRol />} />
    </Routes>
  );
}
