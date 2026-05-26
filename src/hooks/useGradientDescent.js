import { useState, useEffect } from "react";

export default function useGradientDescent(initialDatasetKey = "heightShoeSize") {
  const [datasetKey, setDatasetKey] = useState(initialDatasetKey);
  const [showLine, setShowLine] = useState(true);

  useEffect(() => {
    // TODO: Add gradient descent state management here.
  }, [datasetKey]);

  return {
    datasetKey,
    setDatasetKey,
    showLine,
    setShowLine,
  };
}
