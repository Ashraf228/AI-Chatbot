import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationEnginePreviewInput, ConversationHistoryEntry } from './conversation-engine.types';

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFKC').trim();
}

function sanitizeHistory(history: ConversationHistoryEntry[] | undefined) {
  return Array.isArray(history)
    ? history
        .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system'))
        .slice(-12)
        .map((entry) => ({
          role: entry.role,
          content: typeof entry.content === 'string' ? entry.content.slice(0, 500) : '',
        }))
    : [];
}

function hasPhone(text: string) {
  const compact = text.replace(/[^\d+]/g, '');
  return compact.length >= 8 && /^(\+|0)/.test(compact);
}

function hasEmail(text: string) {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text);
}

function hasFullAddress(text: string) {
  return /\b\d{5}\b/.test(text) &&
    /\b\d{1,5}\s?[a-z]?\b/i.test(text) &&
    /\b(strasse|straße|str\.|weg|gasse|allee|ring|platz|damm|ufer|chaussee|pfad|steig|berg|tal|markt)\b/i.test(text);
}

function hasName(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.every((word) => /^[\p{L}'-]{2,}$/u.test(word));
}

function inferKnownFields(text: string, existingState: Record<string, unknown>) {
  const known = new Set<string>();
  for (const [key, value] of Object.entries(existingState)) {
    if (value !== null && value !== undefined && value !== '') {
      known.add(key);
    }
  }

  if (hasPhone(text)) known.add('phone');
  if (hasEmail(text)) known.add('email');
  if (hasFullAddress(text)) {
    known.add('fullAddress');
    known.add('location');
  }
  if (hasName(text)) {
    known.add('fullName');
    known.add('name');
  }
  if (/\b(notfall|dringend|heute|morgen|termin|akut|sofort)\b/i.test(text)) known.add('urgency');
  if (/\b(problem|defekt|verstopft|funktioniert nicht|geht nicht|störung|stoerung|vpn|outlook|drucker|abfluss|toilette|klo|wasser|keller)\b/i.test(text)) {
    known.add('problem');
  }

  return Array.from(known);
}

@Injectable()
export class ConversationContextService {
  build(input: ConversationEnginePreviewInput): ConversationContext {
    const latestUserMessage = typeof input.latestUserMessage === 'string' ? input.latestUserMessage : '';
    const conversationHistory = sanitizeHistory(input.conversationHistory);
    const existingConversationState = input.existingConversationState && typeof input.existingConversationState === 'object'
      ? input.existingConversationState
      : {};
    const requiredFields = input.assistantProfile.requiredFields
      .filter((field) => field.required)
      .map((field) => field.key);
    const knownFields = inferKnownFields([latestUserMessage, ...conversationHistory.map((entry) => entry.content)].join('\n'), existingConversationState);
    const missingFields = requiredFields.filter((field) => !knownFields.includes(field));

    return {
      assistantProfile: input.assistantProfile,
      latestUserMessage,
      conversationHistory,
      existingConversationState,
      knowledgeAvailable: Boolean(input.knowledgeAvailable),
      normalizedText: normalizeText(latestUserMessage),
      requiredFields,
      knownFields,
      missingFields,
      warnings: [],
      reasons: ['Preview-Modus: keine produktiven Aktionen werden ausgeführt.'],
    };
  }
}
