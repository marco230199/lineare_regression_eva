import { useMemo, useState } from "react";

const ROWS = [
  {
    id: "step-1",
    step: "1. Datensammlung",
    technical: "Die KI erhält riesige Mengen Text, Bücher, Webseiten und Dialoge als Lernmaterial.",
    human: "Ein Kind hört Sprache, sieht Bilder, erlebt Situationen und sammelt Erfahrungen.",
  },
  {
    id: "step-2",
    step: "2. Training",
    technical: "Beim Training versucht die KI, das nächste Wort vorherzusagen. Ihre internen Parameter werden angepasst.",
    human: "Ein Kind übt Sprache durch Wiederholung: Es probiert Wörter aus und verbessert sich durch Erfahrung.",
  },
  {
    id: "step-3",
    step: "3. Fehler messen (Lossfunktion)",
    technical: "Die Lossfunktion misst, wie falsch die Vorhersage der KI war. Hoher Fehler = schlechte Antwort.",
    human: "Ein Kind merkt durch Reaktionen („Das heißt Hund, nicht Katze“) oder eigenes Scheitern, dass etwas falsch war.",
  },
  {
    id: "step-4",
    step: "4. Gewichte anpassen",
    technical: "Die KI verändert Milliarden mathematischer Gewichte, um künftig bessere Antworten zu geben.",
    human: "Im Gehirn verändern sich Verbindungen zwischen Nervenzellen (Synapsen).",
  },
  {
    id: "step-5",
    step: "5. Wiederholung über viele Durchläufe (Epochen)",
    technical: "Die gleichen Daten werden mehrfach verarbeitet, bis die KI stabil lernt.",
    human: "Kinder wiederholen Dinge ständig: Wörter, Bewegungen, Regeln.",
  },
  {
    id: "step-6",
    step: "6. Validation (Validierungsdaten)",
    technical: "Ein Teil der Daten wird nicht zum direkten Lernen genutzt. Damit prüft man, ob die KI wirklich verstanden hat oder nur „auswendig gelernt“ hat.",
    human: "Lehrer testen Kinder mit neuen Aufgaben, die sie vorher nicht exakt gesehen haben.",
  },
  {
    id: "step-7",
    step: "7. Testen",
    technical: "Nach dem Training wird die KI mit komplett neuen Daten geprüft.",
    human: "Klassenarbeiten oder Alltagssituationen prüfen das Wissen eines Kindes.",
  },
  {
    id: "step-8",
    step: "8. Overfitting vermeiden",
    technical: "Die KI soll nicht nur Trainingsdaten auswendig lernen, sondern verallgemeinern können.",
    human: "Kinder sollen nicht nur Antworten auswendig lernen, sondern Konzepte verstehen.",
  },
  {
    id: "step-9",
    step: "9. Feedback nach dem Training",
    technical: "Menschen bewerten Antworten der KI (z. B. RLHF bei ChatGPT). Gute Antworten werden verstärkt.",
    human: "Kinder erhalten Lob, Kritik und soziale Rückmeldungen.",
  },
  {
    id: "step-10",
    step: "10. Nutzung nach dem Lernen",
    technical: "Die KI antwortet auf neue Eingaben basierend auf gelernten Mustern.",
    human: "Ein Kind nutzt gelerntes Wissen im Alltag.",
  },
];

const COLUMNS = [
  { key: "technical", label: "Was passiert technisch?" },
  { key: "human", label: "Vergleich mit menschlichem Lernen (Kind)" },
];

