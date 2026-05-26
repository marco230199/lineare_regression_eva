import { useState } from "react";
import Shell from "./components/Shell";
import PageNav from "./components/PageNav";
import LineareRegressionPage from "./pages/LineareRegressionPage";
import LossfunctionPage from "./pages/LossfunctionPage";
import LossfunctionMinimizePage from "./pages/LossfunctionMinimizePage";
import NewtonPage from "./pages/NewtonPage";
import UploadPage from "./pages/UploadPage";
import MachineLearningPage from "./pages/MachineLearningPage";

function App() {
  const [page, setPage] = useState("gd");

  return (
    <Shell>
      <PageNav page={page} setPage={setPage} />
      {page === "gd" ? <LineareRegressionPage /> : page === "loss" ? <LossfunctionPage /> : page === "lossM" ? <LossfunctionMinimizePage /> : page === "newton" ? <NewtonPage /> : page === "ml" ? <MachineLearningPage /> : <UploadPage />}
    </Shell>
  );
}

export default App;
