type ActivePagesTableProps = {
  items: Array<{ pageUrl: string; count: number }>;
};

export function ActivePagesTable({ items }: ActivePagesTableProps) {
  return (
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>Aktivste Seiten</h3>
      {items.length === 0 ? (
        <div>Keine Daten vorhanden.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {items.map((item) => (
              <tr key={item.pageUrl}>
                <td style={tdStyle}>{item.pageUrl}</td>
                <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};

const tdStyle: CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #f3f4f6",
};
import type { CSSProperties } from "react";