function shuffle(items) {
  return items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

function buildCards() {
  return ROWS.flatMap((row) =>
    COLUMNS.map((column) => ({
      id: `${row.id}-${column.key}`,
      target: `${row.id}-${column.key}`,
      text: row[column.key],
    }))
  );
}

export default function MachineLearningPage() {
  const initialCards = useMemo(() => shuffle(buildCards()), []);
  const [cards, setCards] = useState(initialCards);
  const [placements, setPlacements] = useState({});
  const [checked, setChecked] = useState(false);

  const placedCardIds = new Set(Object.values(placements));
  const bankCards = cards.filter((card) => !placedCardIds.has(card.id));
  const correctCount = Object.entries(placements).filter(([slotId, cardId]) => slotId === cards.find((card) => card.id === cardId)?.target).length;
  const totalSlots = ROWS.length * COLUMNS.length;

  function handleDragStart(event, cardId) {
    event.dataTransfer.setData("text/plain", cardId);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event, slotId) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData("text/plain");
    if (!cardId) return;

    setPlacements((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, placedCardId]) => placedCardId !== cardId));
      return { ...next, [slotId]: cardId };
    });
    setChecked(false);
  }

  function returnCard(cardId) {
    setPlacements((current) => Object.fromEntries(Object.entries(current).filter(([, placedCardId]) => placedCardId !== cardId)));
    setChecked(false);
  }

  function resetTable() {
    setCards(shuffle(buildCards()));
    setPlacements({});
    setChecked(false);
  }

  function getCard(cardId) {
    return cards.find((card) => card.id === cardId);
  }

  function getSlotState(slotId) {
    if (!checked || !placements[slotId]) return "#30363d";
    return placements[slotId] === slotId ? "#2ea043" : "#f85149";
  }

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#0d1117", color: "#e6edf3", padding: "24px", fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Spectral', serif", fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.02em", color: "#e6edf3" }}>
          Machine Learning: Künstliche Intelligenz
        </h1>
        <header style={{ marginBottom: "20px", textAlign: "left" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", margin: "0 0 8px" }}>Machine Learning: Schritte zuordnen</h1>
        </header>

        <section style={{ border: "1px solid #30363d", borderRadius: "8px", backgroundColor: "#161b22", padding: "16px", marginBottom: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600 }}>Einträge</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {checked && <span style={{ color: "#8b949e", fontSize: "13px" }}>{correctCount} von {totalSlots} richtig</span>}
              <button className="btn btn-start" onClick={() => setChecked(true)}>Prüfen</button>
              <button className="btn btn-dark" onClick={resetTable}>Neu mischen</button>
            </div>
          </div>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const cardId = event.dataTransfer.getData("text/plain");
              if (cardId) returnCard(cardId);
            }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}
          >
            {bankCards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(event) => handleDragStart(event, card.id)}
                style={{
                  minHeight: "76px",
                  border: "1px solid #30363d",
                  borderRadius: "8px",
                  backgroundColor: "#0d1117",
                  padding: "10px",
                  color: "#c9d1d9",
                  cursor: "grab",
                  fontSize: "13px",
                  lineHeight: 1.4,
                }}
              >
                {card.text}
              </div>
            ))}
          </div>
        </section>

        <section style={{ overflowX: "auto", border: "1px solid #30363d", borderRadius: "8px", backgroundColor: "#161b22" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1120px", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={headerStyle}>Schritt bei KI (z. B. ChatGPT)</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} style={headerStyle}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id}>
                  <th style={stepCellStyle}>{row.step}</th>
                  {COLUMNS.map((column) => {
                    const slotId = `${row.id}-${column.key}`;
                    const card = getCard(placements[slotId]);
                    return (
                      <td
                        key={slotId}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, slotId)}
                        style={{
                          ...cellStyle,
                          borderColor: getSlotState(slotId),
                          backgroundColor: card ? "#0d1117" : "#111820",
                        }}
                      >
                        {card ? (
                          <div
                            draggable
                            onDragStart={(event) => handleDragStart(event, card.id)}
                            onDoubleClick={() => returnCard(card.id)}
                            style={{ cursor: "grab", color: "#c9d1d9", lineHeight: 1.4 }}
                          >
                            {card.text}
                          </div>
                        ) : (
                          <span style={{ color: "#6e7681" }}>Hier ablegen</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

const headerStyle = {
  borderBottom: "1px solid #30363d",
  borderRight: "1px solid #30363d",
  padding: "12px",
  backgroundColor: "#0d1117",
  color: "#e6edf3",
  fontSize: "13px",
  verticalAlign: "top",
};

const stepCellStyle = {
  borderRight: "1px solid #30363d",
  borderBottom: "1px solid #30363d",
  padding: "12px",
  color: "#e6edf3",
  fontSize: "13px",
  width: "210px",
  verticalAlign: "top",
};

const cellStyle = {
  border: "1px solid #30363d",
  padding: "10px",
  minHeight: "92px",
  width: "300px",
  verticalAlign: "top",
  fontSize: "13px",
};
