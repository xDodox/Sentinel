import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

function str(val) {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") return val.title || val.name || val._id || "";
  return "";
}

function normalizeScript(s) {
  const id = str(s._id || s.id);
  return {
    _id: id || Math.random().toString(),
    title: str(s.title),
    image: str(s.imgurl || s.image || s.img),
    rawScript: str(s.rawScript || s.script_url || s.url),
    description: str(s.description || s.desc).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    game: str(typeof s.gameLink === "object" ? s.gameLink?.title : s.gameLink) || str(s.game),
    views: typeof s.views === "number" ? s.views : null,
    verified: !!s.verified,
    pageUrl: str(s.pageUrl || s.page_url) || (id ? `https://rscripts.net/script/${id}` : ""),
  };
}

export default function ScriptHubWindow() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [scriptCode, setScriptCode] = useState(null);
  const searchTimer = useRef(null);

  const fetchScripts = (q = "") => {
    setLoading(true);
    invoke("fetch_rscripts", { page: 1, query: q })
      .then(res => {
        const raw = res?.scripts || res || [];
        setScripts(Array.isArray(raw) ? raw.map(normalizeScript) : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchScripts(); }, []);

  const selectScript = (s) => {
    setSelected(s);
    setScriptCode(null);
    if (!s.rawScript) { setFetching(false); return; }
    setFetching(true);
    invoke("fetch_url_content", { url: s.rawScript })
      .then(code => { setScriptCode(code); setFetching(false); })
      .catch(() => { setScriptCode(null); setFetching(false); });
  };

  const handleExecute = () => {
    if (scriptCode) invoke("execute_script", { code: scriptCode }).catch(console.error);
  };

  const handleOpenTab = async () => {
    if (!scriptCode || !selected) return;
    try {
      await emit("hub-open-tab", { name: selected.title, code: scriptCode });
      const m = await import("@tauri-apps/api/window");
      m.getCurrentWindow().close();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    if (!scriptCode || !selected) return;
    invoke("save_script", { name: selected.title, code: scriptCode }).catch(console.error);
  };

  return (
    <div style={{
      width: "100vw", height: "100vh",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      background: "#202020",
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      color: "white",
    }}>

      <div
        data-tauri-drag-region
        style={{
          height: 28, background: "#1a1a1a",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => import("@tauri-apps/api/window").then(m => m.getCurrentWindow().close())}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          style={{
            WebkitAppRegion: "no-drag",
            width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.3)", cursor: "pointer",
            transition: "color 0.12s", outline: "none", flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>


        <div style={{
          width: 165, flexShrink: 0,
          background: "#202020",
          display: "flex", flexDirection: "column",
          padding: "8px",
          gap: 6,
        }}>

          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#181818",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 4, padding: "5px 8px",
            flexShrink: 0,
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => fetchScripts(e.target.value), 400);
              }}
              placeholder="Search..."
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 10, color: "#d1d5db", width: "100%" }}
            />
          </div>

          <div style={{
            flex: 1,
            background: "#181818",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 4,
            overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none", padding: "4px" }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", paddingTop: 24 }}>
                  <Spinner color="var(--accent, #e0201a)" size={16} />
                </div>
              ) : scripts.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 10, color: "#4b5563", paddingTop: 24 }}>
                  No scripts
                </div>
              ) : scripts.map(s => {
                const active = selected?._id === s._id;
                return (
                  <div
                    key={s._id}
                    onClick={() => selectScript(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "6px 6px", borderRadius: 3,
                      marginBottom: 1,
                      background: active ? "rgba(255,255,255,0.08)" : "transparent",
                      border: active ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                      cursor: "pointer", transition: "background 0.1s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}>
                      {s.image && (
                        <img src={s.image} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={e => { e.currentTarget.style.display = "none"; }} />
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: active ? "#e5e7eb" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 8, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase" }}>rscripts.net</span>
          </div>
        </div>


        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "8px 10px 8px 10px", gap: 6 }}>
          {selected ? (
            <>

              <div style={{
                flexShrink: 0,
                background: "#181818",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 5,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}>

                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>

                  <div style={{
                    width: 52, height: 52,
                    borderRadius: 6, overflow: "hidden",
                    flexShrink: 0,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    {selected.image ? (
                      <img src={selected.image} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: "#f3f4f6",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      lineHeight: 1.3,
                    }}>
                      {selected.title}
                    </div>

                    {selected.game && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                        </svg>
                        <span style={{ fontSize: 9, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {selected.game}
                        </span>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {selected.views != null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                          <span style={{ fontSize: 9, color: "#4b5563" }}>{selected.views.toLocaleString()}</span>
                        </div>
                      )}
                      {selected.verified && (
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          <span style={{ fontSize: 9, color: "#4ade80" }}>Verified</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selected.description && selected.description.length > 0 && (
                  <div style={{
                    fontSize: 9, color: "#6b7280",
                    lineHeight: 1.6,
                    wordBreak: "break-word",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    paddingTop: 7,
                    maxHeight: 52,
                    overflow: "hidden",
                  }}>
                    {selected.description.slice(0, 220)}{selected.description.length > 220 ? "…" : ""}
                  </div>
                )}
              </div>


              <div style={{
                flex: 1,
                background: "#181818",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 5,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}>

                <div style={{
                  padding: "5px 9px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#374151" }}>
                    Preview
                  </span>
                </div>

                <div style={{ flex: 1, overflow: "hidden", padding: "7px 10px" }}>
                  {fetching ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, height: "100%" }}>
                      <Spinner color="var(--accent, #e0201a)" size={11} />
                      <span style={{ fontSize: 9, color: "#4b5563" }}>Loading...</span>
                    </div>
                  ) : scriptCode ? (
                    <pre style={{
                      fontSize: 9, color: "#6b7280",
                      fontFamily: "JetBrains Mono, Consolas, monospace",
                      whiteSpace: "pre-wrap", wordBreak: "break-all",
                      margin: 0,
                      overflow: "hidden",
                      lineHeight: 1.55,
                      height: "100%",
                    }}>
                      {scriptCode.slice(0, 500)}{scriptCode.length > 500 ? "\n…" : ""}
                    </pre>
                  ) : (
                    <span style={{ fontSize: 9, color: "#374151" }}>Could not load script.</span>
                  )}
                </div>
              </div>


              <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                <ActionBtn label="Execute" onClick={handleExecute} disabled={!scriptCode} accent />
                <ActionBtn label="Save" onClick={handleSave} disabled={!scriptCode} />
                <ActionBtn label="Open in Tab" onClick={handleOpenTab} disabled={!scriptCode} />
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0.25 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>Select a script</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #4b5563 !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function Spinner({ color = "#e0201a", size = 14 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: "2px solid transparent",
      borderTopColor: color,
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

function ActionBtn({ label, onClick, disabled, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 20,
        padding: "0 8px",
        fontSize: 9,
        fontWeight: 600, borderRadius: 3,
        border: accent ? "none" : "1px solid rgba(255,255,255,0.08)",
        background: accent
          ? (disabled ? "rgba(224,32,26,0.2)" : hov ? "var(--accent, #e0201a)" : "rgba(224,32,26,0.8)")
          : (hov && !disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"),
        color: accent ? "white" : (disabled ? "#2d3748" : hov ? "#e5e7eb" : "#9ca3af"),
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.1s", whiteSpace: "nowrap",
        opacity: disabled && !accent ? 0.35 : 1,
      }}
    >
      {label}
    </button>
  );
}