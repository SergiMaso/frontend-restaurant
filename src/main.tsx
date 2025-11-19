import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Inicialitzar i18n abans de renderitzar

createRoot(document.getElementById("root")!).render(<App />);
