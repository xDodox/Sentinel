import { useState } from "react";

export function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setVisible(true);
  };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <span className="fixed z-[9999] pointer-events-none" style={{ left: pos.x, top: pos.y - 6, transform: "translate(-50%, -100%)" }}>
          <span className="block bg-[#181c24] border border-accent/40 text-[10px] text-gray-200 px-2 py-1 rounded-md whitespace-nowrap"
            style={{ boxShadow: "0 4px 16px #00000080" }}>
            {text}
          </span>
        </span>
      )}
    </span>
  );
}

export function TabIcon({ name }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}