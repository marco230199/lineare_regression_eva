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

const STEP_LABELS = ["Tangente durch Punkt P anlegen", "Nullstelle der Tangente bestimmen", "Nullstelle als neuen Startwert verwenden"];

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

function BlockMath({ math }) {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(math, {
          displayMode: true,
          throwOnError: false,
        }),
      }}
      style={{ margin: "12px 0", padding: "8px 0" }}
    />
  );
}

function normalizeExpr(expr) {
  return expr
    .replace(/−/g, "-")
    .replace(/,/g, ".")
    .replace(/\^/g, "**")
    .replace(/π/g, "pi")
    .replace(/\barcsin\b/g, "asin")
    .replace(/\barccos\b/g, "acos")
    .replace(/\barctan\b/g, "atan")
    .replace(/(\d|\)|pi|e)x\b/g, "$1*x")
    .replace(/x(\d|pi|e|\()/g, "x*$1")
    .replace(/(\d|x|\)|pi|e)\s*\(/g, "$1*(");
}

function evalFn(expr, x) {
  try {
    const cleaned = normalizeExpr(expr);
    const allowedNames = [
      "sin", "cos", "tan", "asin", "acos", "atan",
      "sqrt", "abs", "ln", "log", "exp", "pow",
      "floor", "ceil", "round", "min", "max"
    ];
    const allowedValues = allowedNames.map((name) =>
      name === "ln" ? Math.log : name === "log" ? Math.log10 : Math[name]
    );

    return Function(
      "x",
      "pi",
      "e",
      ...allowedNames,
      `"use strict"; return (${cleaned})`
    )(x, Math.PI, Math.E, ...allowedValues);
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
  const [autoRun, setAutoRun] = useState(false);
  const [showStepLabels, setShowStepLabels] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [showDerivation, setShowDerivation] = useState(false);
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
    setAutoRun(false);
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
      } else {
        setAutoRun(false);
      }
    }
  }, [subStep, iterIndex, iterations]);

  const isConverged = iterations.length > 0 && iterIndex >= iterations.length - 1 && subStep === 3;
  const canStep = iterations.length > 0 && !(isConverged && subStep === 3);

  useEffect(() => {
    if (!autoRun || !canStep || animating) return;
    const timer = setTimeout(() => {
      handleStep();
    }, 900);
    return () => clearTimeout(timer);
  }, [autoRun, canStep, animating, handleStep]);

  useEffect(() => {
    if (isConverged) setAutoRun(false);
  }, [isConverged]);

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

    if (subStep === 0) {
      // drawPoint(ctx, tc, it.x, it.fx, "#f59e0b", 7, pointLabel(iterIndex, it.x, it.fx));
      drawPoint(ctx, tc, it.x, it.fx, "#f59e0b", 7, pointLabel(iterIndex));

    }

    if (subStep >= 1) {
      drawTangentLine(ctx, tc, it, "#f59e0b", 2, true);
    }
    if (subStep >= 2) {
      drawPoint(ctx, tc, it.xNext, 0, "#22c55e", 7, `x${iterIndex + 1}`);
      drawDashedVertical(ctx, tc, it.xNext, 0, "#22c55e60");
    }
    if (showCalculation && subStep >= 2) {
      drawCalculationBox(ctx, it, iterIndex, w);
    }
    if (subStep >= 3) {
      const yNext = evalFn(fnExpr, it.xNext);
      if (isFinite(yNext)) {
        drawVertical(ctx, tc, it.xNext, yNext, "#22c55e", 1.5, `f(x${toSubscript(iterIndex + 1)})`);
      }
    }
  }, [fnExpr, iterations, iterIndex, subStep, view, showCalculation]);

  // function pointLabel(n, x, y) {
  //   return `P${n}(${x.toFixed(3)} | ${y.toFixed(3)})`;
  // }
  function pointLabel(n) {
    return `P${n}`;
  }

  function toSubscript(value) {
    const subscripts = {
      "0": "₀",
      "1": "₁",
      "2": "₂",
      "3": "₃",
      "4": "₄",
      "5": "₅",
      "6": "₆",
      "7": "₇",
      "8": "₈",
      "9": "₉",
      "-": "₋",
    };
    return String(value).replace(/[0-9-]/g, (char) => subscripts[char] ?? char);
  }

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

  function drawVertical(ctx, tc, x, yTop, color, lw, label) {
    const [cx1, cy1] = tc(x, 0);
    const [cx2, cy2] = tc(x, yTop);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();

    if (label) {
      const labelY = yTop >= 0 ? Math.min(cy1, cy2) - 8 : Math.max(cy1, cy2) + 16;
      ctx.fillStyle = color;
      ctx.font = "bold 12px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(label, cx2 + 10, labelY);
    }
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
      ctx.fillText(label, cx, cy - 14);
    }
  }

  function drawCalculationBox(ctx, it, n, canvasWidth) {
    const xNext = it.x - it.fx / it.fpx;

    const lines = [
      `x${n + 1} = x${n} - f(x${n}) / f'(x${n})`,
      `x${n + 1} = ${it.x.toFixed(3)} - ${it.fx.toFixed(3)} / ${it.fpx.toFixed(3)}`,
      `x${n + 1} ≈ ${xNext.toFixed(6)}`
    ];

    const boxX = 20;
    const boxY = 55;
    const boxW = Math.min(420, canvasWidth - 40);
    const boxH = 82;

    ctx.fillStyle = "#161b22dd";
    ctx.strokeStyle = "#38bdf880";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e6edf3";
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";

    lines.forEach((line, i) => {
      ctx.fillText(line, boxX + 14, boxY + 24 + i * 20);
    });
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
    const testPoints = [1, 2, Math.E, -1, 0.5];
    const isValid = val.trim() === "" || testPoints.some((testX) => isFinite(evalFn(val, testX)));
    setFnError(!isValid);
    if (isValid) setFnExpr(val);
  };

 const detailedStepLabel = subStep < 3
  ? STEP_LABELS[subStep]
  : iterIndex + 1 < iterations.length
    ? "Nächster Durchgang →"
    : "Converged ✓";

  const stepLabel = showStepLabels
    ? detailedStepLabel
    : (isConverged ? "Converged ✓" : "Nächster Schritt");

  const currentIter = iterations[iterIndex];
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
          Du hast gelernt, dass Computer Regressionsgeraden durch das Minimieren der Lossfunktion bestimmen können, auch wenn es sich um sehr große Datenmengen handelt.
        </p>

        <p style={{ marginBottom: 10 }}>
          Es gibt jedoch auch Szenarien, in denen es schwieriger ist, die Lossfunktion zu minimieren.
        </p>

        <p style={{ marginBottom: 16 }}>
          Hier kommen dann Näherungsverfahren zum Einsatz. Eines dieser Verfahren ist das <strong>Newtonverfahren</strong>. Es ermöglicht es, die Nullstellen einer Funktion zu bestimmen.
        </p>

        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#e6edf3", margin: "0 0 10px" }}>
          Lernaufgaben
        </h2>

        <ol style={{ margin: 0, paddingLeft: "22px" }}>
          <li style={{ marginBottom: "6px" }}>
            Berechne die Nullstellen der Funktion <InlineMath math={String.raw`f(x) = \frac{1}{3}x^3 - x^2 - \frac{1}{3}`} />. Was fällt dir auf?
          </li>

          <li style={{ marginBottom: "6px" }}>
            Mache dich jetzt mit der Simulation zum Newtonverfahren vertraut. Wähle zunächst die Funktion <InlineMath math={String.raw`f(x) = 3\ln(x)-5`} /> mit dem Startwert <InlineMath math={String.raw`x_0 = 0.2`} /> aus. Klicke dich mithilfe des Buttons „Nächster Schritt“ langsam durch die Simulation und beschreibe in Schritten, wie das Newtonverfahren funktioniert. Du kannst dein Ergebnis mithilfe des Buttons „Schritte benennen“ überprüfen.
          </li>

          <li style={{ marginBottom: "6px" }}>
            Zeichne in den abgebildeten Graphen die ersten drei Durchgänge des Newtonverfahrens ein.
          </li>

          <li style={{ marginBottom: "6px" }}>
            Verwende jetzt die Funktion <InlineMath math={String.raw`f(x) = x^3 - 2x + 2`} /> und starte das Newtonverfahren mit unterschiedlichen Startwerten <InlineMath math={String.raw`x_0`} />. Findet das Verfahren immer die Nullstellen der Funktion?
          </li>

          <li>
            Der Button "Herleitung der Iterationsformel" zeigt, wie die vier Schritte rechnerisch durchgeührt werden. Dies führt zur sogenannten 
            Iterationsformel des Newtonverfahrens. 
          </li>
          <li style={{ marginBottom: "6px" }}>
          Wende das Newtonverfahren zweimal an, um die Nullstellen der Funktion <InlineMath math={String.raw`f(x) = \frac{1}{3}x^3 - x^2 - \frac{1}{3}`} /> anzunähern. Du kannst den Button „Rechnung anzeigen“ oder die Tabelle unterhalb des Graphen verwenden, 
          um deine Ergebnisse schrittweise zu überprüfen. Wähle als Startwert <InlineMath math={String.raw`x_0 = 2,5`} /> .
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
            <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#4a6080", marginBottom: 10, textTransform: "uppercase" }}>1. Schritt: Startwert x₀ auswählen</div>
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
              ↺ Startwert verwenden / Zurücksetzen
            </button>
           
            <button
              className="step-btn"
              style={{ width: "100%" }}
              onClick={handleStep}
              disabled={!canStep || animating}
            >
              {isConverged ? "Converged ✓" : stepLabel}
            </button>
            <button
              className="step-btn"
              style={{ width: "100%", marginTop: 10, background: autoRun ? "linear-gradient(135deg, #5f1e1e, #7a1a1a)" : undefined }}
              onClick={() => setAutoRun((running) => !running)}
              disabled={!canStep && !autoRun}
            >
              {autoRun ? "⏸ STOP" : "▶ START"}
            </button>
             <button
                className="reset-btn"
                style={{
                  width: "100%",
                  marginBottom: 10,
                  borderColor: showStepLabels ? "#38bdf8" : undefined,
                  color: showStepLabels ? "#38bdf8" : undefined
                }}
                onClick={() => setShowStepLabels((v) => !v)}
              >
                {showStepLabels ? "✓ Schritte benennen" : "Schritte benennen"}
            </button>
            <button
              className="reset-btn"
              style={{
                width: "100%",
                marginBottom: 10,
                borderColor: showCalculation ? "#38bdf8" : undefined,
                color: showCalculation ? "#38bdf8" : undefined
              }}
              onClick={() => setShowCalculation((v) => !v)}
            >
              {showCalculation ? "✓ Rechnung anzeigen" : "Rechnung anzeigen"}
            </button>
            <button
              className="reset-btn"
              style={{
                width: "100%",
                borderColor: showDerivation ? "#38bdf8" : undefined,
                color: showDerivation ? "#38bdf8" : undefined
              }}
              onClick={() => setShowDerivation((v) => !v)}
            >
              {showDerivation ? "✓ Herleitung der Iterationsformel" : "Herleitung der Iterationsformel"}
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

      {showDerivation && (
        <div style={{ marginTop: 40, maxWidth: 900, width: "100%", textAlign: "left" }}>
          <h2 style={{ fontFamily: "'Spectral', serif", fontSize: "clamp(20px, 4vw, 32px)", fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.02em", color: "#e6edf3" }}>
            Herleitung der Iterationsformel des Newtonverfahrens
          </h2>

          <div style={{ background: "#161b22", border: "1px solid #2d3f55", borderRadius: 10, padding: 20, color: "#c9d1d9", lineHeight: 1.65 }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#e6edf3", margin: "0 0 12px" }}>
                1. Schritt: Startwert wählen und Punkt P bestimmen
              </h3>
              <p style={{ margin: 0, marginBottom: 10 }}>
                Wähle einen Startwert <InlineMath math={String.raw`x_0`} /> auf der x-Achse und damit einen Punkt P <InlineMath math={String.raw`(x_0 | f(x_0))`} /> auf dem Graphen <InlineMath math={String.raw`G_f`} />.
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#e6edf3", margin: "0 0 12px" }}>
                2. Schritt: Tangentengleichung durch diesen Punkt bestimmen
              </h3>
              <BlockMath math={String.raw`T: y = mx + t`} />
              <BlockMath math={String.raw`m = f'(x_0)`} />
              <p style={{ margin: 0, marginBottom: 10 }}>
                Punkt P liegt auf der Tangente, daher:
              </p>
              <BlockMath math={String.raw`\begin{align*}
                y &= mx + t \\
                f(x_0) &= f'(x_0) \cdot x_0 + t \\
                t &= f(x_0) - f'(x_0) \cdot x_0
              \end{align*}`} />
              <p style={{ margin: 0, marginBottom: 10 }}>
                Die Tangentengleichung ist:
              </p>
              <BlockMath math={String.raw`\begin{align*}
                T: y &= f'(x_0) \cdot x + f(x_0) - f'(x_0) \cdot x_0 \\
                &= f'(x_0) \cdot (x - x_0) + f(x_0)
              \end{align*}`} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#e6edf3", margin: "0 0 12px" }}>
                3. Schritt: Schnittpunkt der Tangente mit der x-Achse bestimmen
              </h3>
              <p style={{ margin: 0, marginBottom: 10 }}>
                Setze <InlineMath math={String.raw`y = 0`} />:
              </p>
              <BlockMath math={String.raw`\begin{align*}
                0 &= f'(x_0) \cdot (x - x_0) + f(x_0) \\
                -f(x_0) &= f'(x_0) \cdot (x - x_0) \\
                -\frac{f(x_0)}{f'(x_0)} &= x - x_0 \\
                x &= x_0 - \frac{f(x_0)}{f'(x_0)}
              \end{align*}`} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#e6edf3", margin: "0 0 12px" }}>
                4. Schritt: Wiederholen
              </h3>
              <p style={{ margin: 0, marginBottom: 10 }}>
                Wiederhole die Schritte mit dem nächsten Wert <InlineMath math={String.raw`x_1`} />, bis sich die Ergebnisse kaum noch ändern.
              </p>
            </div>

            <div style={{ background: "#0d1117", border: "2px solid #38bdf8", borderRadius: 8, padding: 16, marginTop: 20 }}>
              <p style={{ margin: 0, marginBottom: 8, color: "#38bdf8", fontWeight: 600 }}>
                📌 Iterative Formel des Newtonverfahrens:
              </p>
              <BlockMath math={String.raw`x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}