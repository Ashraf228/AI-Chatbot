export function slugifySiteKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function resolveSiteKey(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const slug = slugifySiteKey(candidate || '');
    if (slug) {
      return slug;
    }
  }

  return '';
}
