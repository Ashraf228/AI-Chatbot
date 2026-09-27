import { randomUUID } from 'node:crypto';
import { sha256 } from '../../utils/hash';
import { logEvent } from '../../utils/logger';
import { readSitePilotAccessRules } from '../../utils/site-pilot-access';
import type { VectorSearchRow } from '../../vector/vector.service';

type TraceScope = {
  tenantId: string;
  siteId: string;
  conversationId: string;
  sessionId: string;
  mode: 'normal' | 'stream';
};

const MAX_CANDIDATES = 16;
const MAX_SELECTED = 8;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const safeId = (value: unknown) => typeof value === 'string' && ID.test(value) ? value : null;

function activeRule(scope: TraceScope) {
  const now = Date.now();
  return readSitePilotAccessRules().find((rule) => rule.traceKnowledgeSelection === true
    && rule.tenantId === scope.tenantId && rule.siteId === scope.siteId
    && now >= Date.parse(rule.validFrom) && now < Date.parse(rule.expiresAt));
}

function evidenceMetadata(hit: VectorSearchRow) {
  return {
    chunkId: safeId(hit.id), documentId: safeId(hit.document_id), sourceId: safeId(hit.source_id),
    // Hash exactly the stored text passed to generation, not ingestion metadata
    // or the shortened public excerpt. No document text is written to logs.
    contentSha256: sha256(hit.content), chars: hit.content.length,
    score: Number.isFinite(Number(hit.score)) ? Number(hit.score) : null,
  };
}

/** Optional diagnostic metadata, never an authorization decision or a response field. */
export function beginKnowledgePilotTrace(scope: TraceScope, candidates: VectorSearchRow[], selected: VectorSearchRow[]) {
  try {
    const initialRule = activeRule(scope);
    if (!initialRule) return undefined;
    const base = {
      schemaVersion: 1, traceId: randomUUID(), tenantId: safeId(scope.tenantId), siteId: safeId(scope.siteId),
      conversationId: safeId(scope.conversationId), sessionId: safeId(scope.sessionId), mode: scope.mode,
    };
    const write = (event: () => Record<string, unknown>) => {
      try {
        const current = activeRule(scope);
        if (!current || current.tokenSha256 !== initialRule.tokenSha256
          || current.validFrom !== initialRule.validFrom || current.expiresAt !== initialRule.expiresAt) return false;
        logEvent('knowledge_pilot_selection', { ...base, at: new Date().toISOString(), ...event() });
        return true;
      } catch {
        // Diagnostics must not turn a successful answer into a failure. A missing
        // event is not evidence of absence; deployment log retention is external.
        return false;
      }
    };
    const selection = selected.slice(0, MAX_SELECTED).map((hit, index) => ({
      generationReference: `Q${index + 1}`, ...evidenceMetadata(hit),
    }));
    const recorded = write(() => ({
      phase: selected.length ? 'prepared' : 'no_evidence',
      candidateCount: candidates.length, selectedCount: selected.length,
      candidatesTruncated: candidates.length > MAX_CANDIDATES, selectedTruncated: selected.length > MAX_SELECTED,
      candidates: candidates.slice(0, MAX_CANDIDATES).map((hit, index) => ({ rank: index + 1, ...evidenceMetadata(hit) })),
      selected: selection,
    }));
    if (!recorded || !selected.length) return undefined;
    return {
      validated(cited: VectorSearchRow[], citationsValid: boolean) {
        write(() => ({
          phase: 'validated', citationsValid, citedCount: cited.length, citedTruncated: cited.length > MAX_SELECTED,
          cited: cited.slice(0, MAX_SELECTED).map((hit, index) => {
            const generationIndex = selected.indexOf(hit);
            return { publicReference: `Q${index + 1}`,
              generationReference: generationIndex < 0 ? null : `Q${generationIndex + 1}`,
              chunkId: safeId(hit.id), contentSha256: sha256(hit.content) };
          }),
        }));
      },
      generationFailed() { write(() => ({ phase: 'generation_failed' })); },
    };
  } catch {
    return undefined;
  }
}
