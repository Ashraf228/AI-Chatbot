export function isDomainAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return allowed.some((domain) => {
      const normalized = normalizeAllowedDomain(domain);
      if (!normalized) {
        return false;
      }
      return normalized === host || host.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}

export function resolveRequestOrigin(origin?: string, referer?: string) {
  if (origin) {
    return origin;
  }
  if (!referer) {
    return undefined;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function isDevelopmentOrigin(origin: string | undefined) {
  if (process.env.NODE_ENV === 'production' || !origin) {
    return false;
  }
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function normalizeAllowedDomain(domain: string) {
  const value = domain.trim().toLowerCase();
  if (!value) {
    return '';
  }
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//, '').split('/')[0] || '';
  }
}
