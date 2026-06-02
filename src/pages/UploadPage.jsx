import { useMemo, useState } from "react";
import { clamp, round2 } from "../lib/funcs";
import { linearRegression } from "../lib/math";

const SVG_WIDTH = 760;
const SVG_HEIGHT = 470;
const CHART_MARGIN = { top: 32, right: 34, bottom: 48, left: 58 };
const MAX_RENDER_POINTS = 2500;
const MAX_RENDER_RESIDUALS = 600;

function countSeparator(line, separator) {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === separator) {
      count += 1;
    }
  }

  return count;
}

function detectSeparator(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const candidates = [";", ",", "\t"];
  return candidates.reduce((best, separator) => (
    countSeparator(firstLine, separator) > countSeparator(firstLine, best) ? separator : best
  ), candidates[0]);
}

function parseCsvRows(text, separator) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === separator) {
      row.push(cell.trim());
      cell = "";
    } else if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function uniqueHeaders(row) {
  const counts = new Map();
  return row.map((cell, index) => {
    const baseName = cell.trim() || `Spalte ${index + 1}`;
    const count = counts.get(baseName) || 0;
    counts.set(baseName, count + 1);
    return count === 0 ? baseName : `${baseName} ${count + 1}`;
  });
}

function parseNumber(value) {
  const clean = String(value ?? "").trim().replace(/\s/g, "");
  if (!clean) return NaN;
  const normalized = clean.includes(",") && !clean.includes(".")
    ? clean.replace(",", ".")
    : clean.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

function sampleEvenly(items, maxItems) {
  if (items.length <= maxItems) return items;
  const step = (items.length - 1) / (maxItems - 1);
  return Array.from({ length: maxItems }, (_, index) => items[Math.round(index * step)]);
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 10000 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)) return value.toExponential(2);
  return value.toFixed(digits);
}

function niceTickStep(range) {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / power;
  const factor = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return factor * power;
}

function createTicks(min, max) {
  const range = max - min;
  const step = niceTickStep(range);
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let value = start; value <= max + step * 0.5; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks.length ? ticks : [min, max];
}

function getPlotBounds(points) {
  if (!points.length) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

  let rawXMin = points[0].x;
  let rawXMax = points[0].x;
  let rawYMin = points[0].y;
  let rawYMax = points[0].y;

  for (const point of points) {
    rawXMin = Math.min(rawXMin, point.x);
    rawXMax = Math.max(rawXMax, point.x);
    rawYMin = Math.min(rawYMin, point.y);
    rawYMax = Math.max(rawYMax, point.y);
  }
  const xPadding = Math.max((rawXMax - rawXMin) * 0.08, rawXMax === rawXMin ? 1 : 0);
  const yPadding = Math.max((rawYMax - rawYMin) * 0.08, rawYMax === rawYMin ? 1 : 0);

  return {
    xMin: rawXMin - xPadding,
    xMax: rawXMax + xPadding,
    yMin: rawYMin - yPadding,
    yMax: rawYMax + yPadding,
  };
}

