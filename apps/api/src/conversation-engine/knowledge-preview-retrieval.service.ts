import { Injectable } from '@nestjs/common';
import { AssistantProfile } from '../assistant-profiles';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorSearchRow, VectorService } from '../vector/vector.service';
import {
  ConversationDecision,
  ConversationHistoryEntry,
  EngineKnowledgeRetrievalResult,
  EngineKnowledgeSnippet,
} from './conversation-engine.types';

type KnowledgePreviewInput = {
  tenantId: string;
  siteId: string;
  assistantProfile: AssistantProfile;
  conversationDecision: ConversationDecision;
  latestUserMessage: string;
  history?: ConversationHistoryEntry[];
  selectedAgentKey?: string | null;
  knowledgeMode?: AssistantProfile['knowledgeMode'];
  maxSnippets?: number;
  enabled: boolean;
};

const SENSITIVE_METADATA_KEYS = new Set([
  'apiKey',
  'api_key',
  'authorization',
  'bearer',
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
]);

function redactText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[E-MAIL]')
    .replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '[TELEFON]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+)\b/g, '[SECRET]')
    .replace(/\b(password|secret|token|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]');
}

function trimExcerpt(value: string, maxLength = 600) {
  const clean = redactText(String(value || '').replace(/\s+/g, ' ').trim());
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}…` : clean;
}

function sanitizeUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return trimExcerpt(parsed.toString(), 300);
  } catch {
    return trimExcerpt(value, 300);
  }
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key) || /secret|token|password|api[_-]?key|authorization/i.test(key)) {
      continue;
    }
    if (typeof value === 'string') {
      safe[key] = trimExcerpt(value, 160);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = value
        .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
        .slice(0, 12)
        .map((item) => (typeof item === 'string' ? trimExcerpt(item, 80) : item));
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function agentKeysFrom(metadata: Record<string, unknown> | null | undefined, fallback?: string | null) {
  const values = Array.isArray(metadata?.agentKeys)
    ? metadata?.agentKeys
    : Array.isArray(metadata?.agents)
      ? metadata?.agents
      : [];
  const keys = values.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  if (fallback && !keys.includes(fallback)) {
    keys.push(fallback);
  }
  return keys.length > 0 ? keys.slice(0, 8) : undefined;
}

function buildQuery(input: KnowledgePreviewInput) {
  const historyTail = (input.history || [])
    .filter((entry) => entry.role === 'user')
    .slice(-2)
    .map((entry) => entry.content)
    .join('\n');
  return trimExcerpt([
    input.latestUserMessage,
    input.conversationDecision.intent,
    input.conversationDecision.goal,
    input.conversationDecision.nextAction,
    historyTail,
  ].filter(Boolean).join('\n'), 1200);
}

function toSnippet(row: VectorSearchRow, selectedAgentKey?: string | null): EngineKnowledgeSnippet {
  const title = row.source_label || row.title || 'Wissensquelle';
  return {
    id: row.id,
    chunkId: row.id,
    documentId: row.document_id,
    sourceId: row.source_id,
    title: trimExcerpt(title, 160) || 'Wissensquelle',
    sourceType: row.source_type || 'knowledge',
    score: Number(Number(row.score || 0).toFixed(4)),
    excerpt: trimExcerpt(row.content),
    url: row.source_url ? sanitizeUrl(row.source_url) : undefined,
    scope: 'site',
    agentKeys: agentKeysFrom(row.metadata, selectedAgentKey),
    metadata: sanitizeMetadata(row.metadata),
  };
}

@Injectable()
export class KnowledgePreviewRetrievalService {
  constructor(
    private readonly embedder: EmbeddingService,
    private readonly vector: VectorService,
  ) {}

  async retrieve(input: KnowledgePreviewInput): Promise<EngineKnowledgeRetrievalResult> {
    if (!input.enabled) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        snippets: [],
        warnings: [],
        reasons: ['Wissensbasis-Vorschau ist deaktiviert.'],
      };
    }

    const query = buildQuery(input);
    if (!query) {
      return {
        enabled: true,
        attempted: false,
        status: 'empty',
        snippets: [],
        warnings: ['Keine auswertbare Testnachricht vorhanden.'],
        reasons: ['Retrieval wurde ohne Suchtext nicht ausgeführt.'],
      };
    }

    try {
      const embedding = await this.embedder.embed(query);
      const rows = await this.vector.search(
        input.tenantId,
        input.siteId,
        embedding,
        Math.max(1, Math.min(input.maxSnippets || 4, 8)),
        undefined,
        {},
      );
      const snippets = rows.map((row) => toSnippet(row, input.selectedAgentKey));
      return {
        enabled: true,
        attempted: true,
        status: snippets.length > 0 ? 'available' : 'empty',
        snippets,
        warnings: [],
        reasons: snippets.length > 0
          ? ['Relevante Wissensbasis-Snippets wurden read-only abgerufen.']
          : ['Keine passenden Wissensbasis-Snippets gefunden.'],
      };
    } catch {
      return {
        enabled: true,
        attempted: true,
        status: 'error',
        snippets: [],
        warnings: ['Wissensbasis-Vorschau konnte nicht abgerufen werden.'],
        reasons: ['Retrieval-Fehler wurde abgefangen; die Antwortvorschau bleibt verfügbar.'],
      };
    }
  }
}
