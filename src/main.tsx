import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
// Fuentes servidas por la propia app (sin depender de Google Fonts: CSP sin dominios externos).
import "@fontsource-variable/inter";
import "material-symbols/outlined.css";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/ToastProvider";
import LoadingOverlay from "./components/LoadingOverlay";
import { aplicarTemaInicial } from "./components/useTema";

aplicarTemaInicial();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Con «reducir movimiento» activo en el sistema, las animaciones quitan desplazamientos y escalas. */}
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <ToastProvider>
        <LoadingOverlay />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    </MotionConfig>
  </StrictMode>
);
