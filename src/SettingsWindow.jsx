import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

function CheckRow({ label, checked, onChange }) {
  return (
    <div
      className="flex items-center gap-2 cursor-pointer select-none"
      style={{ padding: "6px 0" }}
      onClick={() => onChange(!checked)}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 3,
        border: "1.5px solid rgba(255,255,255,0.18)",
        background: checked ? "#181818" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "background 0.1s",
      }}>
        {checked && (
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: checked ? "#d1d5db" : "#6b7280", transition: "color 0.1s", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "5px 0" }} />;
}

function ActionRow({ label, onLeft, onRight, leftLabel = "Scripts", rightLabel = "Autoexec" }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "5px 0" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", whiteSpace: "nowrap" }}>{label}</span>
      <div className="flex gap-1">
        {[{ l: leftLabel, fn: onLeft }, { l: rightLabel, fn: onRight }].map(({ l, fn }) => (
          <FolderBtn key={l} label={l} onClick={fn} />
        ))}
      </div>
    </div>
  );
}

function FolderBtn({ label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontSize: 9, fontWeight: 600,
        padding: "2px 5px", borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.1)",
        background: hov ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        color: hov ? "#e5e7eb" : "#6b7280",
        cursor: "pointer", transition: "all 0.1s", whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function KillRow({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="flex items-center justify-center cursor-pointer select-none"
      style={{ padding: "5px 0" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: hov ? "#f87171" : "#9ca3af", transition: "color 0.1s" }}>
        Kill Roblox
      </span>
    </div>
  );
}

export default function SettingsWindow() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettingsState] = useState({});

  useEffect(() => {
    invoke("load_config").then(cfg => {
      if (cfg) setSettingsState({
        fontSize:         cfg.fontSize         ?? 12,
        fontFamily:       cfg.fontFamily        ?? "JetBrains Mono",
        lineNumbers:      cfg.lineNumbers       ?? true,
        minimap:          cfg.minimap           ?? false,
        wordWrap:         cfg.wordWrap          ?? false,
        autoInject:       cfg.autoInject        ?? false,
        injectDelay:      cfg.injectDelay       ?? 500,
        topMost:          cfg.topMost           ?? true,
        accentColor:      cfg.accentColor       ?? "#e0201a",
        uiRadius:         cfg.uiRadius          ?? 4,
        allowReinject:    cfg.allowReinject      ?? true,
        discordRpc:       cfg.discordRpc        ?? false,
        confirmTabDelete: cfg.confirmTabDelete  ?? false,
        folding:          cfg.folding           ?? true,
      });
    }).catch(() => {});
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const setSetting = (key, value) => {
    setSettingsState(prev => {
      const next = { ...prev, [key]: value };
      invoke("save_config", {
        config: {
          fontSize: next.fontSize ?? 12,
          fontFamily: next.fontFamily ?? "JetBrains Mono",
          lineNumbers: next.lineNumbers ?? true,
          minimap: next.minimap ?? false,
          wordWrap: next.wordWrap ?? false,
          autoInject: next.autoInject ?? false,
          injectDelay: next.injectDelay ?? 500,
          topMost: next.topMost ?? true,
          accentColor: next.accentColor ?? "#e0201a",
          uiRadius: next.uiRadius ?? 4,
          allowReinject: next.allowReinject ?? true,
          discordRpc: next.discordRpc ?? false,
          confirmTabDelete: next.confirmTabDelete ?? false,
          folding: next.folding ?? true,
        }
      }).catch(() => { });
      return next;
    });
  };

  const s = {
    discordRpc: false, confirmTabDelete: false,
    topMost: true, autoInject: false, ...settings,
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", border: "none", overflow: "hidden", opacity: visible ? 1 : 0, transition: "opacity 0.15s ease" }}
    >

      <div data-tauri-drag-region style={{ height: 26, background: "#181818", display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
        <button
          onClick={() => getCurrentWindow().close().catch(() => { })}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          style={{ WebkitAppRegion: "no-drag", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", transition: "color 0.12s", flexShrink: 0 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, background: "#202020", padding: "6px 10px 6px 10px", display: "flex", flexDirection: "column", WebkitAppRegion: "no-drag" }}>
        <CheckRow label="Auto Inject" checked={s.autoInject} onChange={v => setSetting("autoInject", v)} />
        <CheckRow label="Top Most" checked={s.topMost} onChange={v => { setSetting("topMost", v); invoke("set_always_on_top", { enabled: v }).catch(() => { }); }} />
        <CheckRow label="Discord RPC" checked={s.discordRpc} onChange={v => { setSetting("discordRpc", v); invoke("set_discord_rpc", { enabled: v }).catch(() => { }); }} />
        <CheckRow label="Confirm Tab Close" checked={s.confirmTabDelete} onChange={v => setSetting("confirmTabDelete", v)} />
        <Divider />

        <ActionRow
          label="Open"
          onLeft={() => invoke("open_scripts_folder").catch(() => { })}
          onRight={() => invoke("open_autoexec_folder").catch(() => { })}
        />
        <Divider />
        <KillRow onClick={() => invoke("kill_roblox").catch(() => { })} />
      </div>
    </div>
  );
}