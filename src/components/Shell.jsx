import React from "react";

export default function Shell({ children }) {
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace",
      background: "#0d1117",
      minHeight: "100vh",
      color: "#e6edf3",
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
        .btn-start { background: #00d9ff; color: #0d1117; border-color: #00d9ff; }
        .btn-dark { background: transparent; color: #8b949e; border-color: #30363d; }
        .btn-blue { background: #1f6feb; color: #e6edf3; border-color: #1f6feb; }
        .btn:hover { opacity: 0.85; }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        input, select {
          font-family: 'IBM Plex Mono', monospace;
        }
        input[type=range] {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          background: #30363d;
          border-radius: 2px;
          outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          background: #00d9ff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 8px #00d9ff88;
        }
        .panel {
          background: #161b22;
          border: 1px solid #21262d;
          border-radius: 6px;
        }
        .stat-box {
          background: #161b22;
          border: 1px solid #21262d;
          border-radius: 4px;
          padding: 12px 16px;
          flex: 1;
        }
        .stat-label { font-size: 10px; color: #8b949e; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
        .stat-value { font-size: 18px; font-weight: 600; color: #e6edf3; }
        .axis-label { font-size: 11px; fill: #8b949e; font-family: 'IBM Plex Mono', monospace; }
        .grid-line { stroke: #21262d; stroke-width: 1; }
      `}</style>
      {children}
    </div>
  );
}
