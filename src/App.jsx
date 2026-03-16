import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Editor from "@monaco-editor/react";

import logo from "./assets/Sentinel.png";
import "./editor.css";
import { setupLuau, MONACO_OPTIONS } from "./luau";

const appWindow = getCurrentWindow();

function getNextTabName(existing) {
  let n = 1;
  while (existing.includes(`New Tab ${n}`)) n++;
  return `New Tab ${n}`;
}

function parseLogLine(s) {
  const tsMatch = s.match(/^\[([^\]]+)\]/);
  const timestamp = tsMatch ? tsMatch[1] : null;
  const rest = tsMatch ? s.slice(tsMatch[0].length).trim() : s;
  const lvlMatch = rest.match(/^\[([A-Z]+)\]\s*/i);
  const level = lvlMatch ? lvlMatch[1].toUpperCase() : null;
  const message = lvlMatch ? rest.slice(lvlMatch[0].length) : rest;
  const cleanMsg = s.includes("[SH] ") ? message.replace(/^\[SH\]\s*/, "") : message;
  const levelStyles = {
    OK: { text: "text-emerald-400", label: "OK", color: "#4ade80" },
    ERR: { text: "text-red-400", label: "ERR", color: "#f87171" },
    WARN: { text: "text-yellow-400", label: "WARN", color: "#facc15" },
    INFO: { text: "text-gray-400", label: "INFO", color: "#9ca3af" },
    DEBUG: { text: "text-gray-700", label: null, color: null },
  };
  const style = levelStyles[level] || { text: "text-gray-400", label: null, color: null };
  return { timestamp, level, message: cleanMsg, style };
}

