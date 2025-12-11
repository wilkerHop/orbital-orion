import React from "react";
import ReactDOM from "react-dom/client";
import { Popup } from "./popup/Popup.tsx";
import "./popup/styles.css";

const rootElement = document.getElementById("root");

if (rootElement !== null) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
