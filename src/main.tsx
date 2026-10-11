import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WarehouseApp } from "./WarehouseApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WarehouseApp />
  </StrictMode>,
);
