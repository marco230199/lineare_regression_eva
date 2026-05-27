import { useState, useEffect } from "react";
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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || null;
  });

  useEffect(() => {
    if (theme === null) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <Shell>
      <PageNav page={page} setPage={setPage} theme={theme} toggleTheme={toggleTheme} />
      {page === "gd" ? <LineareRegressionPage /> : page === "loss" ? <LossfunctionPage /> : page === "lossM" ? <LossfunctionMinimizePage /> : page === "newton" ? <NewtonPage /> : page === "ml" ? <MachineLearningPage /> : <UploadPage />}
    </Shell>
  );
}

export default App;
