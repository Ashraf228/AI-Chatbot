import type { LookupAddress } from 'dns';
import { Resolver, type lookup } from 'dns/promises';
import type { IncomingMessage, RequestOptions } from 'http';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
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
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'WebsiteFetchError';
  }
}

export type WebsiteLookupFn = typeof lookup;
export type WebsiteFetchFn = typeof fetch;

export type ValidatedWebsiteUrl = {
  normalizedUrl: string;
  sourceDomain: string;
  pinnedAddress: ResolvedPublicAddress;
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
  links?: string[];
  linksTruncated?: boolean;
  pageTitle?: string;
  resourceText?: string;
};

export type ResolvedPublicAddress = {
  address: string;
  family: 4 | 6;
};

type WebsiteRequestHandle = {
  end: () => void;
  destroy: (error?: Error) => void;
  on: (event: 'error', listener: (error: Error) => void) => WebsiteRequestHandle;
  setTimeout?: (timeoutMs: number, listener?: () => void) => void;
};

type WebsiteRequestOptions = RequestOptions & {
  servername?: string;
  rejectUnauthorized?: boolean;
};

type WebsiteTransportFn = (
  options: WebsiteRequestOptions,
  callback: (response: IncomingMessage) => void,
) => WebsiteRequestHandle;

type WebsitePinnedRequestOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  httpRequestImpl?: WebsiteTransportFn;
  httpsRequestImpl?: WebsiteTransportFn;
  signal?: AbortSignal;
};

export type WebsiteRequestFn = (
  url: string,
  pinnedAddress: ResolvedPublicAddress,
  options?: WebsitePinnedRequestOptions,
) => Promise<IncomingMessage>;

export async function validatePublicWebsiteUrl(
  input: string,
  resolver?: WebsiteLookupFn,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ValidatedWebsiteUrl> {
  options.signal?.throwIfAborted();
  const parsed = parseWebsiteUrl(input);
  const pinnedAddress = await resolvePublicAddresses(parsed.hostname, resolver, options);
  options.signal?.throwIfAborted();

  return {
    normalizedUrl: parsed.toString(),
    sourceDomain: parsed.hostname.toLowerCase(),
    pinnedAddress,
  };
}

export async function fetchWebsiteSource(
  input: string,
  options: {
    requestImpl?: WebsiteRequestFn;
    resolver?: WebsiteLookupFn;
    timeoutMs?: number;
    httpRequestImpl?: WebsiteTransportFn;
    httpsRequestImpl?: WebsiteTransportFn;
    signal?: AbortSignal;
    allowedOrigin?: string;
    resource?: 'robots' | 'sitemap';
    allowUrl?: (url: string) => boolean;
  } = {},
): Promise<WebsiteFetchResult> {
  const requestImpl = options.requestImpl ?? fetchWithPinnedDns;
  const resolver = options.resolver;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  options.signal?.throwIfAborted();
  const deadlineController = new AbortController();
  const deadline = setTimeout(() => deadlineController.abort(createTimeoutError()), timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, deadlineController.signal]) : deadlineController.signal;

  try {
    const initial = await validatePublicWebsiteUrl(input, resolver, { signal, timeoutMs });
    let currentTarget = initial;
    let redirectCount = 0;

    for (;;) {
      signal.throwIfAborted();
      if ((options.allowedOrigin && new URL(currentTarget.normalizedUrl).origin !== options.allowedOrigin)
        || (options.allowUrl && !options.allowUrl(currentTarget.normalizedUrl))) {
        throw new WebsitePolicyError('Das Ziel liegt außerhalb des erlaubten Website-Bereichs.', 'crawl_scope_blocked');
      }
      const response = await requestImpl(currentTarget.normalizedUrl, currentTarget.pinnedAddress, {
        timeoutMs,
        headers: {
          accept: options.resource === 'sitemap' ? 'application/xml,text/xml' : 'text/html,text/plain,application/xhtml+xml',
          'user-agent': WEBSITE_USER_AGENT,
        },
        httpRequestImpl: options.httpRequestImpl,
        httpsRequestImpl: options.httpsRequestImpl,
        signal,
      });
      const statusCode = response.statusCode ?? 0;

      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        if (redirectCount >= MAX_REDIRECTS) {
          throw new WebsitePolicyError('Zu viele Weiterleitungen.', 'redirect_limit_exceeded');
        }

        response.resume();

        const location = headerValue(response.headers.location);
        if (!location) {
          throw new WebsiteFetchError('Weiterleitung ohne Ziel.', 'redirect_missing_location');
        }

        currentTarget = await validatePublicWebsiteUrl(
          new URL(location, currentTarget.normalizedUrl).toString(),
          resolver,
          { signal, timeoutMs },
        );
        redirectCount += 1;
        continue;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        throw new WebsiteFetchError(`Website antwortete mit HTTP ${statusCode}.`, 'remote_http_error', statusCode);
      }

      const contentType = headerValue(response.headers['content-type']).trim();
      const contentTypes = options.resource === 'sitemap' ? [/^(application|text)\/xml(?:\s*;|$)/i] : ALLOWED_CONTENT_TYPES;
      if (!contentTypes.some((pattern) => pattern.test(contentType))) {
        response.resume();
        throw new WebsitePolicyError('Der Inhaltstyp der Website ist nicht erlaubt.', 'content_type_blocked');
      }

      const { chunks, totalBytes } = await readResponseBody(response);

      signal.throwIfAborted();
      const raw = Buffer.concat(chunks).toString('utf8');
      const extraction = extractWebsiteText(raw, contentType);
      const linkMatches = options.resource ? [] : [...raw.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)];
      if (!extraction.text && !options.resource) {
        throw new WebsitePolicyError('Die Website enthält keinen auswertbaren Text.', 'empty_extract');
      }

      return {
        normalizedUrl: initial.normalizedUrl,
        finalUrl: currentTarget.normalizedUrl,
        sourceDomain: currentTarget.sourceDomain,
        contentType,
        statusCode,
        redirectCount,
        responseBytes: totalBytes,
        extractedText: extraction.text,
        extractedChars: extraction.text.length,
        truncated: extraction.truncated,
        ...(options.resource ? { resourceText: raw } : {
          links: linkMatches.slice(0, 500).map((match) => decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? '')),
          linksTruncated: linkMatches.length > 500,
          pageTitle: extractWebsiteText(raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').text.slice(0, 200),
        }),
      };
    }
  } catch (error) {
    options.signal?.throwIfAborted();
    if (deadlineController.signal.aborted) {
      throw new WebsiteFetchError('Die Website hat nicht rechtzeitig geantwortet.', 'fetch_timeout');
    }
    if (error instanceof WebsitePolicyError || error instanceof WebsiteFetchError) {
      throw error;
    }
    if (isTimeoutError(error)) {
      throw new WebsiteFetchError('Die Website hat nicht rechtzeitig geantwortet.', 'fetch_timeout');
    }
    throw new WebsiteFetchError('Die Website konnte nicht geladen werden.', 'fetch_failed');
  } finally {
    clearTimeout(deadline);
  }
}

