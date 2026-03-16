import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import logo from "./assets/Sentinel.png";

const splashWindow = getCurrentWindow();

const EASE = { duration: 1.0, ease: [0.76, 0, 0.24, 1] };

const PHASES = [
  { w: 220, h: 220, r: 110, logoSize: 120, logoOpacity: 1, showChrome: false, showStatus: false },
  { w: 460, h: 220, r: 28, logoSize: 72, logoOpacity: 0.55, showChrome: false, showStatus: false },
  { w: 650, h: 400, r: 4, logoSize: 40, logoOpacity: 0, showChrome: true, showStatus: false },
  { w: 650, h: 400, r: 4, logoSize: 40, logoOpacity: 0, showChrome: true, showStatus: true },
];

export default function Splash() {
  const [phase, setPhase] = useState(0);
  const [statusDone, setStatusDone] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Checking SirHurt");
  const [statusOk, setStatusOk] = useState(true);
  const [fading, setFading] = useState(false);
  const [appVersion, setAppVersion] = useState("1.0.0");
  const timers = useRef([]);

  const schedule = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  const clearAll = () => timers.current.forEach(clearTimeout);

  const handleClose = async () => { clearAll(); try { await invoke("quit_app"); } catch { } };
  const handleMinimize = () => splashWindow.minimize().catch(() => { });

  const finishAndLaunch = (ok) => {
    if (!ok) return;
    schedule(() => setFading(true), 1200);
    schedule(async () => {
      try { await invoke("launch_main_window"); } catch {}
      setTimeout(async () => { try { await splashWindow.close(); } catch { } }, 200);
    }, 1800);
  };

  useEffect(() => {
    invoke("resize_splash", { width: 650, height: 400 }).catch(() => { });
    getVersion().then(v => setAppVersion(v || "1.0.0")).catch(() => { });

    schedule(() => setPhase(1), 900);
    schedule(() => setPhase(2), 1900);
    schedule(() => setPhase(3), 2900);

    schedule(async () => {
      let ok = true;
      try {
        const status = await invoke("check_status");
        const needsInstall = !status.coreFilesExist;

        if (needsInstall) {
          setStatusMsg("Installing SirHurt");
          setStatusOk(true);
          try {
            await invoke("reinstall_core");
            setStatusMsg("Done");
            setStatusOk(true);
          } catch {
            setStatusMsg("Install failed");
            setStatusOk(false);
            ok = false;
          }
        } else {
          setStatusMsg("Done");
          setStatusOk(true);
        }
      } catch {
        setStatusMsg("Done");
        setStatusOk(true);
      }

      setStatusDone(true);
      finishAndLaunch(ok);
    }, 3100);

    return clearAll;
  }, []);

  const p = PHASES[phase];

  return (
    <motion.div
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      style={{
        position: "fixed", inset: 0,
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <motion.div
        animate={{ width: p.w, height: p.h, borderRadius: p.r }}
        transition={EASE}
        style={{
          background: "#0d0d0f",
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >

        <motion.div
          animate={{ opacity: p.showChrome ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          data-tauri-drag-region
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 32,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            padding: "0 4px",
            pointerEvents: p.showChrome ? "auto" : "none",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", WebkitAppRegion: "no-drag" }}>
            <WinBtn onClick={handleMinimize}>
              <svg width="9" height="1" viewBox="0 0 9 1" fill="currentColor"><rect width="9" height="1" rx="0.5" /></svg>
            </WinBtn>
            <WinBtn onClick={handleClose} danger>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </WinBtn>
          </div>
        </motion.div>

        <motion.img
          src={logo}
          animate={{ width: p.logoSize, height: p.logoSize, opacity: p.logoOpacity }}
          transition={{ ...EASE, duration: 1.1 }}
          style={{ objectFit: "contain", flexShrink: 0, pointerEvents: "none" }}
        />

        <AnimatePresence>
          {p.showStatus && !statusDone && (
            <motion.div key="wordmark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                gap: 10,
              }}>
              <TypewriterText text="SENTINEL" />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9, duration: 0.4, ease: "easeOut" }}
                style={{ width: 32, height: 1, background: "rgba(224,32,26,0.5)", borderRadius: 1, transformOrigin: "left" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {p.showStatus && (
            <motion.div key="status"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute", bottom: 44,
                display: "flex", alignItems: "center",
                fontSize: 13, fontWeight: 500,
                color: "rgba(255,255,255,0.72)",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                letterSpacing: "0.01em",
              }}
            >
              <StatusText msg={statusMsg} done={statusDone} ok={statusOk} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {statusDone && !statusOk && (
            <motion.div key="error-card"
              initial={{ opacity: 0, scale: 0.94, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.25, duration: 0.28, ease: "easeOut" }}
              style={{
                position: "absolute",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                padding: "20px 28px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: 8,
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                minWidth: 210, textAlign: "center",
              }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 5 }}>Installation Failed</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>
                  Please restart the app<br />and try again.
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => window.location.reload()}
                style={{
                  marginTop: 2, fontSize: 10, fontWeight: 600, padding: "5px 18px",
                  borderRadius: 4, border: "1px solid rgba(239,68,68,0.28)",
                  background: "rgba(239,68,68,0.1)", color: "#fca5a5", cursor: "pointer",
                }}>
                Retry
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {p.showStatus && (
            <motion.div key="version"
              initial={{ opacity: 0 }} animate={{ opacity: 0.22 }} transition={{ duration: 0.6 }}
              style={{
                position: "absolute", bottom: 10, left: 14,
                fontSize: 9, fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                letterSpacing: "0.1em", textTransform: "uppercase",
                pointerEvents: "none", userSelect: "none",
              }}
            >
              Sentinel v{appVersion}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function TypewriterText({ text }) {
  const letters = text.split("");
  return (
    <span style={{
      fontSize: 38, fontWeight: 800, letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.85)",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      userSelect: "none",
      display: "inline-flex",
    }}>
      {letters.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.18, ease: "easeOut" }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

function StatusText({ msg, done, ok }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline" }}>
      <motion.span key={msg}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
        style={{ color: !done ? "rgba(255,255,255,0.72)" : ok ? "rgba(255,255,255,0.72)" : "#f87171" }}>
        {msg}
      </motion.span>
      {!done && (
        <span style={{ display: "inline-flex", marginLeft: 1 }}>
          {[0, 1, 2].map(i => (
            <motion.span key={i}
              animate={{ opacity: [0.15, 1, 0.15] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              style={{ color: "#e0201a", fontWeight: 800 }}>.</motion.span>
          ))}
        </span>
      )}
      {done && ok && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 16, stiffness: 320 }}
          style={{ marginLeft: 8, color: "#4ade80", display: "inline-flex", alignItems: "center" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </motion.span>
      )}
      {done && !ok && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 16, stiffness: 320 }}
          style={{ marginLeft: 8, color: "#f87171", display: "inline-flex", alignItems: "center" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </motion.span>
      )}
    </span>
  );
}

function WinBtn({ onClick, danger, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        background: danger && hov ? "rgba(239,68,68,0.15)" : "transparent",
        border: "none",
        color: hov ? (danger ? "#f87171" : "rgba(255,255,255,0.9)") : "rgba(255,255,255,0.28)",
        cursor: "pointer", borderRadius: 4,
        transition: "color 0.12s, background 0.12s", outline: "none", flexShrink: 0,
      }}>
      {children}
    </button>
  );
}