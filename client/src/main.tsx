import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import { oidcConfig } from "./auth/authConfig";
import App from "./App";
import "./index.css";
import { initConfig } from "./lib/config";

initConfig().then(() => {
  createRoot(document.getElementById("root")!).render(
    <AuthProvider {...oidcConfig}>
      <App />
    </AuthProvider>,
  );
});
