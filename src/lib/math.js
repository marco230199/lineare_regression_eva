export function mse(data, w, b) {
  const n = data.length;
  return n === 0 ? 0 : data.reduce((sum, [x, y]) => sum + (w * x + b - y) ** 2, 0) / n;
}

export function gradients(data, w, b) {
  const n = data.length;
  const { dw, db } = data.reduce(
    (acc, [x, y]) => {
      const err = w * x + b - y;
      return { dw: acc.dw + err * x, db: acc.db + err };
    },
    { dw: 0, db: 0 }
  );
  return n === 0 ? [0, 0] : [2 * dw / n, 2 * db / n];
}

export function linearRegression(points) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  const numerator = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  const denominator = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}
