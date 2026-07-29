export type KnowledgeSourceStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'disabled';
export type KnowledgeSourceIngestStatus = 'created' | 'processing' | 'extracted' | 'failed' | 'blocked';
export type KnowledgeSourceIndexStatus = 'not_requested' | 'pending' | 'indexed' | 'failed' | 'blocked';
export type KnowledgeSourceRuntimeReadiness = 'not_ready' | 'ready' | 'failed' | 'blocked';

type LifecycleInput = {
  syncStatus?: string | null;
  ingestStatus?: string | null;
  indexStatus?: string | null;
  runtimeReadiness?: string | null;
  isActive?: boolean | null;
  lastSyncedAt?: string | null;
};

export type KnowledgeSourceLifecycleState = {
  syncStatus: KnowledgeSourceStatus;
  ingestStatus: KnowledgeSourceIngestStatus;
  indexStatus: KnowledgeSourceIndexStatus;
  runtimeReadiness: KnowledgeSourceRuntimeReadiness;
};

const KNOWN_SYNC_STATUSES = new Set<KnowledgeSourceStatus>([
  'pending',
  'processing',
  'ready',
  'failed',
  'disabled',
]);

const KNOWN_INGEST_STATUSES = new Set<KnowledgeSourceIngestStatus>([
  'created',
  'processing',
  'extracted',
  'failed',
  'blocked',
]);

const KNOWN_INDEX_STATUSES = new Set<KnowledgeSourceIndexStatus>([
  'not_requested',
  'pending',
  'indexed',
  'failed',
  'blocked',
]);

const KNOWN_RUNTIME_READINESS = new Set<KnowledgeSourceRuntimeReadiness>([
  'not_ready',
  'ready',
  'failed',
  'blocked',
]);

export function normalizeKnowledgeSourceStatus(value: string | null | undefined): KnowledgeSourceStatus {
  return KNOWN_SYNC_STATUSES.has(value as KnowledgeSourceStatus)
    ? (value as KnowledgeSourceStatus)
    : 'ready';
}

export function normalizeKnowledgeSourceIngestStatus(
  value: string | null | undefined,
): KnowledgeSourceIngestStatus {
  return KNOWN_INGEST_STATUSES.has(value as KnowledgeSourceIngestStatus)
    ? (value as KnowledgeSourceIngestStatus)
    : 'created';
}

export function normalizeKnowledgeSourceIndexStatus(
  value: string | null | undefined,
): KnowledgeSourceIndexStatus {
  return KNOWN_INDEX_STATUSES.has(value as KnowledgeSourceIndexStatus)
    ? (value as KnowledgeSourceIndexStatus)
    : 'not_requested';
}

export function normalizeKnowledgeSourceRuntimeReadiness(
  value: string | null | undefined,
): KnowledgeSourceRuntimeReadiness {
  return KNOWN_RUNTIME_READINESS.has(value as KnowledgeSourceRuntimeReadiness)
    ? (value as KnowledgeSourceRuntimeReadiness)
    : 'not_ready';
}

export function deriveLifecycleFromLegacySyncStatus(
  syncStatus: string | null | undefined,
  lastSyncedAt?: string | null,
): KnowledgeSourceLifecycleState {
  const normalized = normalizeKnowledgeSourceStatus(syncStatus);
  switch (normalized) {
    case 'ready':
      return {
        syncStatus: 'ready',
        ingestStatus: 'extracted',
        indexStatus: 'indexed',
        runtimeReadiness: 'ready',
      };
    case 'processing':
      return {
        syncStatus: 'processing',
        ingestStatus: 'processing',
        indexStatus: 'pending',
        runtimeReadiness: 'not_ready',
      };
    case 'failed':
      return {
        syncStatus: 'failed',
        ingestStatus: 'failed',
        indexStatus: 'failed',
        runtimeReadiness: 'failed',
      };
    case 'disabled':
      return {
        syncStatus: 'disabled',
        ingestStatus: lastSyncedAt ? 'extracted' : 'created',
        indexStatus: lastSyncedAt ? 'indexed' : 'not_requested',
        runtimeReadiness: lastSyncedAt ? 'ready' : 'not_ready',
      };
    case 'pending':
    default:
      return {
        syncStatus: 'pending',
        ingestStatus: 'created',
        indexStatus: 'not_requested',
        runtimeReadiness: 'not_ready',
      };
  }
}

export function resolveKnowledgeSourceLifecycle(input: LifecycleInput): KnowledgeSourceLifecycleState {
  const legacy = deriveLifecycleFromLegacySyncStatus(input.syncStatus, input.lastSyncedAt);
  const ingestStatus = input.ingestStatus
    ? normalizeKnowledgeSourceIngestStatus(input.ingestStatus)
    : legacy.ingestStatus;
  const indexStatus = input.indexStatus
    ? normalizeKnowledgeSourceIndexStatus(input.indexStatus)
    : legacy.indexStatus;
  const runtimeReadiness = input.runtimeReadiness
    ? normalizeKnowledgeSourceRuntimeReadiness(input.runtimeReadiness)
    : legacy.runtimeReadiness;

  return {
    syncStatus: deriveLegacySyncStatus({
      syncStatus: input.syncStatus,
      ingestStatus,
      runtimeReadiness,
      isActive: input.isActive,
    }),
    ingestStatus,
    indexStatus,
    runtimeReadiness,
  };
}

export function deriveLegacySyncStatus(input: {
  syncStatus?: string | null;
  ingestStatus?: string | null;
  runtimeReadiness?: string | null;
  isActive?: boolean | null;
}): KnowledgeSourceStatus {
  if (input.isActive === false) {
    return 'disabled';
  }

  const runtimeReadiness = normalizeKnowledgeSourceRuntimeReadiness(input.runtimeReadiness);
  const ingestStatus = normalizeKnowledgeSourceIngestStatus(input.ingestStatus);

  if (runtimeReadiness === 'ready') {
    return 'ready';
  }

  if (runtimeReadiness === 'failed' || runtimeReadiness === 'blocked' || ingestStatus === 'failed' || ingestStatus === 'blocked') {
    return 'failed';
  }

  if (ingestStatus === 'created') {
    return 'pending';
  }

  if (ingestStatus === 'processing' || ingestStatus === 'extracted') {
    return 'processing';
  }

  return normalizeKnowledgeSourceStatus(input.syncStatus);
}

export function isKnowledgeSourceCompletionReady(input: {
  isActive?: boolean | null;
  runtimeReadiness?: string | null;
}) {
  return input.isActive !== false
    && normalizeKnowledgeSourceRuntimeReadiness(input.runtimeReadiness) === 'ready';
}

export function sanitizeKnowledgeSourceErrorMessage(value: string | null | undefined) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 1000)
    : null;
}

export function normalizeKnowledgeSourceUrlMetadata(sourceUrl?: string | null) {
  const trimmed = typeof sourceUrl === 'string' ? sourceUrl.trim() : '';
  if (!trimmed) {
    return {
      normalizedSourceUrl: null,
      sourceDomain: null,
    };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        normalizedSourceUrl: trimmed,
        sourceDomain: null,
      };
    }

    return {
      normalizedSourceUrl: url.toString(),
      sourceDomain: url.hostname.toLowerCase(),
    };
  } catch {
    return {
      normalizedSourceUrl: trimmed,
      sourceDomain: null,
    };
  }
}
