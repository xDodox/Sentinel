import React from "react";
import ReactDOM from "react-dom/client";
import Splash from "./Splash";

import "./App.css";

const style = document.createElement("style");
style.textContent = "html, body, #root { background: transparent !important; overflow: hidden !important; }";
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(<Splash />);