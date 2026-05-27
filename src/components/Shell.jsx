import React from "react";

export default function Shell({ children }) {
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace",
      background: "var(--bg)",
      minHeight: "100vh",
      color: "var(--text-h)",
      padding: "32px 24px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;500;700&display=swap');
        * { box-sizing: border-box; }
        .btn {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          border: 1.5px solid;
          padding: 8px 18px;
          cursor: pointer;
          transition: all 0.15s;
          border-radius: 2px;
        }
        .btn-start { background: var(--accent); color: var(--text-h); border-color: var(--accent); }
        .btn-dark { background: transparent; color: var(--text); border-color: var(--border); }
        .btn-blue { background: var(--accent); color: var(--text-h); border-color: var(--accent); }
        .btn:hover { opacity: 0.85; }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        input, select {
          font-family: 'IBM Plex Mono', monospace;
        }
        input[type=range] {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          background: var(--accent);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 8px var(--accent-bg);
        }
        .panel {
          background: var(--code-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
        }
        .stat-box {
          background: var(--code-bg);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 12px 16px;
          flex: 1;
        }
        .stat-label { font-size: 10px; color: var(--text); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
        .stat-value { font-size: 18px; font-weight: 600; color: var(--text-h); }
        .axis-label { font-size: 11px; fill: var(--text); font-family: 'IBM Plex Mono', monospace; }
        .grid-line { stroke: var(--border); stroke-width: 1; }
      `}</style>
      {children}
    </div>
  );
}