export function createPinnedLookup(
  pinnedAddress: ResolvedPublicAddress,
): NonNullable<RequestOptions['lookup']> {
  return ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (options?.all) {
      callback(null, [{ address: pinnedAddress.address, family: pinnedAddress.family } satisfies LookupAddress]);
      return;
    }

    callback(null, pinnedAddress.address, pinnedAddress.family);
  }) as NonNullable<RequestOptions['lookup']>;
}

export async function fetchWithPinnedDns(
  url: string,
  pinnedAddress: ResolvedPublicAddress,
  options: WebsitePinnedRequestOptions = {},
): Promise<IncomingMessage> {
  const target = new URL(url);
  const requester = (
    target.protocol === 'https:'
      ? (options.httpsRequestImpl ?? (httpsRequest as unknown as WebsiteTransportFn))
      : (options.httpRequestImpl ?? (httpRequest as unknown as WebsiteTransportFn))
  );
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return await new Promise<IncomingMessage>((resolve, reject) => {
    options.signal?.throwIfAborted();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { clearTimeout(deadline); options.signal?.removeEventListener('abort', abort); };
    const abort = () => request.destroy(new Error('Website request aborted'));
    const request = requester(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port ? Number(target.port) : undefined,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        headers: options.headers,
        lookup: createPinnedLookup(pinnedAddress),
        servername: target.hostname,
        rejectUnauthorized: true,
      },
      (response) => {
        response.once('close', cleanup);
        resolve(response);
      },
    );

    request.on('error', (error) => {
      cleanup();
      reject(error);
    });

    deadline = setTimeout(() => request.destroy(createTimeoutError()), timeoutMs);
    deadline.unref?.();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();

    request.setTimeout?.(timeoutMs, () => {
      request.destroy(createTimeoutError());
    });

    request.end();
  });
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

