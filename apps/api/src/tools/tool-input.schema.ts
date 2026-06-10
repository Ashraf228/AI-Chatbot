export type ToolInputValidation = {
  input: Record<string, unknown>;
  missingFields: string[];
};

export function normalizeToolInput(toolName: string, input: Record<string, unknown>): ToolInputValidation {
  switch (toolName) {
    case 'capture_lead':
      return normalizeCaptureLead(input);
    case 'schedule_contact':
      return normalizeScheduleContact(input);
    case 'create_ticket':
      return normalizeCreateTicket(input);
    case 'push_webhook':
      return normalizePushWebhook(input);
    case 'query_knowledge':
      return normalizeQueryKnowledge(input);
    case 'recommend_service':
      return normalizeRecommendService(input);
    case 'handoff':
      return normalizeHandoff(input);
    default:
      return { input: {}, missingFields: ['toolName'] };
  }
}

function normalizeCaptureLead(input: Record<string, unknown>): ToolInputValidation {
  const normalized = {
    name: text(input.name),
    email: text(input.email),
    phone: text(input.phone),
    company: text(input.company),
    need: text(input.need || input.concern || input.companyNeed || input.message),
    urgency: text(input.urgency) || 'unknown',
    source: text(input.source) || 'chat',
  };
  const missingFields = !normalized.email && !normalized.phone ? ['email', 'phone'] : [];
  return { input: dropEmpty(normalized), missingFields };
}

function normalizeScheduleContact(input: Record<string, unknown>): ToolInputValidation {
  const normalized = {
    name: text(input.name),
    email: text(input.email),
    phone: text(input.phone),
    preferredChannel: text(input.preferredChannel),
    preferredTime: text(input.preferredTime),
    topic: text(input.topic || input.need || input.concern || input.message),
  };
  const missingFields = !normalized.email && !normalized.phone ? ['email', 'phone'] : [];
  return { input: dropEmpty(normalized), missingFields };
}

function normalizeCreateTicket(input: Record<string, unknown>): ToolInputValidation {
  const reporterEmail = text(input.reporterEmail || input.customerEmail || input.email);
  const reporterName = text(input.reporterName || input.customerName || input.name);
  const normalized = {
    subject: text(input.subject || input.title),
    description: text(input.description || input.message || input.concern),
    priority: text(input.priority) || 'normal',
    category: text(input.category),
    customerEmail: text(input.customerEmail) || reporterEmail,
    customerName: text(input.customerName) || reporterName,
    issueType: text(input.issueType),
    affectedSystem: text(input.affectedSystem),
    impact: text(input.impact),
    urgency: text(input.urgency),
    affectedUsers: text(input.affectedUsers),
    reporterName,
    reporterEmail,
    reporterPhone: text(input.reporterPhone || input.phone),
    company: text(input.company),
    department: text(input.department),
    location: text(input.location),
    device: text(input.device),
    operatingSystem: text(input.operatingSystem),
    errorMessage: text(input.errorMessage),
    alreadyTried: text(input.alreadyTried),
    source: text(input.source) || 'chat',
    conversationId: text(input.conversationId),
    metadata: record(input.metadata),
  };
  const missingFields = [
    ...(!normalized.subject ? ['subject'] : []),
    ...(!normalized.description ? ['description'] : []),
  ];
  return { input: dropEmpty(normalized), missingFields };
}

function normalizePushWebhook(input: Record<string, unknown>): ToolInputValidation {
  const payload = record(input.payload);
  const normalized = {
    eventType: text(input.eventType),
    payload,
    providerKey: text(input.providerKey) || 'webhook',
    connectionKey: text(input.connectionKey) || 'primary',
  };
  const missingFields = [
    ...(!normalized.eventType ? ['eventType'] : []),
    ...(Object.keys(payload).length === 0 ? ['payload'] : []),
  ];
  return { input: normalized, missingFields };
}

function normalizeQueryKnowledge(input: Record<string, unknown>): ToolInputValidation {
  const limit = Number(input.limit);
  const minScore = Number(input.minScore);
  const normalized = {
    query: text(input.query || input.message || input.need),
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 8)) : 4,
    minScore: Number.isFinite(minScore) ? minScore : undefined,
  };
  return {
    input: dropEmpty(normalized),
    missingFields: normalized.query ? [] : ['query'],
  };
}

function normalizeRecommendService(input: Record<string, unknown>): ToolInputValidation {
  const normalized = {
    intent: text(input.intent || input.need || input.concern || input.companyNeed),
    industry: text(input.industry),
    budget: text(input.budget),
    urgency: text(input.urgency) || 'unknown',
  };
  return {
    input: dropEmpty(normalized),
    missingFields: normalized.intent ? [] : ['intent'],
  };
}

function normalizeHandoff(input: Record<string, unknown>): ToolInputValidation {
  const normalized = {
    reason: text(input.reason || input.need || input.concern || input.message),
    priority: text(input.priority) || 'normal',
  };
  return {
    input: dropEmpty(normalized),
    missingFields: normalized.reason ? [] : ['reason'],
  };
}

export function sanitizeToolInputForLog(input: Record<string, unknown>) {
  return sanitizeRecord(input);
}

function sanitizeRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (/secret|token|password|api[_-]?key|authorization/i.test(key)) {
        return [key, '[redacted]'];
      }
      if (/email/i.test(key)) {
        return [key, value ? '[email]' : value];
      }
      if (/phone|telefon|name/i.test(key)) {
        return [key, value ? '[redacted]' : value];
      }
      if (typeof value === 'string') {
        return [key, redactSensitiveTextForLog(value)];
      }
      if (Array.isArray(value)) {
        return [key, value.map((entry) => sanitizeValueForLog(entry))];
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return [key, sanitizeRecord(value as Record<string, unknown>)];
      }
      return [key, value];
    }),
  );
}

function sanitizeValueForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveTextForLog(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValueForLog(entry));
  }
  if (value && typeof value === 'object') {
    return sanitizeRecord(value as Record<string, unknown>);
  }
  return value;
}

function redactSensitiveTextForLog(value: string) {
  return value
    .replace(/\b(passwort|password|kennwort)\s*(?:ist|lautet|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(mfa|2fa|tan|pin)(?:\s*code)?\s*(?:ist|lautet|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(bearer\s+token)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{6,}/g, 'Bearer [redacted]')
    .replace(/\b(client_secret|access_token|refresh_token)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(api[-_\s]?key)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(token|secret)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]');
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function dropEmpty(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}
