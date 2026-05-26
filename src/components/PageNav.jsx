import React from "react";

export default function PageNav({ page, setPage }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto 22px", display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className={page === "lr" ? "btn btn-start" : "btn btn-dark"} onClick={() => setPage("gd")}>1 · Lineare Regression</button>
      <button className={page === "loss" ? "btn btn-start" : "btn btn-dark"} onClick={() => setPage("loss")}>2 · Lossfunktion</button>
      <button className={page === "lossM" ? "btn btn-start" : "btn btn-dark"} onClick={() => setPage("lossM")}>3 · Lossfunktion minimieren</button>
      <button className={page === "upload" ? "btn btn-start" : "btn btn-dark"} onClick={() => setPage("upload")}>4 · Daten hochladen</button>
      <button className={page === "newton" ? "btn btn-start" : "btn btn-dark"} onClick={() => setPage("newton")}>5 · Newton-Verfahren</button>
      <button className={page === "ml" ? "btn btn-start" : "btn btn-dark"} onClick={() => setPage("ml")}>6 · Machine Learning</button>



    </div>
  );
}
