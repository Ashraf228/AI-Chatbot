type SetupMissingItemsProps = {
  items?: string[];
  emptyLabel?: string;
  compact?: boolean;
};

function cleanItem(value: string) {
  return value
    .replace(/Lead-Empfänger-E-Mail/g, "Empfänger für neue Anfragen")
    .replace(/Lead-Zustellung/g, "Anfrage-Zustellung")
    .replace(/Knowledge/g, "Wissen")
    .replace(/Widget/g, "Chatfenster")
    .replace(/Domain/g, "Website")
    .replace(/\bLead\b/g, "Anfrage")
    .trim();
}

export function SetupMissingItems({ items = [], emptyLabel = "Keine offenen Punkte", compact = false }: SetupMissingItemsProps) {
  const visibleItems = items.map(cleanItem).filter(Boolean);

  if (visibleItems.length === 0) {
    return compact ? null : <p className="setup-wizard__missing setup-wizard__missing--empty">{emptyLabel}</p>;
  }

  return (
    <div className={`setup-wizard__missing${compact ? " setup-wizard__missing--compact" : ""}`}>
      <strong>Noch offen</strong>
      <ul>
        {visibleItems.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
