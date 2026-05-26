import { useState, useCallback } from "react";

export default function useNewton(initialFunction = "x**3 - x - 2") {
  const [fnExpr, setFnExpr] = useState(initialFunction);
  const [startX, setStartX] = useState(2);
  const [iterations, setIterations] = useState([]);

  const reset = useCallback(() => {
    setIterations([]);
  }, []);

  return {
    fnExpr,
    setFnExpr,
    startX,
    setStartX,
    iterations,
    reset,
  };
}