async function resolvePublicAddresses(
  hostname: string,
  resolver: WebsiteLookupFn | undefined,
  options: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ResolvedPublicAddress> {
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new WebsitePolicyError('Private oder interne Website-Ziele sind nicht erlaubt.', 'ip_blocked');
    }
    return {
      address: hostname,
      family: (isIP(hostname) === 6 ? 6 : 4),
    };
  }

  const records = await lookupWebsiteAddresses(hostname, resolver, options);
  if (!Array.isArray(records) || records.length === 0) {
    throw new WebsiteFetchError('Der Hostname der Website konnte nicht aufgelöst werden.', 'dns_lookup_failed');
  }

  const normalizedRecords: ResolvedPublicAddress[] = [];

  for (const record of records) {
    if (!record?.address || isPrivateAddress(record.address)) {
      throw new WebsitePolicyError('Private oder interne Website-Ziele sind nicht erlaubt.', 'resolved_ip_blocked');
    }

    normalizedRecords.push({
      address: record.address,
      family: record.family === 6 ? 6 : 4,
    });
  }

  return normalizedRecords[0];
}

function lookupWebsiteAddresses(
  hostname: string,
  resolver: WebsiteLookupFn | undefined,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: { signal?: AbortSignal; timeoutMs?: number },
): Promise<LookupAddress[]> {
  signal?.throwIfAborted();
  // dns.lookup/getaddrinfo cannot be cancelled. Each production lookup owns a
  // cancellable DNS Resolver, so aborting it cannot cancel another crawl's DNS.
  const dns = resolver ? undefined : new Resolver({ timeout: timeoutMs, tries: 1 });
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: unknown, records?: LookupAddress[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      dns?.cancel();
      if (records) resolve(records);
      else reject(error);
    };
    const abort = () => finish(signal?.reason);
    timer = setTimeout(() => finish(new WebsiteFetchError('DNS-Auflösung hat das Zeitlimit überschritten.', 'fetch_timeout')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    const family = async (version: 4 | 6): Promise<LookupAddress[]> => {
      try {
        const addresses = await (version === 4 ? dns!.resolve4(hostname) : dns!.resolve6(hostname));
        return addresses.map((address) => ({ address, family: version }));
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENODATA' || code === 'ENOTFOUND') return [];
        throw error;
      }
    };
    const pending = resolver
      ? Promise.resolve().then(() => { signal?.throwIfAborted(); return resolver(hostname, { all: true, verbatim: true }); })
      : Promise.all([family(4), family(6)]).then((records) => records.flat());
    // Observe late resolve/reject even for injected resolvers that cannot cancel.
    pending.then((records) => finish(undefined, records), () => finish(
      new WebsiteFetchError('Der Hostname der Website konnte nicht aufgelöst werden.', 'dns_lookup_failed'),
    ));
  });
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
    || /^127\./.test(normalized)
    || /^0\./.test(normalized)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(normalized)
    || /^198\.(18|19)\./.test(normalized)
    || (isIP(normalized) === 4 && Number(normalized.split('.')[0]) >= 224)
    || /^192\.168\./.test(normalized)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    || /^169\.254\./.test(normalized)
  ) {
    return true;
  }
  if (
    /^fc/i.test(normalized)
    || /^fd/i.test(normalized)
    || /^fe[89ab][0-9a-f]:/i.test(normalized)
    || /^ff/i.test(normalized)
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

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
}

async function readResponseBody(response: IncomingMessage) {
  return await new Promise<{ chunks: Uint8Array[]; totalBytes: number }>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    response.on('data', (chunk: Buffer | string) => {
      const bufferChunk = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalBytes += bufferChunk.byteLength;

      if (totalBytes > MAX_RESPONSE_BYTES) {
        response.destroy(createPolicyError('Die Website-Antwort ist zu groß.', 'response_too_large'));
        return;
      }

      chunks.push(bufferChunk);
    });

    response.on('end', () => {
      resolve({ chunks, totalBytes });
    });

    response.on('error', (error) => {
      reject(error);
    });
  });
}

function createTimeoutError() {
  return Object.assign(new Error('request_timeout'), { code: 'REQUEST_TIMEOUT' });
}

function createPolicyError(message: string, code: string) {
  return new WebsitePolicyError(message, code);
}

function isTimeoutError(error: unknown) {
  return error instanceof Error
    && ((error as Error & { code?: string }).code === 'REQUEST_TIMEOUT'
      || error.name === 'AbortError');
}
