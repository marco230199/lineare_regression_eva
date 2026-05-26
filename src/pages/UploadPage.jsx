import { useState, useEffect, useMemo, useCallback } from "react";
import { linearRegression } from "../lib/math";

const SVG_WIDTH = 760;
const SVG_HEIGHT = 470;
const CHART_MARGIN = { top: 32, right: 34, bottom: 48, left: 58 };

function detectSeparator(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const candidates = [",", ";", "\t"];
  let best = candidates[0];
  let maxCount = 0;
  for (const sep of candidates) {
    const count = firstLine.split(sep).length;
    if (count > maxCount) {
      maxCount = count;
      best = sep;
    }
  }
  return best;
}

export default function UploadPage() {
  const [rawCsv, setRawCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [uploadedData, setUploadedData] = useState([]);
  const [xKey, setXKey] = useState("");
  const [yKey, setYKey] = useState("");
  const [error, setError] = useState("");
  const [separator, setSeparator] = useState("auto");
  const [hasHeader, setHasHeader] = useState(true);

  const parseData = useCallback(() => {
    const source = rawCsv.trim();
    if (!source) {
      setError("");
      setHeaders([]);
      setUploadedData([]);
      return;
    }

    const sep = separator === "auto" ? detectSeparator(source) : separator;
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      setError("Die Datei muss mindestens Header und eine Datenzeile enthalten.");
      setUploadedData([]);
      return;
    }

    const rows = lines.map((line) => line.split(sep).map((value) => value.trim()));
    const headerRow = hasHeader
      ? rows[0].map((cell, index) => cell || `Spalte ${index + 1}`)
      : rows[0].map((_, index) => `Spalte ${index + 1}`);
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const items = dataRows
      .map((row) => {
        const item = {};
        for (let i = 0; i < headerRow.length; i += 1) {
          const value = parseFloat(row[i]?.replace(",", ".") ?? "");
          item[headerRow[i]] = Number.isFinite(value) ? value : NaN;
        }
        return item;
      })
      .filter((item) => Object.values(item).some((value) => Number.isFinite(value)));

    if (items.length === 0) {
      setError("Keine numerischen Daten gefunden.");
      setUploadedData([]);
      setHeaders(headerRow);
      return;
    }

    const chosenX = headerRow.includes(xKey) ? xKey : headerRow[0];
    const chosenY = headerRow.includes(yKey) && yKey !== chosenX
      ? yKey
      : headerRow.find((name) => name !== chosenX) || headerRow[1] || headerRow[0];

    setError("");
    setHeaders(headerRow);
    setUploadedData(items);
    setXKey(chosenX);
    setYKey(chosenY);
  }, [rawCsv, separator, hasHeader, xKey, yKey]);

  useEffect(() => {
    parseData();
  }, [parseData]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setRawCsv(reader.result ?? "");
    reader.readAsText(file);
  };

  const plotPoints = useMemo(() => {
    if (!uploadedData.length || !xKey || !yKey || xKey === yKey) return [];
    return uploadedData
      .map((row) => ({ x: row[xKey], y: row[yKey] }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  }, [uploadedData, xKey, yKey]);

  const xValues = plotPoints.map((p) => p.x);
  const yValues = plotPoints.map((p) => p.y);
  const xMin = Math.min(0, ...xValues);
  const xMax = Math.max(1, ...xValues);
  const yMin = Math.min(0, ...yValues);
  const yMax = Math.max(1, ...yValues);

  const niceTickStep = (value) => {
    const raw = Math.max(1, value / 5);
    const steps = [1, 5, 10, 50, 100, 500, 1000];
    return steps.find((step) => raw <= step) ?? 1000;
  };

  const plotXMax = Math.ceil(xMax / niceTickStep(xMax)) * niceTickStep(xMax);
  const plotYMax = Math.ceil(yMax / niceTickStep(yMax)) * niceTickStep(yMax);
  const plotWidth = SVG_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotHeight = SVG_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const xScale = (x) => CHART_MARGIN.left + ((x - xMin) / (plotXMax - xMin)) * plotWidth;
  const yScale = (y) => SVG_HEIGHT - CHART_MARGIN.bottom - ((y - yMin) / (plotYMax - yMin)) * plotHeight;

  const xTick = niceTickStep(plotXMax);
  const yTick = niceTickStep(plotYMax);
  const xTicks = Array.from({ length: Math.floor(plotXMax / xTick) + 1 }, (_, i) => i * xTick);
  const yTicks = Array.from({ length: Math.floor(plotYMax / yTick) + 1 }, (_, i) => i * yTick);

  const regression = useMemo(() => plotPoints.length > 1 ? linearRegression(plotPoints) : null, [plotPoints]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d1117", color: "#e6edf3", padding: "24px", fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Reale Daten hochladen</h1>
          <p style={{ color: "#8b949e", marginBottom: 16 }}>Lade eine CSV-Datei mit zwei numerischen Spalten hoch und stelle die Daten als Scatterplot dar.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
          <div style={{ border: "1px solid #30363d", borderRadius: 8, padding: 16, backgroundColor: "#161b22" }}>
            <div style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Datenquelle</div>

            <label style={{ display: "block", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
              Datei hochladen
              <input type="file" accept=".csv,.txt" onChange={handleFileChange} style={{ display: "block", marginTop: 8 }} />
            </label>
            <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 16 }}>{fileName || "Keine Datei ausgewählt"}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                Headerzeile verwenden
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                Trennzeichen
                <select value={separator} onChange={(e) => setSeparator(e.target.value)} style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, padding: "6px 10px" }}>
                  <option value="auto">Auto</option>
                  <option value=",">Komma</option>
                  <option value=";">Semikolon</option>
                  <option value="\t">Tab</option>
                </select>
              </label>
            </div>

            <label style={{ display: "block", marginBottom: 16 }}>
              Rohdaten / CSV-Vorschau
              <textarea
                value={rawCsv}
                onChange={(e) => setRawCsv(e.target.value)}
                rows={10}
                style={{ width: "100%", marginTop: 8, background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 8, padding: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}
              />
            </label>

            {error && <div style={{ color: "#f85149", fontSize: 13, marginBottom: 16 }}>{error}</div>}

            {headers.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                  x-Wert
                  <select value={xKey} onChange={(e) => setXKey(e.target.value)} style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, padding: "8px" }}>
                    {headers.map((header) => (
                      <option key={`x-${header}`} value={header}>{header}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                  y-Wert
                  <select value={yKey} onChange={(e) => setYKey(e.target.value)} style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, padding: "8px" }}>
                    {headers.map((header) => (
                      <option key={`y-${header}`} value={header}>{header}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div style={{ fontSize: 12, color: "#8b949e" }}>
              {plotPoints.length > 0 ? `Punkte: ${plotPoints.length}` : "Noch keine Plot-Daten verfügbar."}
            </div>
          </div>

          <div style={{ border: "1px solid #30363d", borderRadius: 8, padding: 16, backgroundColor: "#161b22" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Grafik</div>
            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} style={{ width: "100%", height: "auto", backgroundColor: "#0d1117", borderRadius: 8 }}>
              <rect x={CHART_MARGIN.left} y={CHART_MARGIN.top} width={SVG_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right} height={SVG_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom} fill="#0d1117" />
              {xTicks.map((tick) => (
                <line key={`gx-${tick}`} x1={xScale(tick)} y1={CHART_MARGIN.top} x2={xScale(tick)} y2={SVG_HEIGHT - CHART_MARGIN.bottom} stroke="#21262d" strokeWidth="1" />
              ))}
              {yTicks.map((tick) => (
                <line key={`gy-${tick}`} x1={CHART_MARGIN.left} y1={yScale(tick)} x2={SVG_WIDTH - CHART_MARGIN.right} y2={yScale(tick)} stroke="#21262d" strokeWidth="1" />
              ))}
              <line x1={CHART_MARGIN.left} y1={SVG_HEIGHT - CHART_MARGIN.bottom} x2={SVG_WIDTH - CHART_MARGIN.right} y2={SVG_HEIGHT - CHART_MARGIN.bottom} stroke="#30363d" strokeWidth="1.5" />
              <line x1={CHART_MARGIN.left} y1={CHART_MARGIN.top} x2={CHART_MARGIN.left} y2={SVG_HEIGHT - CHART_MARGIN.bottom} stroke="#30363d" strokeWidth="1.5" />
              {yTicks.map((tick) => (
                <g key={`ylabel-${tick}`} transform={`translate(${CHART_MARGIN.left}, ${yScale(tick)})`}>
                  <line x2="-7" stroke="#30363d" />
                  <text x="-14" y="4" textAnchor="end" fill="#8b949e" fontSize="12">{tick}</text>
                </g>
              ))}
              {xTicks.map((tick) => (
                <g key={`xlabel-${tick}`} transform={`translate(${xScale(tick)}, ${SVG_HEIGHT - CHART_MARGIN.bottom})`}>
                  <line y2="7" stroke="#30363d" />
                  <text y="26" textAnchor="middle" fill="#8b949e" fontSize="12">{tick}</text>
                </g>
              ))}
              <text x={18} y={SVG_HEIGHT / 2} textAnchor="middle" fill="#8b949e" fontSize="12" transform={`rotate(-90 18 ${SVG_HEIGHT / 2})`}>{yKey || "y"}</text>
              <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 10} textAnchor="middle" fill="#8b949e" fontSize="12">{xKey || "x"}</text>
              {regression && (
                <line
                  x1={xScale(xMin)}
                  y1={yScale(regression.intercept + regression.slope * xMin)}
                  x2={xScale(plotXMax)}
                  y2={yScale(regression.intercept + regression.slope * plotXMax)}
                  stroke="#3fb950"
                  strokeWidth="2"
                  strokeDasharray="8 6"
                  opacity="0.8"
                />
              )}
              {plotPoints.map((point, index) => (
                <circle key={`dot-${index}`} cx={xScale(point.x)} cy={yScale(point.y)} r="6" fill="#1f6feb" stroke="#e6edf3" strokeWidth="2" />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
