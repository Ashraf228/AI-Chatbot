export function isDomainAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return allowed.some(d => d.toLowerCase() === host || host.endsWith(`.${d.toLowerCase()}`));
  } catch {
    return false;
  }
}