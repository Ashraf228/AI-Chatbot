type ActivePagesTableProps = {
  items: Array<{ pageUrl: string; count: number }>;
};

export function ActivePagesTable({ items }: ActivePagesTableProps) {
  return (
    <div className="dashboard-card">
      <h3 className="dashboard-card-title dashboard-card-title--sm">Aktivste Seiten</h3>
      {items.length === 0 ? (
        <div>Keine Daten vorhanden.</div>
      ) : (
        <table className="dashboard-table dashboard-table-simple">
          <tbody>
            {items.map((item) => (
              <tr key={item.pageUrl}>
                <td className="dashboard-td">{item.pageUrl}</td>
                <td className="dashboard-td dashboard-td--right">{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