function CloseConfirmDialog({ tabName, onDiscard, onCancel }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.13, ease: "easeOut" }}
        style={{
          width: 210, background: "#202020",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, padding: "18px 16px 14px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          textAlign: "center",
        }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>Close tab?</div>
          <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.5 }}>
            Are you sure you want to close
            <span style={{ color: "#9ca3af", fontWeight: 600 }}> "{tabName}"</span>?
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <button onClick={onCancel}
            style={{ height: 28, padding: "0 14px", fontSize: 10, fontWeight: 500, cursor: "pointer", borderRadius: 5, border: "none", background: "rgba(255,255,255,0.06)", color: "#9ca3af", fontFamily: "inherit", transition: "all 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#ffffff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#9ca3af"; }}>
            Cancel
          </button>
          <button onClick={onDiscard}
            style={{ height: 28, padding: "0 14px", fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: 5, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.15)", color: "#f87171", fontFamily: "inherit", transition: "all 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.25)"; e.currentTarget.style.color = "#fca5a5"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "#f87171"; }}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {

  const editorRef = useRef(null);
  const editorWrapRef = useRef(null);
  const fileInputRef = useRef(null);
  const settingsRef = useRef({});
  const settingsLoaded = useRef(false);
  const sessionLoaded = useRef(false);
  const saveSessionTimer = useRef(null);
  const pendingHubCodeRef = useRef(null);
  const attachRef = useRef(null);
  const isAttachingRef = useRef(false);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);
  const termDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(0);
  const termDivRef = useRef(null);
  const tabBarRef = useRef(null);
  const dragStateRef = useRef(null);
  const tabWidthsSnap = useRef([]);



  const [tabs, setTabs] = useState(["Output"]);
  const [activeTab, setActiveTab] = useState("Output");
  const [codes, setCodes] = useState({});
  const [modifiedTabs, setModifiedTabs] = useState(new Set());
  const [hoveredTab, setHoveredTab] = useState(null);
  const [closeConfirm, setCloseConfirm] = useState(null);
  const [dragState, setDragState] = useState(null);


  const [localScripts, setLocalScripts] = useState([]);
  const [activeScript, setActiveScript] = useState("");
  const [renamingScript, setRenamingScript] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");


  const [logs, setLogs] = useState([]);
  const [terminalHeight, setTerminalHeight] = useState(130);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);


  const [isInjected, setIsInjected] = useState(false);
  const isInjectedRef = useRef(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);


  const [settings, setSettings] = useState(() => {
    const d = {
      fontSize: 12, fontFamily: "JetBrains Mono",
      lineNumbers: true, minimap: false, wordWrap: false, folding: true,
      autoInject: false, injectDelay: 500, topMost: true,
      accentColor: "#e0201a", uiRadius: 4,
      discordRpc: false, allowReinject: true, confirmTabDelete: false,
    };
    settingsRef.current = d;
    return d;
  });

  const setSetting = (key, val) => setSettings(s => {
    const next = { ...s, [key]: val };
    settingsRef.current = next;
    return next;
  });


  const accentStyles = useMemo(() => {
    const color = settings.accentColor || "#e0201a";
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const rgba = (a) => `rgba(${r},${g},${b},${a})`;
    const R = settings.uiRadius ?? 4;
    return `:root {
      --accent: ${color};
      --accent-glow: ${rgba(0.2)};
      --accent-border: ${rgba(0.35)};
      --accent-bg: ${rgba(0.08)};
      --radius: ${R}px;
      --radius-lg: ${Math.min(12, R * 2)}px;
    }`;
  }, [settings.accentColor, settings.uiRadius]);


  const forceEditorLayout = () => {
    const wrap = editorWrapRef.current;
    if (!wrap || !editorRef.current) return;
    const { width, height } = wrap.getBoundingClientRect();
    if (width > 0 && height > 0) editorRef.current.layout({ width, height });
  };

  const addLog = (level, msg) => {
    const t = new Date().toLocaleTimeString();
    setLogs(p => {
      const n = [...p, `[${t}][${level}] ${msg}`];
      return n.length > 1000 ? n.slice(-1000) : n;
    });
  };

  const refreshScripts = async () => {
    try { setLocalScripts(await invoke("get_local_scripts")); } catch { }
  };


  useEffect(() => {
    if (!settingsLoaded.current) return;
    invoke("save_config", {
      config: {
        fontSize: settings.fontSize, fontFamily: settings.fontFamily,
        lineNumbers: settings.lineNumbers, minimap: settings.minimap,
        wordWrap: settings.wordWrap, autoInject: settings.autoInject,
        injectDelay: settings.injectDelay, topMost: settings.topMost,
        accentColor: settings.accentColor, uiRadius: settings.uiRadius ?? 4,
        allowReinject: settings.allowReinject, discordRpc: settings.discordRpc,
        confirmTabDelete: settings.confirmTabDelete, folding: settings.folding,
      }
    }).catch(console.error);
  }, [settings]);


  useEffect(() => {
    if (!sessionLoaded.current) return;
    clearTimeout(saveSessionTimer.current);
    saveSessionTimer.current = setTimeout(() => {
      const live = editorRef.current ? editorRef.current.getValue() : null;
      const sessionTabs = tabs.filter(t => t !== "Output").map(t => ({
        name: t,
        code: (t === activeTab && live !== null) ? live : (codes[t] || ""),
        active: t === activeTab,
      }));
      invoke("save_session", { session: { tabs: sessionTabs } }).catch(console.error);
    }, 500);
  }, [tabs, codes, activeTab]);


  useEffect(() => {
    if (settings.topMost !== undefined)
      invoke("set_always_on_top", { enabled: settings.topMost }).catch(() => { });
  }, [settings.topMost]);

  useEffect(() => {
    if (settingsLoaded.current)
      invoke("set_discord_rpc", { enabled: settings.discordRpc }).catch(() => { });
  }, [settings.discordRpc]);


  useEffect(() => {
    if (!autoScroll) return;
    const el = logsContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll]);

  useEffect(() => {
    const el = logsContainerRef.current;
    if (!el) return;
    const onScroll = () => setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);


  useEffect(() => {
    const wrap = editorWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => forceEditorLayout());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);


  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions(MONACO_OPTIONS(settings));
    if (window.__monaco) {
      const color = settings.accentColor || "#e0201a";
      const hex = color.replace("#", "");
      window.__monaco.editor.defineTheme("sirhurt", {
        base: "vs-dark", inherit: false,
        rules: [
          { token: "", foreground: "c9d1d9" },
          { token: "comment", foreground: "3d4a5a", fontStyle: "italic" },
          { token: "keyword", foreground: hex, fontStyle: "bold" },
          { token: "type", foreground: "4ec9b0" },
          { token: "string", foreground: "ce9178" },
          { token: "string.escape", foreground: "d7ba7d" },
          { token: "number", foreground: "b5cea8" },
          { token: "identifier", foreground: "c9d1d9" },
          { token: "operator", foreground: "c9d1d9" },
          { token: "delimiter", foreground: "ffd700" },
        ],
        colors: {
          "editor.background": "#181818",
          "editor.foreground": "#c9d1d9",
          "editor.lineHighlightBackground": `${color}0a`,
          "editor.lineHighlightBorder": `${color}18`,
          "editor.selectionBackground": "#4a90d960",
          "editor.inactiveSelectionBackground": "#4a90d930",
          "editorLineNumber.foreground": "#999999",
          "editorLineNumber.activeForeground": "#ffffff",
          "editorCursor.foreground": color,
          "editor.wordHighlightBackground": "#4a90d930",
          "editor.wordHighlightBorder": "#4a90d960",
          "editor.wordHighlightStrongBackground": "#4a90d945",
          "editor.wordHighlightStrongBorder": "#4a90d975",
          "editorGutter.background": "#181818",
          "minimap.background": "#202020",
          "minimapSlider.background": `${color}28`,
          "scrollbarSlider.background": `${color}25`,
          "scrollbarSlider.hoverBackground": `${color}40`,
          "editorSuggestWidget.background": "#202020",
          "editorSuggestWidget.border": `${color}35`,
          "editorSuggestWidget.selectedBackground": `${color}28`,
          "editorHoverWidget.background": "#202020",
          "editorHoverWidget.border": `${color}35`,
          "editorOverviewRuler.border": "#00000000",
        },
      });
      window.__monaco.editor.setTheme("sirhurt");
    }
    requestAnimationFrame(forceEditorLayout);
  }, [settings]);


  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "F5") { e.preventDefault(); execute(); return; }
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); saveScript(); }
    };
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      const wrap = editorWrapRef.current;
      if (!wrap) return;
      const { left, right, top, bottom } = wrap.getBoundingClientRect();
      if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return;
      e.preventDefault();
      setSettings(s => ({ ...s, fontSize: e.deltaY < 0 ? Math.min(20, s.fontSize + 1) : Math.max(10, s.fontSize - 1) }));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [codes, activeTab]);


  const handleTermDrag = (e) => {
    if (terminalCollapsed) return;
    termDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = terminalHeight;
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!termDraggingRef.current) return;
      const newH = Math.min(380, Math.max(48, startHRef.current + (startYRef.current - e.clientY)));
      if (termDivRef.current) termDivRef.current.style.height = newH + "px";
    };
    const onUp = (e) => {
      if (!termDraggingRef.current) return;
      termDraggingRef.current = false;
      setTerminalHeight(Math.min(380, Math.max(48, startHRef.current + (startYRef.current - e.clientY))));
      forceEditorLayout();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);


  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);



  const pendingDragRef = useRef(null);
  const autoScrollRef = useRef(null);

  const handleTabMouseDown = (e, idx) => {
    if (tabs[idx] === "Output" || e.button !== 0) return;
    const bar = tabBarRef.current;
    if (!bar) return;
    e.preventDefault();
    const children = Array.from(bar.querySelectorAll("[data-tab]"));
    tabWidthsSnap.current = children.map(c => c.getBoundingClientRect().width);
    const grabOffsetX = children[idx] ? e.clientX - children[idx].getBoundingClientRect().left : 0;
    pendingDragRef.current = { idx, label: tabs[idx], startX: e.clientX, grabOffsetX };
  };

  useEffect(() => {
    const stopAutoScroll = () => {
      if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null; }
    };
    const cancel = () => {
      pendingDragRef.current = null;
      dragStateRef.current = null;
      setDragState(null);
      stopAutoScroll();
    };

    const onMove = (e) => {
      const bar = tabBarRef.current;
      if (!bar) return;


      if (pendingDragRef.current && !dragStateRef.current) {
        if (Math.abs(e.clientX - pendingDragRef.current.startX) < 5) return;
        const { idx, label, grabOffsetX } = pendingDragRef.current;
        const state = { idx, overIdx: idx, label, x: e.clientX, grabOffsetX };
        pendingDragRef.current = null;
        dragStateRef.current = state;
        setDragState({ ...state });
        return;
      }

      const cur = dragStateRef.current;
      if (!cur) return;


      const children = Array.from(bar.querySelectorAll("[data-tab]"));
      let closest = cur.overIdx, minDist = Infinity;
      let runX = bar.getBoundingClientRect().left - bar.scrollLeft;
      children.forEach((child, i) => {
        const w = tabWidthsSnap.current[i] || child.getBoundingClientRect().width;
        const center = runX + w / 2;
        runX += w;
        if (i === 0) return;
        const dist = Math.abs(e.clientX - center);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      closest = Math.max(1, Math.min(closest, children.length - 1));

      const next = { ...cur, x: e.clientX, overIdx: closest };
      dragStateRef.current = next;


      const ghost = document.getElementById("tab-ghost");
      if (ghost) {
        const br = bar.getBoundingClientRect();
        ghost.style.left = Math.max(br.left, Math.min(e.clientX - cur.grabOffsetX, br.right - 100)) + "px";
        ghost.style.top = br.top + "px";
        ghost.style.height = br.height + "px";
      }


      const br = bar.getBoundingClientRect();
      const ZONE = 48, MAX_SPEED = 12;
      stopAutoScroll();
      const distLeft = e.clientX - br.left;
      const distRight = br.right - e.clientX;
      let speed = 0;
      if (distLeft < ZONE) speed = -MAX_SPEED * (1 - distLeft / ZONE);
      if (distRight < ZONE) speed = MAX_SPEED * (1 - distRight / ZONE);
      if (speed !== 0) {
        const scroll = () => { bar.scrollLeft += speed; autoScrollRef.current = requestAnimationFrame(scroll); };
        autoScrollRef.current = requestAnimationFrame(scroll);
      }

      if (closest !== cur.overIdx) setDragState({ ...next });
    };

    const onUp = () => {
      pendingDragRef.current = null;
      stopAutoScroll();
      const cur = dragStateRef.current;
      if (cur && cur.idx !== cur.overIdx) {
        setTabs(prev => {
          const n = [...prev];
          const [moved] = n.splice(cur.idx, 1);
          n.splice(cur.overIdx, 0, moved);
          return n;
        });
      }
      dragStateRef.current = null;
      setDragState(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", cancel);
    window.addEventListener("visibilitychange", cancel);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("visibilitychange", cancel);
      stopAutoScroll();
    };
  }, []);


  useEffect(() => {

    invoke("load_config").then(cfg => {
      if (cfg) {
        const loaded = {
          fontSize: cfg.fontSize ?? 13,
          fontFamily: cfg.fontFamily ?? "JetBrains Mono",
          lineNumbers: cfg.lineNumbers ?? true,
          minimap: cfg.minimap ?? false,
          wordWrap: cfg.wordWrap ?? false,
          autoInject: cfg.autoInject ?? false,
          injectDelay: cfg.injectDelay ?? 500,
          topMost: cfg.topMost ?? true,
          accentColor: (cfg.accentColor?.startsWith("#")) ? cfg.accentColor : "#e0201a",
          discordRpc: cfg.discordRpc ?? false,
          allowReinject: cfg.allowReinject ?? true,
          confirmTabDelete: cfg.confirmTabDelete ?? false,
          folding: cfg.folding ?? true,
          uiRadius: cfg.uiRadius ?? 4,
        };
        settingsRef.current = loaded;
        setSettings(loaded);
      }
      settingsLoaded.current = true;
    }).catch(() => { settingsLoaded.current = true; });

    invoke("load_session").then(session => {
      if (session?.tabs?.length > 0) {
        const names = session.tabs.map(t => t.name);
        const codeMap = {};
        session.tabs.forEach(t => { codeMap[t.name] = t.code || ""; });
        const active = session.tabs.find(t => t.active)?.name || names[names.length - 1];
        setTabs(["Output", ...names]);
        setCodes(codeMap);
        setActiveTab(active);
      }
      sessionLoaded.current = true;
    }).catch(console.error);

    invoke("check_app_update").then(info => { if (info?.available) setUpdateInfo(info); }).catch(() => { });
    invoke("start_console_server").catch(console.error);
    invoke("start_script_watcher").catch(console.error);

    const unlistenScripts = listen("scripts-changed", () => refreshScripts());


    const unlistenHubTab = listen("hub-open-tab", e => {
      const { name, code } = e.payload || {};
      if (!name || !code) return;
      const tabName = name.replace(/[<>:"/\\|?*]/g, "").trim() || "Script";
      pendingHubCodeRef.current = { tabName, code };
      setTabs(p => p.includes(tabName) ? p : [...p, tabName]);
      setCodes(p => ({ ...p, [tabName]: code }));
      setActiveTab(tabName);
    });

    invoke("check_status").then(status => {
      setStatusInfo(status);
      refreshScripts();
      setTimeout(() => invoke("check_status").then(setStatusInfo).catch(console.error), 3000);
    }).catch(console.error);

    let prevCount = 0;
    const interval = setInterval(() => {
      if (isAttachingRef.current) return;
      invoke("get_roblox_instances").then(res => {
        if (res.length > prevCount) {
          addLog("INFO", "Roblox detected.");
          if (settingsRef.current.autoInject && !isAttachingRef.current && !isInjectedRef.current) {
            setTimeout(() => {
              if (!isAttachingRef.current && !isInjectedRef.current) attachRef.current?.();
            }, 5000);
          }
        }
        if (res.length === 0 && prevCount > 0) {
          isInjectedRef.current = false;
          setIsInjected(false);
          setIsAttaching(false);
          isAttachingRef.current = false;
        }
        prevCount = res.length;
      }).catch(console.error);
    }, 1000);

    return () => {
      clearInterval(interval);
      unlistenScripts.then(f => f());
      unlistenHubTab.then(f => f());
    };
  }, []);


  useEffect(() => {
    const unlistenLog = listen("sirhurt-log", e =>
      setLogs(p => { const n = [...p, e.payload]; return n.length > 1000 ? n.slice(-1000) : n; })
    );

    const unlistenInject = listen("injection-status", e => {
      if (e.payload === true) {
        invoke("get_roblox_instances").then(res => {
          if (res.length > 0) {
            isInjectedRef.current = true;
            setIsInjected(true);
            setIsAttaching(false);
            isAttachingRef.current = false;
            invoke("check_status").then(setStatusInfo).catch(console.error);
          }
        }).catch(console.error);
      } else {
        isInjectedRef.current = false;
        setIsInjected(false);
      }
    });


    const unlistenGame = listen("game-changed", () => {
      invoke("get_autoexec_scripts").then(scripts => {
        scripts.reduce((p, name) => p.then(() => new Promise(res =>
          invoke("load_autoexec_script", { name })
            .then(code => invoke("execute_script", { code }))
            .catch(console.error)
            .finally(() => setTimeout(res, 500))
        )), Promise.resolve());
      }).catch(console.error);
    });

    return () => {
      unlistenLog.then(f => f());
      unlistenInject.then(f => f());
      unlistenGame.then(f => f());
    };
  }, []);


  useEffect(() => {
    appWindow.setMaximizable(false).catch(() => { });



    const onFocusGained = () => {
      invoke("load_config").then(cfg => {
        if (!cfg) return;
        const updated = {
          fontSize: cfg.fontSize ?? 13,
          fontFamily: cfg.fontFamily ?? "JetBrains Mono",
          lineNumbers: cfg.lineNumbers ?? true,
          minimap: cfg.minimap ?? false,
          wordWrap: cfg.wordWrap ?? false,
          autoInject: cfg.autoInject ?? false,
          injectDelay: cfg.injectDelay ?? 500,
          topMost: cfg.topMost ?? true,
          accentColor: (cfg.accentColor?.startsWith("#")) ? cfg.accentColor : "#e0201a",
          discordRpc: cfg.discordRpc ?? false,
          allowReinject: cfg.allowReinject ?? true,
          confirmTabDelete: cfg.confirmTabDelete ?? false,
          folding: cfg.folding ?? true,
          uiRadius: cfg.uiRadius ?? 4,
        };
        settingsRef.current = updated;
        setSettings(updated);
      }).catch(() => { });
    };
    const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) onFocusGained();
    });

    const cr = appWindow.onCloseRequested(async () => {
      try {
        await invoke("quit_app");
      } catch {
        const { WebviewWindow: WW } = await import("@tauri-apps/api/webviewWindow");
        for (const label of ["settings", "script-hub"]) {
          try { const w = await WW.getByLabel(label); if (w) await w.close(); } catch { }
        }
        await appWindow.destroy();
      }
    });

    return () => { cr.then(fn => fn()); unlistenFocus.then(fn => fn()); };
  }, []);


  useEffect(() => {
    if (activeTab === "Output") {
      requestAnimationFrame(() => {
        const el = logsContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      return;
    }
    if (!editorRef.current) return;

    if (pendingHubCodeRef.current?.tabName === activeTab) {
      editorRef.current.setValue(pendingHubCodeRef.current.code);
      pendingHubCodeRef.current = null;
      requestAnimationFrame(forceEditorLayout);
      return;
    }
    editorRef.current.setValue(codes[activeTab] || "");
    requestAnimationFrame(forceEditorLayout);
  }, [activeTab]);


  const addNewTab = () => {
    const name = getNextTabName(tabs);
    setTabs(p => [...p, name]);
    setCodes(p => ({ ...p, [name]: "" }));
    setActiveTab(name);
    requestAnimationFrame(() => {
      const bar = tabBarRef.current;
      if (bar) bar.scrollLeft = bar.scrollWidth;
    });
  };

  const doClose = (tab) => {
    const next = tabs.filter(t => t !== tab);
    setTabs(next);
    setModifiedTabs(s => { const n = new Set(s); n.delete(tab); return n; });
    if (activeScript === tab) setActiveScript("");
    if (activeTab === tab) setActiveTab(next[next.length - 1] || "New Tab 1");
    setCodes(p => { const c = { ...p }; delete c[tab]; return c; });
  };

  const closeTab = (e, tab) => {
    e?.stopPropagation();
    if (settingsRef.current.confirmTabDelete) {
      setCloseConfirm({
        tab,
        onConfirm: () => { setCloseConfirm(null); doClose(tab); },
        onCancel: () => setCloseConfirm(null),
      });
    } else {
      doClose(tab);
    }
  };

  const openScript = (name) => {
    if (!tabs.includes(name)) {
      setTabs(p => [...p, name]);
      invoke("load_script", { name })
        .then(code => setCodes(p => ({ ...p, [name]: code })))
        .catch(() => setCodes(p => ({ ...p, [name]: "" })));
    }
    setActiveTab(name);
    setActiveScript(name);
  };


  const saveScript = () => {
    if (!activeTab || activeTab === "Output") return;
    const code = editorRef.current ? editorRef.current.getValue() : (codes[activeTab] || "");
    invoke("save_script", { name: activeTab, code }).then(() => {
      setModifiedTabs(s => { const n = new Set(s); n.delete(activeTab); return n; });
      setCodes(p => ({ ...p, [activeTab]: code }));
      refreshScripts();
      addLog("OK", `Saved "${activeTab}"`);
    }).catch(err => addLog("ERR", `Save failed: ${err}`));
  };

  const handleRenameSubmit = async (oldName, newName) => {
    if (!newName.trim() || oldName === newName) { setRenamingScript(null); return; }
    const final = newName.trim();
    try {
      await invoke("rename_script", { oldName, newName: final });
      setRenamingScript(null);
      refreshScripts();
      if (tabs.includes(oldName)) {
        setTabs(t => t.map(n => n === oldName ? final : n));
        setCodes(c => { const n = { ...c, [final]: c[oldName] }; delete n[oldName]; return n; });
        if (activeTab === oldName) setActiveTab(final);
        if (activeScript === oldName) setActiveScript(final);
      }
    } catch (err) { addLog("ERR", `Rename failed: ${err}`); }
  };

  const handleDeleteScript = async (name) => {
    try {
      await invoke("delete_script", { name });
      refreshScripts();
      if (tabs.includes(name)) doClose(name);
    } catch (err) { addLog("ERR", `Delete failed: ${err}`); }
  };


  const execute = async () => {
    if (activeTab === "Output") return;
    const code = editorRef.current ? editorRef.current.getValue() : (codes[activeTab] || "");
    if (statusInfo && !statusInfo.coreFilesExist) {
      let liveStatus = statusInfo;
      try { liveStatus = await invoke("check_status"); setStatusInfo(liveStatus); } catch { }
      if (!liveStatus.coreFilesExist) {
        addLog("ERR", "Core files missing. Use Settings → reinstall core.");
        return;
      }
    }
    invoke("execute_script", { code }).catch(err => addLog("ERR", String(err)));
    if (terminalCollapsed) setTerminalCollapsed(false);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const attach = async () => {
    setIsAttaching(true);
    isAttachingRef.current = true;
    let liveStatus = statusInfo;
    try { liveStatus = await invoke("check_status"); setStatusInfo(liveStatus); } catch { }
    if (liveStatus && !liveStatus.coreFilesExist) {
      addLog("ERR", "Core files missing. Use Settings → reinstall core.");
      setIsAttaching(false);
      isAttachingRef.current = false;
      return;
    }
    try {
      addLog("INFO", "Launching sirhurt.exe...");
      await invoke("inject");
      addLog("OK", "Waiting for injection...");
      setTimeout(() => invoke("check_status").then(setStatusInfo).catch(console.error), 5000);
    } catch (err) {
      if (typeof err === "string" && err.includes("MAIN_STAGE")) {
        err.split("\n").forEach(l => addLog(l.includes("ERR") ? "ERR" : "INFO", l));
      } else {
        addLog("ERR", String(err));
      }
    } finally {
      setTimeout(() => { setIsAttaching(false); isAttachingRef.current = false; }, 5000);
    }
  };
  attachRef.current = attach;




  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none text-white"
      style={{ background: "#202020", fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{accentStyles}</style>

      {closeConfirm && (
        <CloseConfirmDialog
          tabName={closeConfirm.tab}
          onDiscard={closeConfirm.onConfirm}
          onCancel={closeConfirm.onCancel}
        />
      )}
      {updateInfo?.available && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-60 p-4 flex flex-col gap-3"
            style={{ background: "#202020", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius-lg)" }}>
            <div>
              <div className="text-[12px] font-bold text-white mb-0.5">Update Available</div>
              <div className="text-[9px] text-gray-500">Sentinel {updateInfo.version} · Opens GitHub releases</div>
            </div>
            {updateInfo.notes && (
              <p className="text-[9px] text-gray-500 leading-relaxed p-2 rounded"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "var(--radius)" }}>
                {updateInfo.notes}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setUpdateInfo(null)}
                className="flex-1 h-7 rounded text-[10px] text-gray-500 hover:text-white cursor-pointer transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", borderRadius: "var(--radius)" }}>
                Later
              </button>
              <button onClick={() => { invoke("open_url", { url: updateInfo.url }); setUpdateInfo(null); }}
                className="flex-1 h-7 rounded text-[10px] font-bold text-white cursor-pointer"
                style={{ background: "var(--accent)", borderRadius: "var(--radius)" }}>
                Download Update
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div
        onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); }}
        className="h-8 flex items-center justify-between shrink-0"
        style={{ background: "#181818", WebkitAppRegion: "drag", appRegion: "drag" }}>
        <div className="flex items-center pointer-events-none pl-3">
          <img src={logo} className="w-8 h-8 object-contain opacity-80" />
        </div>
        <div className="flex items-stretch h-full" style={{ WebkitAppRegion: "no-drag" }}>
          <button
            onClick={() => appWindow.minimize()}
            className="flex items-center justify-center transition-colors cursor-pointer"
            style={{ width: 46, height: "100%", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1" /></svg>
          </button>
          <button
            onClick={() => invoke("quit_app").catch(() => appWindow.close())}
            className="flex items-center justify-center transition-colors cursor-pointer"
            style={{ width: 46, height: "100%", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#c42b1c"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0" style={{ background: "#202020" }}>

        <div className="flex flex-1 overflow-hidden min-h-0 gap-2" style={{ padding: "8px 8px 0 8px" }}>

          <div className="flex-1 flex flex-col min-w-0 min-h-0"
            style={{ background: "#181818", borderRadius: 4, overflow: "hidden" }}>

            <div className="flex items-stretch shrink-0" style={{ height: 28, background: "#181818" }}>
              <div ref={tabBarRef} className="flex flex-1 min-w-0 overflow-x-auto hide-scroll"
                style={{ scrollbarWidth: "none", cursor: dragState ? "grabbing" : "default" }}
                onWheel={e => { e.currentTarget.scrollLeft += e.deltaY; }}>
                {tabs.map((tab) => {
                  const idx = tabs.indexOf(tab);
                  const isActive = activeTab === tab;
                  const isModified = modifiedTabs.has(tab);
                  const ds = dragState;
                  const isDragging = ds?.idx === idx;
                  let tx = 0;
                  if (ds && ds.idx !== ds.overIdx && !isDragging) {
                    const dw = tabWidthsSnap.current[ds.idx] || 90;
                    if (ds.idx < ds.overIdx && idx > ds.idx && idx <= ds.overIdx) tx = -dw;
                    if (ds.idx > ds.overIdx && idx >= ds.overIdx && idx < ds.idx) tx = dw;
                  }
                  return (
                    <div key={tab} data-tab
                      onMouseDown={e => handleTabMouseDown(e, idx)}
                      onClick={() => { if (!dragState) setActiveTab(tab); }}
                      onAuxClick={e => { if (e.button === 1 && tab !== "Output") closeTab(e, tab); }}
                      onMouseEnter={() => setHoveredTab(tab)}
                      onMouseLeave={() => setHoveredTab(null)}
                      style={{
                        opacity: isDragging ? 0 : 1,
                        transform: `translateX(${tx}px)`,
                        transition: ds && !isDragging ? "transform 0.1s ease" : "none",
                        background: isActive ? "#505050" : "#181818",
                        color: "#ffffff",
                        position: "relative",
                        flexShrink: 0,
                        paddingLeft: 10, paddingRight: 8,
                      }}
                      className="flex items-center justify-center gap-1.5 text-[10px] cursor-pointer h-full">
                      <span className="font-medium">{tab}</span>
                      {tab !== "Output" && (
                        <span
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); closeTab(e, tab); }}
                          className="w-3 h-3 flex items-center justify-center text-[8px] cursor-pointer transition-opacity"
                          style={{ color: "#ffffff", opacity: isModified && hoveredTab !== tab ? 1 : hoveredTab === tab ? 1 : 0.55 }}>
                          {isModified && hoveredTab !== tab
                            ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                            : "✕"}
                        </span>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={addNewTab}
                  className="w-7 text-white/50 hover:text-white transition-all shrink-0 flex items-center justify-center h-full cursor-pointer text-[14px] font-light">
                  +
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0" style={{ position: "relative" }}>
              <div ref={editorWrapRef} style={{ position: "absolute", inset: 0 }}>
                <div style={{ position: "absolute", inset: 0 }}>
                  {activeTab === "Output" ? (
                    <div ref={logsContainerRef}
                      className="w-full h-full overflow-y-auto hide-scroll px-4 py-2.5 font-mono text-[11px] leading-relaxed"
                      style={{ background: "#181818", color: "#6b7280", userSelect: "text", WebkitUserSelect: "text", cursor: "text" }}>
                      {logs.length === 0 ? (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#4b5563", fontSize: 11 }}>No output yet.</span>
                        </div>
                      ) : logs.map((line, i) => {
                        const { timestamp, level, message, style } = parseLogLine(line);
                        return (
                          <div key={i} className="flex gap-2 py-[1px]">
                            {timestamp && <span className="shrink-0" style={{ color: "#6b7280" }}>{timestamp}</span>}
                            {style.label && <span className={`shrink-0 font-bold ${style.text}`}>[{style.label}]</span>}
                            <span className={style.text}>{message}</span>
                          </div>
                        );
                      })}
                      <div ref={logsEndRef} />
                    </div>
                  ) : (
                    <Editor height="100%" width="100%" language="luau" theme="sirhurt"
                      value={codes[activeTab] || ""}
                      onChange={val => {
                        if (val !== undefined) {
                          setCodes(p => ({ ...p, [activeTab]: val }));
                          if (val !== (codes[activeTab] ?? ""))
                            setModifiedTabs(s => new Set([...s, activeTab]));
                        }
                      }}
                      beforeMount={setupLuau}
                      onMount={editor => {
                        editorRef.current = editor;
                        setTimeout(forceEditorLayout, 50);
                        setTimeout(forceEditorLayout, 200);
                      }}
                      options={{ ...MONACO_OPTIONS(settings), padding: { top: 10, bottom: 0, left: 4 } }}
                    />
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="flex flex-col shrink-0 min-h-0"
            style={{ width: 160, background: "#181818", borderRadius: 4, overflow: "hidden" }}
            onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, script: null }); }}>

            <div className="flex-1 overflow-y-auto hide-scroll flex flex-col min-h-0 px-1.5 py-1.5 gap-0.5">

              {isCreatingScript && (
                <input autoFocus value={newScriptName} onChange={e => setNewScriptName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === "Enter" && newScriptName.trim()) {
                      const n = newScriptName.trim().replace(/\.(lua|txt)$/i, "");
                      try {
                        await invoke("save_script", { name: n, code: "" });
                        refreshScripts();
                        setActiveScript(n);
                        if (!tabs.includes(n)) setTabs(p => [...p, n]);
                        setCodes(p => ({ ...p, [n]: "" }));
                        setActiveTab(n);
                      } catch { }
                      setIsCreatingScript(false);
                      setNewScriptName("");
                    }
                    if (e.key === "Escape") { setIsCreatingScript(false); setNewScriptName(""); }
                  }}
                  onBlur={() => { setIsCreatingScript(false); setNewScriptName(""); }}
                  className="w-full text-[10px] px-2 py-1 outline-none shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius)", color: "white" }}
                  placeholder="filename" />
              )}

              {localScripts.length === 0 && !isCreatingScript ? (
                <div className="flex-1 flex items-center justify-center opacity-20">
                  <span className="text-[9px] text-gray-500 text-center leading-relaxed">Right-click<br />to add</span>
                </div>
              ) : localScripts.map(name => {
                const isActive = activeScript === name;
                const isRenaming = renamingScript === name;
                return isRenaming ? (
                  <input key={name} autoFocus defaultValue={name}
                    className="w-full text-[10px] px-2 py-1 outline-none shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius)", color: "white" }}
                    onKeyDown={async e => {
                      if (e.key === "Enter") { await handleRenameSubmit(name, e.target.value); setRenamingScript(null); }
                      if (e.key === "Escape") setRenamingScript(null);
                    }}
                    onBlur={() => setRenamingScript(null)} />
                ) : (
                  <button key={name}
                    onClick={async () => {
                      setActiveScript(name);
                      if (!tabs.includes(name)) setTabs(p => [...p, name]);
                      try { const code = await invoke("load_script", { name }); setCodes(p => ({ ...p, [name]: code || "" })); } catch { }
                      setActiveTab(name);
                    }}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, script: name }); }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#ffffff"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#c9d1d9"; }}
                    className="w-full py-1.5 text-[11px] cursor-pointer transition-colors shrink-0 flex items-baseline justify-center min-w-0"
                    style={{
                      borderRadius: "var(--radius)",
                      background: "transparent",
                      color: "#c9d1d9",
                      border: "1px solid transparent",
                      paddingLeft: 8, paddingRight: 8,
                    }}>
                    <span className="truncate min-w-0 text-center">{name}</span>
                    <span className="lua-ext shrink-0 text-[9px] ml-1" style={{ color: "#c9d1d9", opacity: 0.5 }}>.lua</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        <div className="flex items-center shrink-0" style={{ background: "#202020", height: 36 }}>

          <div className="flex items-center h-full flex-1">
            {[
              ["Execute", execute],
              ["Open", () => fileInputRef.current?.click()],
              ["Save", saveScript],
              ["Clear", () => { if (editorRef.current) editorRef.current.setValue(""); setCodes(p => ({ ...p, [activeTab]: "" })); }],
              ["Attach", attach],
            ].map(([lbl, action]) => (
              <button key={lbl} onClick={action}
                onMouseEnter={e => { e.currentTarget.style.color = lbl === "Execute" ? "var(--accent)" : "#ffffff"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#cccccc"; }}
                style={{ background: "transparent", color: "#cccccc", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "0 14px", height: "100%", transition: "color 0.15s", border: "none", outline: "none" }}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="flex items-center h-full">
            {[
              ["Script Hub", () => invoke("show_window", { label: "script-hub" }).catch(console.error)],
              ["Settings", () => invoke("show_window", { label: "settings" }).catch(console.error)],
            ].map(([lbl, action]) => (
              <button key={lbl} onClick={action}
                onMouseEnter={e => { e.currentTarget.style.color = "#ffffff"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#cccccc"; }}
                style={{ background: "transparent", color: "#cccccc", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "0 14px", height: "100%", transition: "color 0.15s", border: "none", outline: "none" }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

      </div>

      <input ref={fileInputRef} type="file" accept=".lua,.luau,.txt" style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const r = new FileReader();
          r.onload = ev => {
            const { name } = file;
            if (!tabs.includes(name)) setTabs(p => [...p, name]);
            setCodes(p => ({ ...p, [name]: ev.target.result }));
            setActiveTab(name);
          };
          r.readAsText(file);
          e.target.value = "";
        }} />

      {contextMenu && (
        <div className="fixed z-[9999] py-1 select-none"
          onMouseDown={e => e.stopPropagation()}
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 140, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)" }}>
          <button
            onClick={() => { setIsCreatingScript(true); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] cursor-pointer transition-colors"
            style={{ color: "var(--accent)", background: "transparent", border: "none" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            New Script
          </button>
          {contextMenu.script && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "3px 0" }} />
              <button
                onClick={() => { setRenamingScript(contextMenu.script); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] cursor-pointer transition-colors"
                style={{ color: "#d1d5db", background: "transparent", border: "none" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Rename
              </button>
              <button
                onClick={() => { handleDeleteScript(contextMenu.script); setContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] cursor-pointer transition-colors"
                style={{ color: "#f87171", background: "transparent", border: "none" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {dragState && (() => {
        const bar = tabBarRef.current;
        const br = bar ? bar.getBoundingClientRect() : null;
        const rawLeft = dragState.x - dragState.grabOffsetX;
        return (
          <div id="tab-ghost"
            className="fixed z-[9998] pointer-events-none flex items-center px-2 text-[9px] text-white/70 font-medium"
            style={{
              left: br ? Math.max(br.left, Math.min(rawLeft, br.right - 80)) : rawLeft,
              top: br ? br.top + 3 : 0,
              height: br ? br.height - 6 : 22,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 3,
              opacity: 0.85,
            }}>
            {dragState.label}
          </div>
        );
      })()}

    </div>
  );
}