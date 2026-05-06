export function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}
