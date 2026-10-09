export function chunkText(text: string, chunkSize = 1200, overlap = 200): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + chunkSize, clean.length);
    chunks.push(clean.slice(i, end));
    i = end - overlap;
    if (i < 0) i = 0;
    if (end === clean.length) break;
  }
  return chunks;
}