import React, { useState } from "react";
import TitanAIInterviewer from "./TitanAIInterviewer.jsx";
import VortexLink from "./VortexLink.jsx";

export default function App() {
  const [active, setActive] = useState("vortex"); // "vortex" | "titan"

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          gap: 6,
          background: "rgba(10,10,14,0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 999,
          padding: 4,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11,
        }}
      >
        <button
          onClick={() => setActive("vortex")}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            color: active === "vortex" ? "#030206" : "rgba(255,255,255,0.5)",
            background: active === "vortex" ? "linear-gradient(90deg,#00E5FF,#7000FF)" : "transparent",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          VORTEX LINK
        </button>
        <button
          onClick={() => setActive("titan")}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            color: active === "titan" ? "#030206" : "rgba(255,255,255,0.5)",
            background: active === "titan" ? "linear-gradient(90deg,#FF3B30,#00E5FF)" : "transparent",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          TITAN AI
        </button>
      </div>

      {active === "vortex" ? <VortexLink /> : <TitanAIInterviewer />}
    </div>
  );
}
