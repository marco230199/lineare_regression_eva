import { useState, useEffect, useMemo } from "react";
import katex from "katex";
import { INITIAL_DATASETS } from "../data/initialDatasets";
import { clamp, round2 } from "../lib/funcs";
import { linearRegression } from "../lib/math";

const SVG_WIDTH = 760;
const SVG_HEIGHT = 470;
const CHART_MARGIN = { top: 32, right: 34, bottom: 48, left: 58 };

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
    />
  );
}

function toSubscript(n) {
  const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return String(n)
    .split('')
    .map((d) => map[d] ?? d)
    .join('');
}

function niceTickStep(value) {
  const raw = Math.max(1, value / 5);
  const steps = [1, 5, 10, 50, 100, 500, 1000];
  return steps.find((step) => raw <= step) ?? 1000;
}

export default function LossfunctionPage() {
  const [datasetKey, setDatasetKey] = useState("heightShoeSize");
  const [datasets, setDatasets] = useState(INITIAL_DATASETS);
  const [slope, setSlope] = useState(0.8);
  const [intercept, setIntercept] = useState(1.0);
  const [showLine, setShowLine] = useState(true);
  const [showResiduals, setShowResiduals] = useState(true);
  const [showLoss, setShowLoss] = useState(true);
  const [showLossFormula, setShowLossFormula] = useState(false);
  const [showOptimalLine, setShowOptimalLine] = useState(false);
  const [draggedId, setDraggedId] = useState(null);

  const dataset = datasets[datasetKey];
  const points = dataset.points;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const plotXMin = 0;
  const plotYMin = 0;
  const plotXMax = Math.max(1, Math.ceil((xMax + xMax * 0.08) / niceTickStep(xMax)) * niceTickStep(xMax));
  const plotYMax = Math.max(1, Math.ceil((yMax + yMax * 0.08) / niceTickStep(yMax)) * niceTickStep(yMax));
  const plotWidth = SVG_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotHeight = SVG_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

  const xScale = (x) => CHART_MARGIN.left + ((x - plotXMin) / (plotXMax - plotXMin)) * plotWidth;
  const yScale = (y) => SVG_HEIGHT - CHART_MARGIN.bottom - ((y - plotYMin) / (plotYMax - plotYMin)) * plotHeight;

  const xStep = dataset.editable ? 1 : niceTickStep(plotXMax);
  const explicitYStep = datasetKey === "threePoints" || dataset.editable ? 1 : null;
  const yStep = explicitYStep ?? niceTickStep(plotYMax);
  const xTicks = Array.from({ length: Math.floor(plotXMax / xStep) + 1 }, (_, i) => i * xStep);
  const yTicks = Array.from({ length: Math.floor(plotYMax / yStep) + 1 }, (_, i) => i * yStep);

  const regression = useMemo(() => linearRegression(points), [points]);

  const dataSlope = (yMax - yMin) / Math.max(1, xMax - xMin);
  const slopeRange = Math.max(1, Math.abs(dataSlope) * 2, Math.abs(regression.slope) * 2);
  const slopeMin = -slopeRange;
  const slopeMax = slopeRange;
  const interceptSpan = Math.max(yMax - yMin, Math.abs(regression.intercept), 1) * 1.5;
  const interceptMin = regression.intercept - interceptSpan;
  const interceptMax = regression.intercept + interceptSpan;

  useEffect(() => {
    setSlope((current) => clamp(current, slopeMin, slopeMax));
    setIntercept((current) => clamp(current, interceptMin, interceptMax));
  }, [datasetKey, slopeMin, slopeMax, interceptMin, interceptMax]);

  const enrichedPoints = useMemo(
    () =>
      points.map((point) => {
        const prediction = slope * point.x + intercept;
        const residual = point.y - prediction;
        return { ...point, prediction, residual, squaredError: residual ** 2 };
      }),
    [points, slope, intercept]
  );

  const mseValue = useMemo(
    () => enrichedPoints.reduce((sum, p) => sum + p.squaredError, 0) / enrichedPoints.length,
    [enrichedPoints]
  );
  const sseValue = useMemo(
    () => enrichedPoints.reduce((sum, p) => sum + p.squaredError, 0),
    [enrichedPoints]
  );
  const regressionSseValue = useMemo(
    () => points.reduce((sum, point) => {
      const residual = point.y - (regression.slope * point.x + regression.intercept);
      return sum + residual ** 2;
    }, 0),
    [points, regression.slope, regression.intercept]
  );

  const lineY1 = slope * plotXMin + intercept;
  const lineY2 = slope * plotXMax + intercept;
  const fittedY1 = regression.slope * plotXMin + regression.intercept;
  const fittedY2 = regression.slope * plotXMax + regression.intercept;

  function updateEditablePoint(id, clientX, clientY, svgElement) {
    if (!dataset.editable || !svgElement) return;
    const rect = svgElement.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / rect.width) * SVG_WIDTH;
    const viewY = ((clientY - rect.top) / rect.height) * SVG_HEIGHT;
    const rawNextX = clamp(
      plotXMin + ((viewX - CHART_MARGIN.left) / (SVG_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right)) * (plotXMax - plotXMin),
      plotXMin,
      plotXMax
    );
    const rawNextY = clamp(
      plotYMin + ((SVG_HEIGHT - CHART_MARGIN.bottom - viewY) / (SVG_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom)) * (plotYMax - plotYMin),
      plotYMin,
      plotYMax
    );
    const nextX = Math.round(rawNextX);
    const nextY = Math.round(rawNextY);

    setDatasets((current) => ({
      ...current,
      [datasetKey]: {
        ...current[datasetKey],
        points: current[datasetKey].points.map((point) => (point.id === id ? { ...point, x: nextX, y: nextY } : point)),
      },
    }));
  }

  function resetEditableDataset() {
    setDatasets((current) => ({
      ...current,
      editable: INITIAL_DATASETS.editable,
    }));
  }

  function updateEditablePointValue(id, field, value) {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return;
    const clamped = field === "x" ? clamp(parsed, plotXMin, plotXMax) : clamp(parsed, plotYMin, plotYMax);

    setDatasets((current) => ({
      ...current,
      [datasetKey]: {
        ...current[datasetKey],
        points: current[datasetKey].points.map((point) =>
          point.id === id ? { ...point, [field]: clamped } : point
        ),
      },
    }));
  }

  function setLineToOptimal() {
    setSlope(round2(regression.slope));
    setIntercept(round2(regression.intercept));
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", padding: "24px", color: "#e6edf3", fontFamily: "'IBM Plex Mono', monospace" }}>
      <h1 style={{ fontFamily: "'Spectral', serif", fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.02em", color: "#e6edf3" }}>
          Lossfunktion
        </h1>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>Simulation: Lineare Regression</h1>
          <section style={{ color: "#c9d1d9", marginBottom: "16px", textAlign: "left", lineHeight: 1.55 }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#e6edf3", margin: "0 0 10px" }}>Lernaufgaben</h2>
            <ol style={{ margin: 0, paddingLeft: "22px" }}>
              <li style={{ marginBottom: "6px" }}>
                Versuche wieder eine möglichst gut passende Gerade durch die Punkte der unterschiedlichen Datensätze zu legen. Beschreibe dieses mal, wie du dabei vorgehst.
                <div style={{ color: "#8b949e", fontStyle: "italic", marginTop: "4px" }}>Hinweis: Du kannst in der Simulation den Button „Residuen anzeigen" drücken.</div>
              </li>
              <li style={{ marginBottom: "6px" }}>
                Wähle jetzt den Datensatz „3 Punkte" aus. Stelle als Regressionsgerade die Gerade <InlineMath math={String.raw`y = 0{,}5x + 1`} /> und danach die Gerade <InlineMath math={String.raw`y = 0{,}8x + 0{,}5`} /> ein. Beurteile, welche besser passt.
              </li>
              <li style={{ marginBottom: "6px" }}>
                Klicke jetzt auf „Lossfunktion anzeigen". Das ist die Formel, mit der ausgerechnet wird, wie gut die Gerade durch die Punkte gelegt wurde. Erkläre diese Formel mithilfe des Graphen.
              </li>
              <li style={{ marginBottom: "6px" }}>Überlege dir einen Grund, warum die Abstände der Punkte zu der Geraden quadriert werden, anstatt sie einfach zu addieren.</li>
              <li style={{ marginBottom: "6px" }}>
                Gehe wieder zum Datensatz „3 Punkte" und stelle nacheinander die beiden oben angegebenen Geraden ein. Berechne jeweils den Loss <InlineMath math={String.raw`L`} /> für beide Geraden, indem du die Abstände der Punkte zu den Geraden am Graphen abliest und in die Formel für <InlineMath math={String.raw`L`} /> einsetzt.
              </li>
              <li>
                Berechne den Verlust <InlineMath math={String.raw`L`} /> für beide Geraden, indem du die Formel für <InlineMath math={String.raw`L`} /> direkt für die drei angegebenen Punkte anwendest.
              </li>
            </ol>
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "24px" }}>
          <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22" }}>
            <div style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600" }}>Koordinatensystem</div>
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              style={{ width: "100%", height: "auto", backgroundColor: "#0d1117", borderRadius: "8px", cursor: dataset.editable ? "grab" : "default" }}
              onPointerMove={(event) => {
                if (draggedId) updateEditablePoint(draggedId, event.clientX, event.clientY, event.currentTarget);
              }}
              onPointerUp={() => setDraggedId(null)}
              onPointerLeave={() => setDraggedId(null)}
            >
              <rect x={CHART_MARGIN.left} y={CHART_MARGIN.top} width={SVG_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right} height={SVG_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom} fill="#0d1117" />

              <g>
                {xTicks.map((tick) => (
                  <line key={`grid-x-${tick}`} x1={xScale(tick)} y1={CHART_MARGIN.top} x2={xScale(tick)} y2={SVG_HEIGHT - CHART_MARGIN.bottom} stroke="#21262d" strokeWidth="1" />
                ))}
                {yTicks.map((tick) => (
                  <line key={`grid-y-${tick}`} x1={CHART_MARGIN.left} y1={yScale(tick)} x2={SVG_WIDTH - CHART_MARGIN.right} y2={yScale(tick)} stroke="#21262d" strokeWidth="1" />
                ))}
                <line x1={CHART_MARGIN.left} y1={CHART_MARGIN.top} x2={CHART_MARGIN.left} y2={SVG_HEIGHT - CHART_MARGIN.bottom} stroke="#30363d" strokeWidth="1.5" />
                {yTicks.map((tick) => (
                  <g key={`y-${tick}`} transform={`translate(${CHART_MARGIN.left}, ${yScale(tick)})`}>
                    <line x2="-7" stroke="#30363d" />
                    <text x="-14" y="4" textAnchor="end" fill="#8b949e" fontSize="12">{tick}</text>
                  </g>
                ))}
                <text x="18" y={SVG_HEIGHT / 2} textAnchor="middle" fill="#8b949e" fontSize="12" transform={`rotate(-90 18 ${SVG_HEIGHT / 2})`}>{dataset.yLabel}</text>
              </g>

              <g>
                <line x1={CHART_MARGIN.left} y1={SVG_HEIGHT - CHART_MARGIN.bottom} x2={SVG_WIDTH - CHART_MARGIN.right} y2={SVG_HEIGHT - CHART_MARGIN.bottom} stroke="#30363d" strokeWidth="1.5" />
                {xTicks.map((tick) => (
                  <g key={`x-${tick}`} transform={`translate(${xScale(tick)}, ${SVG_HEIGHT - CHART_MARGIN.bottom})`}>
                    <line y2="7" stroke="#30363d" />
                    <text y="26" textAnchor="middle" fill="#8b949e" fontSize="12">{tick}</text>
                  </g>
                ))}
                <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 10} textAnchor="middle" fill="#8b949e" fontSize="12">{dataset.xLabel}</text>
              </g>
              {showResiduals &&
                enrichedPoints.map((point) => (
                  <line
                    key={`residual-${point.id}`}
                    x1={xScale(point.x)}
                    y1={yScale(point.y)}
                    x2={xScale(point.x)}
                    y2={yScale(point.prediction)}
                    stroke="#f85149"
                    strokeWidth="2.5"
                    strokeDasharray="6 5"
                  />
                ))}

              {showLine && (
                <line
                  x1={xScale(plotXMin)}
                  y1={yScale(lineY1)}
                  x2={xScale(plotXMax)}
                  y2={yScale(lineY2)}
                  stroke="#1f6feb"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              )}

              {showOptimalLine && (
                <line
                  x1={xScale(plotXMin)}
                  y1={yScale(fittedY1)}
                  x2={xScale(plotXMax)}
                  y2={yScale(fittedY2)}
                  stroke="#3fb950"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="10 8"
                  opacity="0.45"
                />
              )}

              {enrichedPoints.map((point, i) => (
                <g key={point.id}>
                  <circle
                    cx={xScale(point.x)}
                    cy={yScale(point.y)}
                    r={draggedId === point.id ? 9 : 7}
                    fill="#e6edf3"
                    stroke="#0d1117"
                    strokeWidth="3"
                    style={{ cursor: dataset.editable ? "grab" : "default" }}
                    onPointerDown={(event) => {
                      if (!dataset.editable) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggedId(point.id);
                    }}
                  />
                  {showLossFormula && (
                    <text x={xScale(point.x) + 10} y={yScale(point.y) - 10} fill="#79c0ff" fontSize="12" fontFamily="'IBM Plex Mono', monospace">{`y${toSubscript(i + 1)}`}</text>
                  )}
                </g>
              ))}

              {showLossFormula && datasetKey === "threePoints" &&
                enrichedPoints.map((point, i) => (
                  <g key={`pred-${point.id}`}>
                    <circle
                      cx={xScale(point.x)}
                      cy={yScale(point.prediction)}
                      r="5"
                      fill="none"
                      stroke="#3fb950"
                      strokeWidth="2"
                    />
                    <text
                      x={xScale(point.x) - 15}
                      y={yScale(point.prediction) - 8}
                      fill="#3fb950"
                      fontSize="12"
                      fontFamily="'IBM Plex Mono', monospace"
                    >
                      {`ŷ${toSubscript(i + 1)}`}
                    </text>
                  </g>
                ))}

              {/* <g transform={`translate(${SVG_WIDTH - 232}, ${CHART_MARGIN.top + 8})`}>
                <rect width="206" height={showOptimalLine ? "78" : "50"} rx="12" fill="#161b22" stroke="rgba(48, 54, 61, 0.45)" strokeWidth="1" />
                <line x1="16" y1="22" x2="50" y2="22" stroke="#1f6feb" strokeWidth="4" strokeLinecap="round" />
                <text x="60" y="27" fill="#8b949e" fontSize="12">deine Gerade</text>
                {showOptimalLine && (
                  <>
                    <line x1="16" y1="50" x2="50" y2="50" stroke="#3fb950" strokeWidth="3" strokeDasharray="7 5" opacity="0.7" />
                    <text x="60" y="55" fill="#8b949e" fontSize="12">optimale Regression</text>
                  </>
                )}
              </g> */}
            </svg>
            <div style={{ marginTop: "24px", border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22" }}>
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Werte</div>

              <div style={{ backgroundColor: "#1f3a5f", padding: "16px", borderRadius: "8px", marginBottom: "12px" }}>
                {/* <div style={{ fontSize: "12px", color: "#79c0ff", marginBottom: "4px" }}>Deine Gerade</div>
                <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: "bold", color: "#e6edf3" }}>ŷ = {slope.toFixed(2)}x {intercept >= 0 ? "+" : "−"} {Math.abs(intercept).toFixed(2)}</div> */}
              </div>

              {showLoss && (
                <div style={{ backgroundColor: "#3d1f1a", padding: "16px", borderRadius: "8px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "12px", color: "#f85149", marginBottom: "8px" }}>Loss deiner Gerade</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#f85149" }}>Loss L deiner Gerade</div>
                      <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "bold", color: "#e6edf3" }}>{sseValue.toFixed(3)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#3fb950" }}>Loss L optimale Gerade</div>
                      <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "bold", color: "#e6edf3" }}>{regressionSseValue.toFixed(3)}</div>
                    </div>
                  </div>
                </div>
              )}

              {showOptimalLine && (
                <div style={{ backgroundColor: "#1f3a22", padding: "16px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#3fb950", marginBottom: "8px" }}>Berechnete optimale Gerade</div>
                  <div style={{ fontFamily: "monospace", fontSize: "14px", color: "#e6edf3", marginBottom: "8px" }}>ŷ = {regression.slope.toFixed(2)}x {regression.intercept >= 0 ? "+" : "−"} {Math.abs(regression.intercept).toFixed(2)}</div>
                  <p style={{ fontSize: "12px", color: "#8b949e", margin: 0 }}>Die grün gestrichelte Linie minimiert die Summe der quadrierten Residuen.</p>
                </div>
              )}
              <div style={{ marginTop: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
                <button onClick={() => setShowLossFormula((s) => !s)} style={{ padding: "8px 12px", backgroundColor: showLossFormula ? "#1f6feb" : "transparent", color: showLossFormula ? "#e6edf3" : "#1f6feb", border: showLossFormula ? "none" : "1px solid #1f6feb", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                  {showLossFormula ? "Lossfunktion ausblenden" : "Lossfunktion L anzeigen"}
                </button>
                <div style={{ color: "#8b949e", fontSize: "13px" }}>Label der Punkte als y₁, y₂ ... anzeigen</div>
              </div>

              {showLossFormula && (
                <div style={{ marginTop: "12px", backgroundColor: "#0f1720", padding: "12px", borderRadius: "8px", border: "1px solid #243447" }}>
                  <BlockMath math={String.raw`L = (y_1-\hat{y}_1)^2 + (y_2-\hat{y}_2)^2 + \ldots + (y_n-\hat{y}_n)^2 \\ = (y_1 - (m x_1 + t))^2 + (y_2 - (m x_2 + t))^2 + \ldots + (y_n - (m x_n + t))^2`} />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22" }}>
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Steuerung</div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "8px" }}>Datensatz</label>
                <select
                  value={datasetKey}
                  onChange={(e) => setDatasetKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "#0d1117",
                    color: "#e6edf3",
                    border: "1px solid #30363d",
                    borderRadius: "6px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "13px",
                  }}
                >
                  {Object.entries(datasets).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>
                  <label>Steigung m</label>
                  <span style={{ backgroundColor: "#21262d", padding: "4px 12px", borderRadius: "12px", fontSize: "12px" }}>{slope.toFixed(2)}</span>
                </div>
                <input type="range" min={slopeMin} max={slopeMax} step="0.01" value={slope} onChange={(e) => setSlope(parseFloat(e.target.value))} style={{ width: "100%" }} />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>
                  <label>y-Achsenabschnitt b</label>
                  <span style={{ backgroundColor: "#21262d", padding: "4px 12px", borderRadius: "12px", fontSize: "12px" }}>{intercept.toFixed(2)}</span>
                </div>
                <input type="range" min={interceptMin} max={interceptMax} step="0.01" value={intercept} onChange={(e) => setIntercept(parseFloat(e.target.value))} style={{ width: "100%" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                  <span>Gerade anzeigen</span>
                  <input type="checkbox" checked={showLine} onChange={(e) => setShowLine(e.target.checked)} style={{ cursor: "pointer" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                  <span>Abweichungen anzeigen</span>
                  <input type="checkbox" checked={showResiduals} onChange={(e) => setShowResiduals(e.target.checked)} style={{ cursor: "pointer" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                  <span>Loss anzeigen</span>
                  <input type="checkbox" checked={showLoss} onChange={(e) => setShowLoss(e.target.checked)} style={{ cursor: "pointer" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                  <span>Optimale Gerade anzeigen</span>
                  <input type="checkbox" checked={showOptimalLine} onChange={(e) => setShowOptimalLine(e.target.checked)} style={{ cursor: "pointer" }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button onClick={setLineToOptimal} style={{ padding: "10px 16px", backgroundColor: "#1f6feb", color: "#e6edf3", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Optimale Gerade übernehmen</button>
                {dataset.editable && (
                  <button onClick={resetEditableDataset} style={{ padding: "10px 16px", backgroundColor: "transparent", color: "#1f6feb", border: "1px solid #1f6feb", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>↻ Punkte zurücksetzen</button>
                )}
              </div>

              {dataset.editable && (
                <div style={{ marginTop: "18px", padding: "16px", borderRadius: "8px", border: "1px solid #30363d", backgroundColor: "#0d1117" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>Datenpunkte direkt eingeben</div>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {dataset.points.map((point, index) => (
                      <div key={point.id} style={{ display: "grid", gridTemplateColumns: "54px 1fr 54px 1fr", gap: "8px", alignItems: "center" }}>
                        <span style={{ color: "#8b949e", fontSize: "12px" }}>{`P${index + 1}`}</span>
                        <label style={{ display: "grid", gap: "4px", fontSize: "12px", color: "#8b949e" }}>
                          <span>x</span>
                          <input
                            type="number"
                            value={point.x}
                            step="0.1"
                            onChange={(e) => updateEditablePointValue(point.id, "x", e.target.value)}
                            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #30363d", backgroundColor: "#0d1117", color: "#e6edf3", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}
                          />
                        </label>
                        <span style={{ color: "#8b949e", fontSize: "12px" }}>y</span>
                        <label style={{ display: "grid", gap: "4px", fontSize: "12px", color: "#8b949e" }}>
                          <input
                            type="number"
                            value={point.y}
                            step="0.1"
                            onChange={(e) => updateEditablePointValue(point.id, "y", e.target.value)}
                            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #30363d", backgroundColor: "#0d1117", color: "#e6edf3", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
