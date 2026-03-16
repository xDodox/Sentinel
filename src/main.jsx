import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";

const w = new URLSearchParams(window.location.search).get("w");

async function mount() {
  let Root;
  if (w === "settings") {
    const m = await import("./SettingsWindow");
    Root = m.default;
  } else if (w === "script-hub") {
    const m = await import("./ScriptHubWindow");
    Root = m.default;
  } else {
    const m = await import("./App");
    Root = m.default;
  }
  ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(Root)
  );
}

mount();