export default function UploadPage() {
  const [rawCsv, setRawCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [separator, setSeparator] = useState("auto");
  const [hasHeader, setHasHeader] = useState(true);
  const [xKey, setXKey] = useState("");
  const [yKey, setYKey] = useState("");
  const [slope, setSlope] = useState(0.8);
  const [intercept, setIntercept] = useState(1);
  const [showLine, setShowLine] = useState(true);
  const [showResiduals, setShowResiduals] = useState(false);
  const [showLoss, setShowLoss] = useState(true);
  const [showOptimalLine, setShowOptimalLine] = useState(false);

  const parsedData = useMemo(() => {
    const source = rawCsv.trim();
    if (!source) {
      return { headers: [], rows: [], error: "" };
    }

    const activeSeparator = separator === "auto" ? detectSeparator(source) : separator;
    const parsedRows = parseCsvRows(source, activeSeparator);
    if (parsedRows.length < 2) {
      return { headers: [], rows: [], error: "Die CSV-Datei braucht mindestens zwei Zeilen." };
    }

    const headerRow = hasHeader
      ? uniqueHeaders(parsedRows[0])
      : uniqueHeaders(parsedRows[0].map((_, index) => `Spalte ${index + 1}`));
    const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;
    const parsedItems = dataRows.map((row, rowIndex) => {
      const item = { id: `row-${rowIndex}` };
      headerRow.forEach((header, index) => {
        item[header] = parseNumber(row[index]);
      });
      return item;
    });

    const numericHeaders = headerRow.filter((header) => parsedItems.some((item) => Number.isFinite(item[header])));
    if (numericHeaders.length < 2) {
      return { headers: numericHeaders, rows: [], error: "Es wurden weniger als zwei numerische Spalten gefunden." };
    }

    return { headers: numericHeaders, rows: parsedItems, error: "" };
  }, [rawCsv, separator, hasHeader]);

  const { headers, rows, error } = parsedData;
  const selectedXKey = headers.includes(xKey) ? xKey : headers[0] || "";
  const selectedYKey = headers.includes(yKey) && yKey !== selectedXKey
    ? yKey
    : headers.find((header) => header !== selectedXKey) || "";

  const points = useMemo(() => {
    if (!selectedXKey || !selectedYKey || selectedXKey === selectedYKey) return [];
    return rows
      .map((row, index) => ({ id: row.id || `point-${index}`, x: row[selectedXKey], y: row[selectedYKey] }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  }, [rows, selectedXKey, selectedYKey]);

  const regression = useMemo(() => points.length > 1 ? linearRegression(points) : { slope: 0, intercept: 0 }, [points]);
  const bounds = useMemo(() => getPlotBounds(points), [points]);
  const { xMin, xMax, yMin, yMax } = bounds;
  const plotWidth = SVG_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotHeight = SVG_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const xScale = (x) => CHART_MARGIN.left + ((x - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (y) => SVG_HEIGHT - CHART_MARGIN.bottom - ((y - yMin) / (yMax - yMin || 1)) * plotHeight;
  const xTicks = useMemo(() => createTicks(xMin, xMax), [xMin, xMax]);
  const yTicks = useMemo(() => createTicks(yMin, yMax), [yMin, yMax]);

  const dataSlope = points.length > 1 ? (yMax - yMin) / Math.max(1e-9, xMax - xMin) : 1;
  const slopeSpan = Math.max(1, Math.abs(dataSlope), Math.abs(regression.slope)) * 1.3;
  const slopeMin = regression.slope - slopeSpan;
  const slopeMax = regression.slope + slopeSpan;
  const interceptSpan = Math.max(yMax - yMin, 1) * 0.9;
  const interceptMin = regression.intercept - interceptSpan;
  const interceptMax = regression.intercept + interceptSpan;

  const activeSlope = clamp(slope, slopeMin, slopeMax);
  const activeIntercept = clamp(intercept, interceptMin, interceptMax);

  const enrichedPoints = useMemo(
    () => points.map((point) => {
      const prediction = activeSlope * point.x + activeIntercept;
      const residual = point.y - prediction;
      return { ...point, prediction, squaredError: residual ** 2 };
    }),
    [points, activeSlope, activeIntercept]
  );

  const sseValue = useMemo(
    () => enrichedPoints.reduce((sum, point) => sum + point.squaredError, 0),
    [enrichedPoints]
  );
  const regressionSseValue = useMemo(
    () => points.reduce((sum, point) => {
      const residual = point.y - (regression.slope * point.x + regression.intercept);
      return sum + residual ** 2;
    }, 0),
    [points, regression.slope, regression.intercept]
  );

  const visiblePoints = useMemo(() => sampleEvenly(enrichedPoints, MAX_RENDER_POINTS), [enrichedPoints]);
  const visibleResiduals = useMemo(() => sampleEvenly(enrichedPoints, MAX_RENDER_RESIDUALS), [enrichedPoints]);
  const lineY1 = activeSlope * xMin + activeIntercept;
  const lineY2 = activeSlope * xMax + activeIntercept;
  const fittedY1 = regression.slope * xMin + regression.intercept;
  const fittedY2 = regression.slope * xMax + regression.intercept;
  const pointRadius = points.length > 1500 ? 2.4 : points.length > 500 ? 3.4 : 6;

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setRawCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function setLineToOptimal() {
    setSlope(round2(regression.slope));
    setIntercept(round2(regression.intercept));
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", padding: "24px", color: "#e6edf3", fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>Daten hochladen</h1>
        </div>

        <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22", marginBottom: "24px", textAlign: "left" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "16px", alignItems: "end" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", display: "block" }}>
              CSV-Datei
              <input type="file" accept=".csv,.txt,text/csv" onChange={handleFileChange} style={{ display: "block", marginTop: "8px", width: "100%" }} />
            </label>
            <label style={{ fontSize: "13px", fontWeight: "600", display: "block" }}>
              Trennzeichen
              <select value={separator} onChange={(event) => setSeparator(event.target.value)} style={{ width: "100%", marginTop: "8px", padding: "8px 12px", backgroundColor: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
                <option value="auto">Automatisch</option>
                <option value=",">Komma</option>
                <option value=";">Semikolon</option>
                <option value="\t">Tab</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", paddingBottom: "9px" }}>
              <input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} />
              Erste Zeile sind Spaltennamen
            </label>
          </div>

          <div style={{ color: "#8b949e", fontSize: "12px", marginTop: "10px" }}>{fileName || "Keine Datei ausgewählt"}</div>
          {error && <div style={{ color: "#f85149", fontSize: "13px", marginTop: "12px" }}>{error}</div>}

          {headers.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "16px", alignItems: "end", marginTop: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block" }}>
                x-Achse
                <select value={selectedXKey} onChange={(event) => setXKey(event.target.value)} style={{ width: "100%", marginTop: "8px", padding: "8px 12px", backgroundColor: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
                  {headers.map((header) => <option key={`x-${header}`} value={header}>{header}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block" }}>
                y-Achse
                <select value={selectedYKey} onChange={(event) => setYKey(event.target.value)} style={{ width: "100%", marginTop: "8px", padding: "8px 12px", backgroundColor: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
                  {headers.map((header) => <option key={`y-${header}`} value={header}>{header}</option>)}
                </select>
              </label>
              <div style={{ color: "#8b949e", fontSize: "12px", paddingBottom: "10px" }}>
                {points.length} gültige Punkte
              </div>
            </div>
          )}
        </div>

        {points.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "24px" }}>
            <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22" }}>
              <div style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600" }}>Koordinatensystem</div>
              <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} style={{ width: "100%", height: "auto", backgroundColor: "#0d1117", borderRadius: "8px" }}>
                <rect x={CHART_MARGIN.left} y={CHART_MARGIN.top} width={plotWidth} height={plotHeight} fill="#0d1117" />

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
                      <text x="-14" y="4" textAnchor="end" fill="#8b949e" fontSize="12">{formatNumber(tick)}</text>
                    </g>
                  ))}
                  <text x="18" y={SVG_HEIGHT / 2} textAnchor="middle" fill="#8b949e" fontSize="12" transform={`rotate(-90 18 ${SVG_HEIGHT / 2})`}>{selectedYKey}</text>
                </g>

                <g>
                  <line x1={CHART_MARGIN.left} y1={SVG_HEIGHT - CHART_MARGIN.bottom} x2={SVG_WIDTH - CHART_MARGIN.right} y2={SVG_HEIGHT - CHART_MARGIN.bottom} stroke="#30363d" strokeWidth="1.5" />
                  {xTicks.map((tick) => (
                    <g key={`x-${tick}`} transform={`translate(${xScale(tick)}, ${SVG_HEIGHT - CHART_MARGIN.bottom})`}>
                      <line y2="7" stroke="#30363d" />
                      <text y="26" textAnchor="middle" fill="#8b949e" fontSize="12">{formatNumber(tick)}</text>
                    </g>
                  ))}
                  <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 10} textAnchor="middle" fill="#8b949e" fontSize="12">{selectedXKey}</text>
                </g>

                {showResiduals && visibleResiduals.map((point, index) => (
                  <line key={`residual-${point.id}-${index}`} x1={xScale(point.x)} y1={yScale(point.y)} x2={xScale(point.x)} y2={yScale(point.prediction)} stroke="#f85149" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.45" />
                ))}

                {showLine && (
                  <line x1={xScale(xMin)} y1={yScale(lineY1)} x2={xScale(xMax)} y2={yScale(lineY2)} stroke="#1f6feb" strokeWidth="4" strokeLinecap="round" />
                )}

                {showOptimalLine && points.length > 1 && (
                  <line x1={xScale(xMin)} y1={yScale(fittedY1)} x2={xScale(xMax)} y2={yScale(fittedY2)} stroke="#3fb950" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 8" opacity="0.55" />
                )}

                {visiblePoints.map((point, index) => (
                  <circle key={`point-${point.id}-${index}`} cx={xScale(point.x)} cy={yScale(point.y)} r={pointRadius} fill="#e6edf3" stroke="#0d1117" strokeWidth="1.5" opacity="0.72" />
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
                  <div style={{ fontSize: "12px", color: "#79c0ff", marginBottom: "4px" }}>Deine Gerade</div>
                  <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: "bold", color: "#e6edf3" }}>ŷ = {formatNumber(activeSlope)}x {activeIntercept >= 0 ? "+" : "−"} {formatNumber(Math.abs(activeIntercept))}</div>
                </div>

                {showLoss && (
                  <div style={{ backgroundColor: "#3d1f1a", padding: "16px", borderRadius: "8px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "12px", color: "#f85149", marginBottom: "8px" }}>Loss deiner Gerade</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "11px", color: "#f85149" }}>SSE deiner Gerade</div>
                        <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "bold", color: "#e6edf3" }}>{formatNumber(sseValue, 3)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "#3fb950" }}>SSE optimale Gerade</div>
                        <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "bold", color: "#e6edf3" }}>{formatNumber(regressionSseValue, 3)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {showOptimalLine && (
                  <div style={{ backgroundColor: "#1f3a22", padding: "16px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#3fb950", marginBottom: "8px" }}>Berechnete optimale Gerade</div>
                    <div style={{ fontFamily: "monospace", fontSize: "14px", color: "#e6edf3", marginBottom: "8px" }}>ŷ = {formatNumber(regression.slope)}x {regression.intercept >= 0 ? "+" : "−"} {formatNumber(Math.abs(regression.intercept))}</div>
                    <p style={{ fontSize: "12px", color: "#8b949e", margin: 0 }}>Die grün gestrichelte Linie minimiert die Summe der quadrierten Residuen.</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22" }}>
                <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Steuerung</div>

                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>
                    <label>Steigung m</label>
                    <span style={{ backgroundColor: "#21262d", padding: "4px 12px", borderRadius: "12px", fontSize: "12px" }}>{formatNumber(activeSlope)}</span>
                  </div>
                  <input type="range" min={slopeMin} max={slopeMax} step={Math.max((slopeMax - slopeMin) / 4000, 0.0005)} value={activeSlope} onChange={(event) => setSlope(parseFloat(event.target.value))} style={{ width: "100%" }} />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>
                    <label>y-Achsenabschnitt b</label>
                    <span style={{ backgroundColor: "#21262d", padding: "4px 12px", borderRadius: "12px", fontSize: "12px" }}>{formatNumber(activeIntercept)}</span>
                  </div>
                  <input type="range" min={interceptMin} max={interceptMax} step={Math.max((interceptMax - interceptMin) / 4000, 0.005)} value={activeIntercept} onChange={(event) => setIntercept(parseFloat(event.target.value))} style={{ width: "100%" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                    <span>Gerade anzeigen</span>
                    <input type="checkbox" checked={showLine} onChange={(event) => setShowLine(event.target.checked)} style={{ cursor: "pointer" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                    <span>Residuen anzeigen</span>
                    <input type="checkbox" checked={showResiduals} onChange={(event) => setShowResiduals(event.target.checked)} style={{ cursor: "pointer" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                    <span>Loss anzeigen</span>
                    <input type="checkbox" checked={showLoss} onChange={(event) => setShowLoss(event.target.checked)} style={{ cursor: "pointer" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0d1117", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                    <span>Optimale Gerade anzeigen</span>
                    <input type="checkbox" checked={showOptimalLine} onChange={(event) => setShowOptimalLine(event.target.checked)} style={{ cursor: "pointer" }} />
                  </div>
                </div>

                <button onClick={setLineToOptimal} disabled={points.length < 2} style={{ width: "100%", padding: "10px 16px", backgroundColor: points.length < 2 ? "#30363d" : "#1f6feb", color: "#e6edf3", border: "none", borderRadius: "6px", cursor: points.length < 2 ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "600" }}>Optimale Gerade übernehmen</button>
              </div>

              <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "16px", backgroundColor: "#161b22", color: "#8b949e", fontSize: "12px", textAlign: "left", lineHeight: 1.5 }}>
                <div style={{ color: "#e6edf3", fontSize: "16px", fontWeight: "600", marginBottom: "10px" }}>Datenmenge</div>
                <div>Berechnung: {points.length} Punkte</div>
                <div>Gezeichnet: {visiblePoints.length} Punkte</div>
                <div>Residuen: bis zu {visibleResiduals.length} Linien</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
