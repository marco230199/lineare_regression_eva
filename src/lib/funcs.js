export function fmt(v, digits = 4) {
  if (!Number.isFinite(v)) return "∞";
  if (Math.abs(v) >= 10000 || (Math.abs(v) < 0.0001 && v !== 0)) return v.toExponential(2);
  return v.toFixed(digits);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}
