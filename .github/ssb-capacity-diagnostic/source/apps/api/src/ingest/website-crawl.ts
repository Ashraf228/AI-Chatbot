import { fetchWebsiteSource, WebsiteFetchError, WebsitePolicyError, type WebsiteFetchResult } from './website-ingest';

type Rule = { allow: boolean; path: string };
export type CrawlResult = {
  pages: WebsiteFetchResult[];
  excluded: Array<{ url: string; reason: string }>;
  complete: boolean;
  maxPages: number;
};
const AGENT = 'souleknowledgeingest';

export function parseRobots(text: string) {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  const sitemaps: string[] = [];
  let group: typeof groups[number] | undefined;
  let hasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).toLowerCase(); const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && group) {
      hasRules = true;
      if (value) group.rules.push({ allow: key === 'allow', path: value });
    } else if (key === 'sitemap') sitemaps.push(value);
  }
  const specificity = (g: typeof groups[number]) => Math.max(-1, ...g.agents.map((a) => a === '*' ? 0 : AGENT.startsWith(a) ? a.length : -1));
  const best = Math.max(-1, ...groups.map(specificity));
  return { rules: groups.filter((g) => specificity(g) === best && best >= 0).flatMap((g) => g.rules), sitemaps };
}

export function robotsAllows(url: string, rules: Rule[]) {
  // A deterministic budget also bounds the combined work of many valid rules.
  let remaining = 2_000_000;
  const spend = (amount = 1) => {
    remaining -= amount;
    if (remaining < 0) throw new WebsitePolicyError('Robots-Regeln sind zu aufwendig.', 'robots_complexity_exceeded');
  };
  const parsed = new URL(url);
  const target = normalizeRobotsPath(parsed.pathname + parsed.search, false, spend);
  let bestLength = -1; let allowed = true;
  for (const rule of rules) {
    const pattern = normalizeRobotsPath(rule.path, true, spend);
    const length = pattern.replace(/\*/g, '').replace(/\$$/, '').length;
    if (length < bestLength || !matchesRobotsPath(target, pattern, spend)) continue;
    if (length > bestLength) { bestLength = length; allowed = rule.allow; }
    else allowed ||= rule.allow;
  }
  return allowed;
}

function normalizeRobotsPath(value: string, pattern: boolean, spend: (amount?: number) => void): string {
  spend(value.length);
  const bytes = Buffer.from(value, 'utf8');
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0x25) {
      const hex = bytes.subarray(i + 1, i + 3).toString('utf8');
      if (!/^[0-9a-f]{2}$/i.test(hex)) throw new WebsitePolicyError('Ungültige Pfadkodierung.', 'robots_encoding_invalid');
      const decoded = String.fromCharCode(parseInt(hex, 16));
      // RFC 9309: decode unreserved octets only, once, on both sides.
      result += /^[a-z0-9._~-]$/i.test(decoded) ? decoded : `%${hex.toUpperCase()}`;
      i += 2;
    } else if (byte > 0x7e || byte < 0x21
      || (byte === 0x2a && !pattern) || (byte === 0x24 && (!pattern || i !== bytes.length - 1))) {
      result += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    } else result += String.fromCharCode(byte);
  }
  return result;
}

function matchesRobotsPath(target: string, pattern: string, spend: (amount?: number) => void): boolean {
  const exact = pattern.endsWith('$');
  const parts = (exact ? pattern.slice(0, -1) : pattern).split('*');
  const prefix = parts[0];
  spend(prefix.length);
  if (!target.startsWith(prefix)) return false;
  let offset = prefix.length;
  if (parts.length === 1) return !exact || offset === target.length;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (exact && i === parts.length - 1) {
      spend(part.length);
      return target.length - part.length >= offset && target.endsWith(part);
    }
    if (!part) continue;
    // KMP searches each literal segment once; wildcards never backtrack.
    const fallback = new Uint32Array(part.length);
    for (let j = 1, matched = 0; j < part.length; j++) {
      spend();
      while (matched && part[j] !== part[matched]) { spend(); matched = fallback[matched - 1]; }
      if (part[j] === part[matched]) matched++;
      fallback[j] = matched;
    }
    let matched = 0;
    while (offset < target.length && matched < part.length) {
      spend();
      while (matched && target[offset] !== part[matched]) { spend(); matched = fallback[matched - 1]; }
      if (target[offset] === part[matched]) matched++;
      offset++;
    }
    if (matched !== part.length) return false;
  }
  return true;
}

function canonical(value: string, base: string, origin: string): string | null {
  try {
    const url = new URL(value, base);
    if (url.origin !== origin || url.username || url.password || url.search || !['https:', 'http:'].includes(url.protocol)) return null;
    if (/\.(pdf|png|jpe?g|svg|gif|webp|zip|mp4|mp3|css|js|xml|json)$/i.test(url.pathname)) return null;
    url.hash = ''; return url.toString();
  } catch { return null; }
}

