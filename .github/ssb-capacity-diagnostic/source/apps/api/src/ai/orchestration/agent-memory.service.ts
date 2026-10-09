import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../db/prisma.service';
import { AgentCollectedFields, AgentMemory } from './agent-decision.types';

type ConversationMetadataRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class AgentMemoryService {
  constructor(private readonly db: PrismaService) {}

  async load(input: {
    conversationId: string;
    message: string;
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  }): Promise<AgentMemory> {
    const res = await this.db.query<ConversationMetadataRow>(
      `SELECT id, metadata
       FROM conversations
       WHERE id = $1
       LIMIT 1`,
      [input.conversationId],
    );
    const metadata = asObject(res.rows[0]?.metadata);
    const pendingLead = asObject(metadata.pendingLead);
    const pendingTicket = asObject(metadata.pendingTicket);
    const conversationState = asObject(metadata.conversationState);
    const collectedFields = asObject(conversationState.collectedFields);
    const extracted = this.extractFields(input.message);

    return {
      pendingLeadStatus: parseStatus(asString(pendingLead.status)),
      pendingTicketStatus: parsePendingTicketStatus(asString(pendingTicket.status)),
      pendingTicketIssueType: asString(pendingTicket.issueType) || undefined,
      pendingTicketSummary:
        asString(pendingTicket.summary) ||
        asString(pendingTicket.description) ||
        undefined,
      pendingTicketUrgency: asString(pendingTicket.urgency) || undefined,
      pendingTicketImpact: asString(pendingTicket.impact) || undefined,
      knownEmail: extracted.email || asString(pendingLead.email) || asString(collectedFields.email) || undefined,
      knownPhone: extracted.phone || asString(pendingLead.phone) || asString(collectedFields.phone) || undefined,
      knownName: extracted.name || asString(pendingLead.name) || asString(collectedFields.name) || undefined,
      company: extracted.company || asString(collectedFields.company) || undefined,
      industry: asString(conversationState.industry) || undefined,
      concern:
        extracted.concern ||
        asString(pendingLead.concern) ||
        asString(collectedFields.concern) ||
        asString(conversationState.topic) ||
        undefined,
      urgency: extracted.urgency || parseUrgency(asString(conversationState.urgency)) || 'unknown',
      preferredContact: extracted.preferredContact || inferPreferredContact(pendingLead, collectedFields),
      intentHistory: [
        ...parseStringArray(conversationState.intentHistory),
        asString(conversationState.intent),
        asString(conversationState.lastUserIntent),
      ].filter(Boolean),
      conversationStage: asString(conversationState.stage) || undefined,
      rawMetadata: metadata,
    };
  }

  extractFields(message: string): AgentCollectedFields {
    const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const phone = message.match(/(?:\+?\d[\d\s()./-]{6,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim();
    const name = extractName(message);
    const company = extractCompany(message);
    const urgency = inferUrgency(message);
    const concern = extractConcern(message);
    const preferredContact = /\btelefon|handy|anruf|rueckruf|rückruf\b/i.test(message)
      ? 'phone'
      : /\bmail|e-mail|email\b/i.test(message)
        ? 'email'
        : undefined;

    return {
      email,
      phone,
      name,
      company,
      concern,
      companyNeed: concern,
      urgency,
      preferredContact,
    };
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

function parseStatus(value: string): AgentMemory['pendingLeadStatus'] {
  if (value === 'pending' || value === 'completed') {
    return value;
  }
  return undefined;
}

function parsePendingTicketStatus(value: string): AgentMemory['pendingTicketStatus'] {
  if (
    [
      'triage',
      'solution_offered',
      'ticket_offered',
      'collecting',
      'ready_to_create',
      'created',
      'cancelled',
      'resolved',
    ].includes(value)
  ) {
    return value as AgentMemory['pendingTicketStatus'];
  }
  return undefined;
}

function parseUrgency(value: string): AgentMemory['urgency'] | undefined {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'unknown') {
    return value;
  }
  return undefined;
}

function inferPreferredContact(
  pendingLead: Record<string, unknown>,
  collectedFields: Record<string, unknown>,
): AgentMemory['preferredContact'] {
  const value = asString(pendingLead.preferredContact) || asString(collectedFields.preferredContact);
  if (value === 'email' || value === 'phone') {
    return value;
  }
  if (asString(pendingLead.email) || asString(collectedFields.email)) {
    return 'email';
  }
  if (asString(pendingLead.phone) || asString(collectedFields.phone)) {
    return 'phone';
  }
  return 'unknown';
}

function extractName(text: string) {
  const patterns = [
    /\bmein name ist\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
    /\bich hei(?:ß|ss)e\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
    /\bname\s*:\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) {
      return match.replace(/[,.].*$/, '').trim();
    }
  }
  return undefined;
}

function extractCompany(text: string) {
  const match = text.match(/\b(?:firma|unternehmen|company)\s*(?:ist|:)?\s*([A-ZÄÖÜ0-9][A-Za-zÄÖÜäöüß0-9 &.-]{1,80})/i)?.[1];
  return match?.replace(/[,.].*$/, '').trim() || undefined;
}

function extractConcern(text: string) {
  if (hasGreetingIntent(text) || hasRecoveryIntent(text) || hasRefusalIntent(text)) {
    return undefined;
  }

  const stripped = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '')
    .replace(/\bmein name ist\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3}/gi, '')
    .replace(/\bich hei(?:ß|ss)e\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3}/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripped.length < 8 || /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3}$/.test(stripped)) {
    return undefined;
  }

  return stripped;
}

function hasGreetingIntent(text: string) {
  const normalized = text.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return /^(h+a+l+o+|hsallo|hi+|hey+|guten tag|servus|moin|moinsen|tach|hello)$/i.test(normalized);
}

function hasRecoveryIntent(text: string) {
  return /\b(was soll das|warum fragst du|warum|hä|hae|ich verstehe nicht|verstehe ich nicht|du wiederholst dich|wiederholst dich|nerv nicht|nervt|komisch|quatsch|unsinn)\b/i.test(
    text.toLowerCase().normalize('NFKC'),
  );
}

function hasRefusalIntent(text: string) {
  return /\b(nein|nope|kein interesse|keine interesse|stop|stopp|lass das|nicht kontaktieren|keine daten|will ich nicht|möchte ich nicht|moechte ich nicht)\b/i.test(
    text.toLowerCase().normalize('NFKC'),
  );
}

function inferUrgency(text: string): AgentMemory['urgency'] | undefined {
  if (/(sehr groß|sehr gross|dringend|akut|sofort|\bhoch\b|wichtig|eilig)/i.test(text)) {
    return 'high';
  }
  if (/\b(mittel|normal|bald)\b/i.test(text)) {
    return 'medium';
  }
  if (/\b(niedrig|nicht dringend|später|spaeter)\b/i.test(text)) {
    return 'low';
  }
  return undefined;
}
