import { useState, useRef, useEffect, useCallback } from "react";
import katex from "katex";

const DEFAULT_VIEW = { xMin: -6, xMax: 6, yMin: -8, yMax: 8 };
const EXAMPLES = [
  { label: "x³ − x − 2", fn: "x**3 - x - 2" },
  { label: "cos(x) − x", fn: "cos(x) - x" },
  { label: "x² − 2", fn: "x**2 - 2" },
  { label: "sin(x)", fn: "sin(x)" },
  { label: "eˣ − 3", fn: "exp(x) - 3" },
];

const STEP_LABELS = ["Show Tangent", "Show Zero of Tangent", "Move to Next Point"];

function InlineMath({ math }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(math, {
          displayMode: false,
          throwOnError: false,
        }),
      }}
    />
  );
}

function evalFn(expr, x) {
  try {
    const cleaned = expr
      .replace(/\^/g, "**")
      .replace(/(\d)(x)/g, "$1*x")
      .replace(/([a-zA-Z])\(/g, "Math.$1(")
      .replace(/\bsin\b/g, "Math.sin")
      .replace(/\bcos\b/g, "Math.cos")
      .replace(/\btan\b/g, "Math.tan")
      .replace(/\bsqrt\b/g, "Math.sqrt")
      .replace(/\babs\b/g, "Math.abs")
      .replace(/\bln\b/g, "Math.log")
      .replace(/\blog\b/g, "Math.log10")
      .replace(/\bexp\b/g, "Math.exp")
      .replace(/\bpi\b/g, "Math.PI")
      .replace(/\be\b/g, "Math.E");
    return Function("x", `"use strict"; return (${cleaned})`)(x);
  } catch {
    return NaN;
  }
}

function numericalDerivative(expr, x) {
  const h = 1e-7;
  return (evalFn(expr, x + h) - evalFn(expr, x - h)) / (2 * h);
}

function toCanvas(x, y, view, w, h) {
  const cx = ((x - view.xMin) / (view.xMax - view.xMin)) * w;
  const cy = h - ((y - view.yMin) / (view.yMax - view.yMin)) * h;
  return [cx, cy];
}

function fromCanvas(cx, cy, view, w, h) {
  const x = view.xMin + (cx / w) * (view.xMax - view.xMin);
  const y = view.yMin + (1 - cy / h) * (view.yMax - view.yMin);
  return [x, y];
}

function niceStep(rough) {
  const exp = Math.floor(Math.log10(rough));
  const frac = rough / Math.pow(10, exp);
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return nice * Math.pow(10, exp);
}

export default function NewtonPage() {
  const canvasRef = useRef(null);
  const [fnExpr, setFnExpr] = useState("x**3 - x - 2");
  const [fnInput, setFnInput] = useState("x³ − x − 2");
  const [rawInput, setRawInput] = useState("x**3 - x - 2");
  const [fnError, setFnError] = useState(false);
  const [startX, setStartX] = useState("2");
  const [iterations, setIterations] = useState([]);
  const [subStep, setSubStep] = useState(0);
  const [iterIndex, setIterIndex] = useState(0);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [dragging, setDragging] = useState(null);
  const [animating, setAnimating] = useState(false);
  const maxIter = 12;

  const buildIterations = useCallback((expr, x0) => {
    const iters = [];
    let x = x0;
    for (let i = 0; i < maxIter; i++) {
      const fx = evalFn(expr, x);
      const fpx = numericalDerivative(expr, x);
      if (!isFinite(fx) || !isFinite(fpx) || Math.abs(fpx) < 1e-12) break;
      const xNext = x - fx / fpx;
      iters.push({ x, fx, fpx, xNext, tangentZero: xNext });
      if (Math.abs(xNext - x) < 1e-10) { x = xNext; break; }
      x = xNext;
    }
    return iters;
  }, []);

  const handleReset = useCallback(() => {
    const x0 = parseFloat(startX);
    if (isNaN(x0)) return;
    const test = evalFn(fnExpr, x0);
    if (isNaN(test)) { setFnError(true); return; }
    setFnError(false);
    const iters = buildIterations(fnExpr, x0);
    setIterations(iters);
    setIterIndex(0);
    setSubStep(0);
  }, [fnExpr, startX, buildIterations]);

  const handleStep = useCallback(() => {
    if (iterations.length === 0) return;
    if (subStep === 0) { setAnimating(true); setTimeout(() => { setSubStep(1); setAnimating(false); }, 50); }
    else if (subStep === 1) { setAnimating(true); setTimeout(() => { setSubStep(2); setAnimating(false); }, 50); }
    else if (subStep === 2) { setAnimating(true); setTimeout(() => { setSubStep(3); setAnimating(false); }, 50); }
    else if (subStep === 3) {
      if (iterIndex + 1 < iterations.length) {
        setIterIndex((i) => i + 1);
        setSubStep(0);
      }
    }
  }, [subStep, iterIndex, iterations]);

  const isConverged = iterations.length > 0 && iterIndex >= iterations.length - 1 && subStep === 3;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, w, h);

    const tc = (x, y) => toCanvas(x, y, view, w, h);
    const xStep = niceStep((view.xMax - view.xMin) / 10);
    const yStep = niceStep((view.yMax - view.yMin) / 10);

    ctx.strokeStyle = "#1e2733";
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(view.xMin / xStep) * xStep; gx <= view.xMax; gx += xStep) {
      const [cx] = tc(gx, 0);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    }
    for (let gy = Math.ceil(view.yMin / yStep) * yStep; gy <= view.yMax; gy += yStep) {
      const [, cy] = tc(0, gy);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    }

    ctx.strokeStyle = "#2d3f55";
    ctx.lineWidth = 1.5;
    const [ax0] = tc(0, 0);
    const [, ay0] = tc(0, 0);
    ctx.beginPath(); ctx.moveTo(ax0, 0); ctx.lineTo(ax0, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ay0); ctx.lineTo(w, ay0); ctx.stroke();

    ctx.fillStyle = "#4a6080";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let gx = Math.ceil(view.xMin / xStep) * xStep; gx <= view.xMax; gx += xStep) {
      if (Math.abs(gx) < xStep * 0.1) continue;
      const [cx] = tc(gx, 0);
      ctx.fillText(+gx.toFixed(2), cx, ay0 + 14);
    }
    ctx.textAlign = "right";
    for (let gy = Math.ceil(view.yMin / yStep) * yStep; gy <= view.yMax; gy += yStep) {
      if (Math.abs(gy) < yStep * 0.1) continue;
      const [, cy] = tc(0, gy);
      ctx.fillText(+gy.toFixed(2), ax0 - 5, cy + 4);
    }

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#38bdf840";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    let started = false;
    const steps = w * 2;
    for (let i = 0; i <= steps; i++) {
      const x = view.xMin + (i / steps) * (view.xMax - view.xMin);
      const y = evalFn(fnExpr, x);
      if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
      const [cx, cy] = tc(x, y);
      if (!started) { ctx.moveTo(cx, cy); started = true; } else { ctx.lineTo(cx, cy); }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (iterations.length === 0) return;

    for (let i = 0; i < iterIndex; i++) {
      const it = iterations[i];
      drawTangentLine(ctx, tc, it, "#1e4060", 1.2);
      drawVertical(ctx, tc, it.xNext, iterations[i + 1]?.fx ?? evalFn(fnExpr, it.xNext), "#1e4060", 1.2);
    }

    const it = iterations[iterIndex];
    if (!it) return;

    drawPoint(ctx, tc, it.x, it.fx, "#f59e0b", 7, "x" + iterIndex);

    if (subStep >= 1) {
      drawTangentLine(ctx, tc, it, "#f59e0b", 2, true);
    }
    if (subStep >= 2) {
      drawPoint(ctx, tc, it.xNext, 0, "#22c55e", 7, "x" + (iterIndex + 1));
      drawDashedVertical(ctx, tc, it.xNext, 0, "#22c55e60");
    }
    if (subStep >= 3) {
      const yNext = evalFn(fnExpr, it.xNext);
      if (isFinite(yNext)) {
        drawVertical(ctx, tc, it.xNext, yNext, "#22c55e", 1.5);
        drawPoint(ctx, tc, it.xNext, yNext, "#22c55e", 7, "x" + (iterIndex + 1));
        const [cx, cy] = tc(it.xNext, yNext);
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 12px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(`x = ${it.xNext.toFixed(5)}`, cx + 10, cy - 8);
      }
    }
  }, [fnExpr, iterations, iterIndex, subStep, view]);

  function drawTangentLine(ctx, tc, it, color, lw, glow = false) {
    const extend = (view.xMax - view.xMin) * 1.5;
    const x1 = it.x - extend;
    const x2 = it.x + extend;
    const y1 = it.fx + it.fpx * (x1 - it.x);
    const y2 = it.fx + it.fpx * (x2 - it.x);
    const [cx1, cy1] = tc(x1, y1);
    const [cx2, cy2] = tc(x2, y2);
    if (glow) { ctx.shadowColor = color + "80"; ctx.shadowBlur = 10; }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawVertical(ctx, tc, x, yTop, color, lw) {
    const [cx1, cy1] = tc(x, 0);
    const [cx2, cy2] = tc(x, yTop);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();
  }

  function drawDashedVertical(ctx, tc, x, y, color) {
    const [cx1, cy1] = tc(x, 0);
    const [cx2, cy2] = tc(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPoint(ctx, tc, x, y, color, r, label) {
    const [cx, cy] = tc(x, y);
    ctx.shadowColor = color + "80";
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (label) {
      ctx.fillStyle = color;
      ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, cx, cy - 12);
    }
  }

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const [wx, wy] = fromCanvas(mx, my, view, canvas.width, canvas.height);
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    setView((v) => ({
      xMin: wx + (v.xMin - wx) * factor,
      xMax: wx + (v.xMax - wx) * factor,
      yMin: wy + (v.yMin - wy) * factor,
      yMax: wy + (v.yMax - wy) * factor,
    }));
  }, [view]);

  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDragging({ x: e.clientX - rect.left, y: e.clientY - rect.top, view });
  }, [view]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dx = cx - dragging.x;
    const dy = cy - dragging.y;
    const xRange = dragging.view.xMax - dragging.view.xMin;
    const yRange = dragging.view.yMax - dragging.view.yMin;
    const ddx = -(dx / canvas.width) * xRange;
    const ddy = (dy / canvas.height) * yRange;
    setView({
      xMin: dragging.view.xMin + ddx,
      xMax: dragging.view.xMax + ddx,
      yMin: dragging.view.yMin + ddy,
      yMax: dragging.view.yMax + ddy,
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const handleFnChange = (val) => {
    setRawInput(val);
    const test = evalFn(val, 1);
    setFnError(isNaN(test) && val.trim() !== "");
    if (!isNaN(test) || val.trim() === "") setFnExpr(val);
  };

  const stepLabel = subStep < 3
    ? STEP_LABELS[subStep]
    : iterIndex + 1 < iterations.length
      ? "Next Iteration →"
      : "Converged ✓";

  const currentIter = iterations[iterIndex];
  const canStep = iterations.length > 0 && !(isConverged && subStep === 3);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d1117",
      color: "#e6edf3",
      fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 16px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #2d3f55; border-radius: 3px; }
        .step-btn {
          background: linear-gradient(135deg, #1e3a5f, #1a4a7a);
          border: 1px solid #38bdf840;
          color: #38bdf8;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 28px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.03em;
        }
        .step-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #1e4a7f, #1a5a9a);
          border-color: #38bdf8;
          box-shadow: 0 0 16px #38bdf830;
        }
        .step-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .reset-btn {
          background: transparent;
          border: 1px solid #2d3f55;
          color: #8b9db5;
          font-family: inherit;
          font-size: 13px;
          padding: 8px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .reset-btn:hover { border-color: #f59e0b; color: #f59e0b; }
        .example-chip {
          background: #161b22;
          border: 1px solid #2d3f55;
          color: #8b9db5;
          font-family: inherit;
          font-size: 12px;
          padding: 5px 12px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .example-chip:hover { border-color: #38bdf8; color: #38bdf8; }
        input[type=text], input[type=number] {
          background: #161b22;
          border: 1px solid #2d3f55;
          color: #e6edf3;
          font-family: inherit;
          font-size: 14px;
          padding: 8px 12px;
          border-radius: 6px;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        input:focus { border-color: #38bdf8; }
        .error-input { border-color: #ef4444 !important; }
        .iter-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; border-left: 3px solid transparent; transition: all 0.2s; }
        .iter-row.active { background: #1e2733; border-left-color: #f59e0b; }
        .iter-row.done { border-left-color: #22c55e30; }
      `}</style>

      <div style={{ marginBottom: 28, maxWidth: 900, width: "100%", textAlign: "left" }}>
        <h1 style={{ fontFamily: "'Spectral', serif", fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.02em", color: "#e6edf3" }}>
          Newtonverfahren
        </h1>
        <div style={{ color: "#c9d1d9", lineHeight: 1.55, fontSize: 14 }}>
          <p style={{ marginBottom: 10 }}>
            In der Realität weisen die Datenpunkte häufig keinen linearen Zusammenhang auf, sondern Zusammenhänge komplexerer Funktionen. Hier wird die Verlustfunktion noch immer mit der gleichen Idee berechnet, allerdings ist die Verlustfunktion dann nicht mehr quadratisch, sondern komplexer. Für diese Funktionen das Minimum zu bestimmen, kann sehr umständlich oder sogar unmöglich sein.
          </p>
          <p style={{ marginBottom: 16 }}>
            In solchen Situationen verwendet man sogenannte Näherungsverfahren. Eines davon ist das <strong>Newtonverfahren</strong>.
          </p>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#e6edf3", margin: "0 0 10px" }}>Lernaufgaben</h2>
          <ol style={{ margin: 0, paddingLeft: "22px" }}>
            <li style={{ marginBottom: "6px" }}>
              Berechne die Extremstellen der Funktion <InlineMath math={String.raw`f(x) = x^4 - 6x^3 + 9x^2 + 15x`} />. Was fällt dir auf?
            </li>
            <li style={{ marginBottom: "6px" }}>
              Das Newtonverfahren ist ein Verfahren, um näherungsweise die Nullstellen einer Funktion zu bestimmen. Für Aufgabe a) brauchst du die Nullstellen von <InlineMath math={String.raw`f'(x)`} />. Klicke dich durch die Simulation und erkläre, wie das Newtonverfahren funktioniert.
            </li>
            <li style={{ marginBottom: "6px" }}>Berechne die Nullstellen von <InlineMath math={String.raw`f'(x)`} /> mit dem Newtonverfahren.</li>
            <li>
              Mithilfe des Startbuttons kannst du das Newtonverfahren laufen lassen. Beobachte für unterschiedliche Funktionen und Startwerte <InlineMath math={String.raw`x_0`} />. Beschreibe, wann das Newtonverfahren nicht funktioniert.
            </li>
          </ol>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 1100, flexWrap: "wrap", alignItems: "flex-start" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 240, flex: "1 1 240px" }}>

          <div style={{ background: "#161b22", border: "1px solid #2d3f55", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#4a6080", marginBottom: 10, textTransform: "uppercase" }}>Function f(x)</div>
            <input
              type="text"
              className={fnError ? "error-input" : ""}
              value={rawInput}
              onChange={(e) => handleFnChange(e.target.value)}
              placeholder="e.g. x**3 - x - 2"
            />
            {fnError && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>Invalid expression</div>}
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EXAMPLES.map((ex) => (
                <button key={ex.fn} className="example-chip" onClick={() => { setRawInput(ex.fn); handleFnChange(ex.fn); }}>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: "#161b22", border: "1px solid #2d3f55", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#4a6080", marginBottom: 10, textTransform: "uppercase" }}>Starting Point x₀</div>
            <input
              type="number"
              step="0.1"
              value={startX}
              onChange={(e) => setStartX(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>

          <div style={{ background: "#161b22", border: "1px solid #2d3f55", borderRadius: 10, padding: 16 }}>
            <button className="reset-btn" style={{ width: "100%", marginBottom: 10 }} onClick={handleReset}>
              ↺ Reset / Apply
            </button>
            <button
              className="step-btn"
              style={{ width: "100%" }}
              onClick={handleStep}
              disabled={!canStep || animating}
            >
              {isConverged ? "Converged ✓" : stepLabel}
            </button>
          </div>

          <div style={{ background: "#161b22", border: "1px solid #2d3f55", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#4a6080", marginBottom: 10, textTransform: "uppercase" }}>Steps</div>
            {[
              { color: "#f59e0b", label: "Current point xₙ on curve" },
              { color: "#f59e0b", label: "Tangent line at xₙ", step: 1 },
              { color: "#22c55e", label: "Zero of tangent → xₙ₊₁", step: 2 },
              { color: "#22c55e", label: "Move xₙ₊₁ onto curve", step: 3 },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, opacity: item.step === undefined || subStep >= item.step ? 1 : 0.35, transition: "opacity 0.3s" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0, boxShadow: `0 0 6px ${item.color}80` }} />
                <span style={{ fontSize: 12, color: "#8b9db5" }}>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "#161b22", border: "1px dashed #2d3f5580", borderRadius: 10, padding: 12, color: "#4a6080", fontSize: 11 }}>
            🖱 Scroll to zoom · Drag to pan
          </div>
        </div>

        <div style={{ flex: "3 1 420px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #2d3f55", boxShadow: "0 0 40px #00000060" }}>
            <canvas
              ref={canvasRef}
              width={700}
              height={480}
              style={{ display: "block", width: "100%", cursor: dragging ? "grabbing" : "grab" }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <button
              style={{ position: "absolute", top: 10, right: 10, background: "#161b22cc", border: "1px solid #2d3f55", color: "#4a6080", fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => setView(DEFAULT_VIEW)}
            >
              ⤢ Reset View
            </button>
            {iterations.length > 0 && (
              <div style={{ position: "absolute", top: 10, left: 10, background: "#161b22cc", border: "1px solid #2d3f55", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#38bdf8" }}>
                Iter {iterIndex + 1} / {iterations.length}
              </div>
            )}
          </div>

          {iterations.length > 0 && (
            <div style={{ background: "#161b22", border: "1px solid #2d3f55", borderRadius: 10, padding: 14, maxHeight: 200, overflowY: "auto" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#4a6080", marginBottom: 10, textTransform: "uppercase" }}>Iteration History</div>
              <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 1fr", gap: "4px 8px", fontSize: 11, color: "#4a6080", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #2d3f55" }}>
                <span>n</span><span>xₙ</span><span>f(xₙ)</span><span>xₙ₊₁</span>
              </div>
              {iterations.map((it, i) => (
                <div key={i} className={`iter-row ${i === iterIndex ? "active" : i < iterIndex ? "done" : ""}`} style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 1fr", gap: "4px 8px", fontSize: 12 }}>
                  <span style={{ color: "#4a6080" }}>{i}</span>
                  <span style={{ color: i === iterIndex ? "#f59e0b" : "#8b9db5" }}>{it.x.toFixed(6)}</span>
                  <span style={{ color: i === iterIndex ? "#f59e0b" : "#8b9db5" }}>{it.fx.toFixed(6)}</span>
                  <span style={{ color: i < iterIndex || (i === iterIndex && subStep >= 2) ? "#22c55e" : "#4a6080" }}>{it.xNext.toFixed(6)}</span>
                </div>
              ))}
              {isConverged && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d2e1a", border: "1px solid #22c55e40", borderRadius: 6, color: "#22c55e", fontSize: 12 }}>
                  ✓ Converged to x ≈ {iterations[iterations.length - 1].xNext.toFixed(8)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