export async function crawlWebsite(rootUrl: string, options: {
  maxPages?: number; signal?: AbortSignal;
  fetchPage?: typeof fetchWebsiteSource;
} = {}): Promise<CrawlResult> {
  const root = new URL(rootUrl); root.hash = '';
  if (root.username || root.password || root.search || !['https:', 'http:'].includes(root.protocol)) {
    throw new WebsitePolicyError('Website-Adresse ist nicht zulässig.', 'crawl_scope_blocked');
  }
  const maxPages = options.maxPages ?? 10;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) throw new WebsitePolicyError('Es sind 1 bis 20 Seiten erlaubt.', 'crawl_limit_invalid');
  const timeout = AbortSignal.timeout(60_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  signal.throwIfAborted();
  const fetchPage = options.fetchPage || fetchWebsiteSource;
  const origin = root.origin;
  const fetchOptions = { signal, allowedOrigin: origin, timeoutMs: 8_000 };
  let robots = { rules: [] as Rule[], sitemaps: [] as string[] };
  try {
    const file = await fetchPage(`${origin}/robots.txt`, { ...fetchOptions, resource: 'robots' });
    if (!/^text\/plain/i.test(file.contentType)) throw new WebsitePolicyError('Robots-Regeln nicht verifizierbar.', 'robots_unverified');
    robots = parseRobots(file.resourceText || '');
  } catch (error) {
    if (!(error instanceof WebsiteFetchError && [404, 410].includes(error.statusCode || 0))) throw error;
  }
  if (!robotsAllows(root.toString(), robots.rules)) throw new WebsitePolicyError('Website sperrt diesen Abruf.', 'robots_blocked');
  const queue = [{ url: root.toString(), depth: 0 }];
  const queued = new Set([root.toString()]);
  const visited = new Set<string>();
  const excluded: CrawlResult['excluded'] = [];
  const pages: WebsiteFetchResult[] = [];
  const signatures = new Set<string>();
  let chars = 0; let truncated = false;
  const add = (value: string, base: string, depth: number) => {
    const url = canonical(value, base, origin);
    if (!url || queued.has(url)) return;
    if (queued.size >= 200) { truncated = true; return; }
    queued.add(url);
    if (!robotsAllows(url, robots.rules)) { excluded.push({ url, reason: 'robots' }); return; }
    if (depth > 3) { excluded.push({ url, reason: 'depth_limit' }); truncated = true; return; }
    queue.push({ url, depth });
  };
  // XML is parsed as bounded text, never with DTD/entity expansion. Sitemap
  // indexes are followed only inside this origin, at most three files in total.
  const maps = [...robots.sitemaps, `${origin}/sitemap.xml`]; const mapSeen = new Set<string>();
  for (let i = 0; i < maps.length && mapSeen.size < 3; i++) {
    signal.throwIfAborted();
    let url: URL;
    try { url = new URL(maps[i], origin); } catch { continue; }
    if (url.origin !== origin || url.username || url.password || url.search || mapSeen.has(url.toString()) || !robotsAllows(url.toString(), robots.rules)) continue;
    mapSeen.add(url.toString());
    try {
      const map = await fetchPage(url.toString(), { ...fetchOptions, resource: 'sitemap', allowUrl: (u) => !new URL(u).search && robotsAllows(u, robots.rules) });
      const xml = map.resourceText || '';
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new WebsitePolicyError('Sitemap enthält nicht erlaubte Strukturen.', 'sitemap_blocked');
      const locations = [...xml.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)];
      truncated ||= locations.length > 200;
      for (const match of locations.slice(0, 200)) {
        const location = match[1].trim().replace(/&amp;/g, '&');
        if (/<sitemapindex\b/i.test(xml)) maps.push(location);
        else add(location, url.toString(), 1);
      }
    } catch (error) {
      if (!(error instanceof WebsiteFetchError && [404, 410].includes(error.statusCode || 0))) throw error;
    }
  }
  truncated ||= maps.some((value) => {
    try {
      const url = new URL(value, origin);
      return url.origin === origin && !url.username && !url.password && !url.search
        && robotsAllows(url.toString(), robots.rules) && !mapSeen.has(url.toString());
    } catch { return false; }
  });
  while (queue.length && visited.size < maxPages) {
    signal.throwIfAborted();
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    visited.add(item.url);
    let page: WebsiteFetchResult;
    try {
      page = await fetchPage(item.url, { ...fetchOptions, allowUrl: (u) => canonical(u, item.url, origin) !== null && robotsAllows(u, robots.rules) });
    } catch (error) {
      if (item.depth > 0 && error instanceof WebsiteFetchError && [404, 410].includes(error.statusCode || 0)) {
        excluded.push({ url: item.url, reason: 'not_found' }); continue;
      }
      throw error;
    }
    const final = canonical(page.finalUrl, item.url, origin);
    if (!final || !robotsAllows(final, robots.rules)) throw new WebsitePolicyError('Weiterleitung außerhalb des Bereichs.', 'crawl_scope_blocked');
    for (const link of page.links || []) add(link, final, item.depth + 1);
    if (signatures.has(page.extractedText)) { excluded.push({ url: item.url, reason: 'duplicate' }); continue; }
    if (chars + page.extractedText.length > 100_000) { truncated = true; excluded.push({ url: item.url, reason: 'text_limit' }); break; }
    signatures.add(page.extractedText); chars += page.extractedText.length;
    truncated ||= page.truncated || page.linksTruncated === true;
    pages.push(page);
  }
  if (!pages.length) throw new WebsitePolicyError('Keine nutzbaren Website-Inhalte gefunden.', 'empty_extract');
  excluded.push(...queue.slice(0, 200).map(({ url }) => ({ url, reason: 'page_limit' })));
  return { pages, excluded, maxPages, complete: !truncated && queue.length === 0 };
}
