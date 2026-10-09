type TopQuestionsTableProps = {
  items: Array<{ question: string; count: number }>;
  title?: string;
};

export function TopQuestionsTable({ items, title = "Top-Fragen" }: TopQuestionsTableProps) {
  return (
    <div className="dashboard-card">
      <h3 className="dashboard-card-title dashboard-card-title--sm">{title}</h3>
      {items.length === 0 ? (
        <div>Keine Daten vorhanden.</div>
      ) : (
        <table className="dashboard-table dashboard-table-simple">
          <tbody>
            {items.map((item) => (
              <tr key={item.question}>
                <td className="dashboard-td">{item.question}</td>
                <td className="dashboard-td dashboard-td--right">{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
