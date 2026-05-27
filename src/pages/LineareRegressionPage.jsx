import { useState, useEffect, useMemo } from "react";
import katex from "katex";
import { INITIAL_DATASETS } from "../data/initialDatasets";
import { clamp } from "../lib/funcs";
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

function niceTickStep(value) {
  const raw = Math.max(1, value / 5);
  const steps = [1, 5, 10, 50, 100, 500, 1000];
  return steps.find((step) => raw <= step) ?? 1000;
}

export default function LineareRegressionPage() {
  const [datasetKey, setDatasetKey] = useState("heightShoeSize");
  const [datasets, setDatasets] = useState(INITIAL_DATASETS);
  const [slope, setSlope] = useState(0.8);
  const [intercept, setIntercept] = useState(1.0);
  const [showLine, setShowLine] = useState(true);
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

  const lineY1 = slope * plotXMin + intercept;
  const lineY2 = slope * plotXMax + intercept;

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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", padding: "24px", color: "#e6edf3", fontFamily: "'IBM Plex Mono', monospace" }}>
        <h1 style={{ fontFamily: "'Spectral', serif", fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.02em", color: "#e6edf3" }}>
          Lineare Regression
        </h1>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>Simulation: Lineare Regression</h1>
          <section style={{ color: "#c9d1d9", marginBottom: "16px", textAlign: "left", lineHeight: 1.55 }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#e6edf3", margin: "0 0 10px" }}>Lernaufgaben</h2>
            <ol style={{ margin: 0, paddingLeft: "22px" }}>
              <li style={{ marginBottom: "6px" }}>Versuche jeweils, eine Gerade durch die Punkte zu legen, die die Datenpunkte am besten beschreibt.</li>
              <li style={{ marginBottom: "6px" }}>
                Gib jeweils die Funktionsgleichung deiner Geraden in der Form <InlineMath math="f(x)=m\cdot x+t" /> an.
              </li>
              <li style={{ marginBottom: "6px" }}>
                Berechne:
                <ul style={{ margin: "6px 0 0", paddingLeft: "22px" }}>
                  <li>Jeweils die Schuhgröße einer Person mit einer Körpergröße von <InlineMath math={String.raw`1{,}77\,\mathrm{m}`} /> und <InlineMath math={String.raw`1{,}1\,\mathrm{m}`} />.</li>
                  <li>Die Lerndauer einer Person mit der Note <InlineMath math={String.raw`2`} />.</li>
                  <li>In der Stadt hat ein neues Sonnenbrillengeschäft aufgemacht. Damit wurden sehr viel mehr Sonnenbrillen als die letzten Jahre verkauft, 200 Sonnenbrillen an der Zahl. Berechne, wie viel Eiscreme verkauft wurde.</li>
                  <li>Die Anzahl der Bakterien nach <InlineMath math={String.raw`20`} /> Tagen.</li>
                  <li>Das Leistungsvermögen einer Person mit einem Stresslevel von <InlineMath math={String.raw`8.9`} />.</li>
                </ul>
              </li>
              <li>Beurteile, wie sinnvoll deine Ergebnisse / Vorhersagen sind.</li>
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

              {points.map((point) => (
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
                </g>
              ))}

              {/* <g transform={`translate(${SVG_WIDTH - 232}, ${CHART_MARGIN.top + 8})`}>
                <rect width="206" height="50" rx="12" fill="#161b22" stroke="rgba(48, 54, 61, 0.45)" strokeWidth="1" />
                <line x1="16" y1="22" x2="50" y2="22" stroke="#1f6feb" strokeWidth="4" strokeLinecap="round" />
                <text x="60" y="27" fill="#8b949e" fontSize="12">deine Gerade</text>
              </g> */}
            </svg>
            <div style={{ marginTop: "24px", border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22" }}>
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Werte</div>

              <div style={{ backgroundColor: "#1f3a5f", padding: "16px", borderRadius: "8px", marginBottom: "12px" }}>
                {/* <div style={{ fontSize: "12px", color: "#79c0ff", marginBottom: "4px" }}>Deine Gerade</div>
                <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: "bold", color: "#e6edf3" }}>ŷ = {slope.toFixed(2)}x {intercept >= 0 ? "+" : "−"} {Math.abs(intercept).toFixed(2)}</div> */}
              </div>
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
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {dataset.editable && (
                  <button onClick={resetEditableDataset} style={{ padding: "10px 16px", backgroundColor: "transparent", color: "#1f6feb", border: "1px solid #1f6feb", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>↻ Punkte zurücksetzen</button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
