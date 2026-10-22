import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Fuentes servidas por la propia app (sin depender de Google Fonts: CSP sin dominios externos).
import "@fontsource-variable/inter";
import "material-symbols/outlined.css";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/ToastProvider";
import LoadingOverlay from "./components/LoadingOverlay";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <LoadingOverlay />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
