import { lookup as defaultLookup } from 'dns/promises';
import { isIP } from 'net';

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_EXTRACTED_CHARS = 50_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const WEBSITE_USER_AGENT = 'SouleKnowledgeIngest/1.0';

const ALLOWED_CONTENT_TYPES = [
  /^text\/html(?:\s*;|$)/i,
  /^text\/plain(?:\s*;|$)/i,
  /^application\/xhtml\+xml(?:\s*;|$)/i,
];

const BLOCKED_HOST_SUFFIXES = [
  '.internal',
  '.intranet',
  '.lan',
  '.local',
  '.localhost',
  '.home',
  '.corp',
];

export class WebsitePolicyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'WebsitePolicyError';
  }
}

export class WebsiteFetchError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'WebsiteFetchError';
  }
}

export type WebsiteLookupFn = typeof defaultLookup;
export type WebsiteFetchFn = typeof fetch;

export type ValidatedWebsiteUrl = {
  normalizedUrl: string;
  sourceDomain: string;
};

export type WebsiteFetchResult = {
  normalizedUrl: string;
  finalUrl: string;
  sourceDomain: string;
  contentType: string;
  statusCode: number;
  redirectCount: number;
  responseBytes: number;
  extractedText: string;
  extractedChars: number;
  truncated: boolean;
};

export async function validatePublicWebsiteUrl(
  input: string,
  resolver: WebsiteLookupFn = defaultLookup,
): Promise<ValidatedWebsiteUrl> {
  const parsed = parseWebsiteUrl(input);
  await validateResolvedHostname(parsed.hostname, resolver);

  return {
    normalizedUrl: parsed.toString(),
    sourceDomain: parsed.hostname.toLowerCase(),
  };
}

export async function fetchWebsiteSource(
  input: string,
  options: {
    fetchImpl?: WebsiteFetchFn;
    resolver?: WebsiteLookupFn;
    timeoutMs?: number;
  } = {},
): Promise<WebsiteFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolver = options.resolver ?? defaultLookup;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const initial = await validatePublicWebsiteUrl(input, resolver);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = initial.normalizedUrl;
    let redirectCount = 0;

    for (;;) {
      const response = await fetchImpl(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/html,text/plain,application/xhtml+xml',
          'user-agent': WEBSITE_USER_AGENT,
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount >= MAX_REDIRECTS) {
          throw new WebsitePolicyError('Zu viele Weiterleitungen.', 'redirect_limit_exceeded');
        }

        const location = response.headers.get('location');
        if (!location) {
          throw new WebsiteFetchError('Weiterleitung ohne Ziel.', 'redirect_missing_location');
        }

        currentUrl = (await validatePublicWebsiteUrl(new URL(location, currentUrl).toString(), resolver)).normalizedUrl;
        redirectCount += 1;
        continue;
      }

      if (!response.ok) {
        throw new WebsiteFetchError(`Website antwortete mit HTTP ${response.status}.`, 'remote_http_error');
      }

      const contentType = (response.headers.get('content-type') || '').trim();
      if (!ALLOWED_CONTENT_TYPES.some((pattern) => pattern.test(contentType))) {
        throw new WebsitePolicyError('Der Inhaltstyp der Website ist nicht erlaubt.', 'content_type_blocked');
      }

      const body = response.body;
      if (!body) {
        throw new WebsiteFetchError('Die Website lieferte keinen lesbaren Inhalt.', 'response_body_missing');
      }

      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!value) {
          continue;
        }

        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          throw new WebsitePolicyError('Die Website-Antwort ist zu groß.', 'response_too_large');
        }

        chunks.push(value);
      }

      const extraction = extractWebsiteText(Buffer.concat(chunks).toString('utf8'), contentType);
      if (!extraction.text) {
        throw new WebsitePolicyError('Die Website enthält keinen auswertbaren Text.', 'empty_extract');
      }

      const finalValidation = await validatePublicWebsiteUrl(currentUrl, resolver);
      return {
        normalizedUrl: initial.normalizedUrl,
        finalUrl: finalValidation.normalizedUrl,
        sourceDomain: finalValidation.sourceDomain,
        contentType,
        statusCode: response.status,
        redirectCount,
        responseBytes: totalBytes,
        extractedText: extraction.text,
        extractedChars: extraction.text.length,
        truncated: extraction.truncated,
      };
    }
  } catch (error) {
    if (error instanceof WebsitePolicyError || error instanceof WebsiteFetchError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WebsiteFetchError('Die Website hat nicht rechtzeitig geantwortet.', 'fetch_timeout');
    }
    throw new WebsiteFetchError('Die Website konnte nicht geladen werden.', 'fetch_failed');
  } finally {
    clearTimeout(timeout);
  }
}

export function extractWebsiteText(input: string, contentType?: string) {
  const asText = /^text\/plain/i.test(contentType || '')
    ? input
    : htmlToText(input);
  const collapsed = decodeHtmlEntities(asText)
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text: collapsed.slice(0, MAX_EXTRACTED_CHARS),
    truncated: collapsed.length > MAX_EXTRACTED_CHARS,
  };
}

function parseWebsiteUrl(input: string) {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new WebsitePolicyError('Ungültige Website-URL.', 'invalid_url');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new WebsitePolicyError('Nur http- und https-URLs sind erlaubt.', 'invalid_scheme');
  }

  if (!parsed.hostname) {
    throw new WebsitePolicyError('Die Website-URL enthält keinen Hostnamen.', 'hostname_missing');
  }

  if (parsed.username || parsed.password) {
    throw new WebsitePolicyError('URLs mit Zugangsdaten sind nicht erlaubt.', 'credentials_not_allowed');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new WebsitePolicyError('Private oder interne Website-Ziele sind nicht erlaubt.', 'hostname_blocked');
  }

  return parsed;
}

async function validateResolvedHostname(hostname: string, resolver: WebsiteLookupFn) {
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new WebsitePolicyError('Private oder interne Website-Ziele sind nicht erlaubt.', 'ip_blocked');
    }
    return;
  }

  const records = await resolver(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!Array.isArray(records) || records.length === 0) {
    throw new WebsiteFetchError('Der Hostname der Website konnte nicht aufgelöst werden.', 'dns_lookup_failed');
  }

  for (const record of records) {
    if (!record?.address || isPrivateAddress(record.address)) {
      throw new WebsitePolicyError('Private oder interne Website-Ziele sind nicht erlaubt.', 'resolved_ip_blocked');
    }
  }
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (
    normalized === 'localhost'
    || normalized === '0.0.0.0'
    || normalized === '::'
  ) {
    return true;
  }
  if (!normalized.includes('.') && isIP(normalized) === 0) {
    return true;
  }
  return BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    return isPrivateAddress(normalized.slice('::ffff:'.length));
  }
  if (isIP(normalized) === 0) {
    return true;
  }
  if (
    normalized === '127.0.0.1'
    || normalized === '0.0.0.0'
    || normalized === '::1'
    || normalized === '::'
    || normalized === '169.254.169.254'
  ) {
    return true;
  }
  if (
    /^10\./.test(normalized)
    || /^192\.168\./.test(normalized)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    || /^169\.254\./.test(normalized)
  ) {
    return true;
  }
  if (
    /^fc/i.test(normalized)
    || /^fd/i.test(normalized)
    || /^fe80:/i.test(normalized)
  ) {
    return true;
  }
  return false;
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}
