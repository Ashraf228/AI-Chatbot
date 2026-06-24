import { createHash, randomBytes } from 'crypto';

export type EvaluationSupportProfile = 'it' | 'product';
export type ProductImpact = 'low' | 'medium' | 'high' | 'critical';

export type ProductSupportConfig = {
  supportProfile: EvaluationSupportProfile;
  requiredFields: string[];
  maximumTroubleshootingSteps: number;
  requireExplicitConfirmation: boolean;
  allowExternalForwarding: boolean;
  collectContactFromAuthenticatedAccount: boolean;
  syntheticOrganizationLabel: string;
  urgentEscalationCategories: string[];
};

export type ProductTicketFields = {
  supportProfile: 'product';
  product?: string;
  module?: string;
  customerOrganization?: string;
  customerReference?: string;
  processOrFormName?: string;
  description?: string;
  impact?: ProductImpact;
  browser?: string;
  device?: string;
  operatingSystem?: string;
  errorMessage?: string;
  alreadyTried?: string;
  reporterName?: string;
  reporterEmail?: string;
};

export type ProductTicketPreview = {
  status: 'collecting' | 'ready' | 'urgent_escalation';
  supportProfile: 'product';
  fields: Omit<ProductTicketFields, 'reporterEmail'>;
  missingFields: string[];
  previewToken?: string;
  expiresAt?: string;
  demo: true;
  synthetic: true;
};

const DEFAULT_PRODUCT_SUPPORT_CONFIG: ProductSupportConfig = {
  supportProfile: 'it',
  requiredFields: ['product', 'module', 'customerOrganization', 'description', 'impact'],
  maximumTroubleshootingSteps: 2,
  requireExplicitConfirmation: true,
  allowExternalForwarding: false,
  collectContactFromAuthenticatedAccount: true,
  syntheticOrganizationLabel: 'Beispielkommune - Demonstrator',
  urgentEscalationCategories: [
    'datenverlust',
    'sicherheitsvorfall',
    'unberechtigter zugriff',
    'credential disclosure',
    'ausfall',
    'critical',
    'kritisch',
  ],
};

const PRODUCT_REQUIRED_FIELDS = ['product', 'module', 'customerOrganization', 'description', 'impact'];
const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED]'],
  [/\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Authorization: Bearer [REDACTED]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]'],
  [/\b(api[_-]?key|apiKey|secret|token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^"'\s,;]{6,}/gi, '$1=[REDACTED]'],
  [/\b(password|passwort|pwd)\s*[:=]\s*["']?[^"'\s,;]{1,}/gi, '$1=[REDACTED]'],
  [/\b(session|sessionid|sid|cookie)\s*[:=]\s*["']?[^"'\s,;]{8,}/gi, '$1=[REDACTED]'],
  [/\b(mfa|otp|2fa|code|pin)\b[^0-9A-Za-z]{0,12}[0-9]{4,8}/gi, '$1 [REDACTED]'],
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const entries = value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));
  return entries.length > 0 ? [...new Set(entries.map((entry) => entry.trim()))] : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asClampedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function asNonEmptyString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function redactEvaluationSensitiveText(value: unknown): string {
  let text = typeof value === 'string' ? value : '';
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .replace(/\[(DATEN BEREINIGT|TESTDATEN BEREINIGT|REDACTED)]/gi, '[REDACTED]')
    .replace(/\b(undefined|null)\b/gi, '[REDACTED]')
    .trim();
}

export function redactEvaluationSensitiveValue<T>(value: T): T {
  if (typeof value === 'string') {
    return redactEvaluationSensitiveText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactEvaluationSensitiveValue(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactEvaluationSensitiveValue(entry),
      ]),
    ) as T;
  }
  return value;
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function createPreviewToken() {
  return randomBytes(32).toString('base64url');
}

export function resolveProductSupportConfig(siteConfig: Record<string, unknown>): ProductSupportConfig {
  const workspace = asRecord(siteConfig.evaluationWorkspace);
  const moduleConfigs = asRecord(siteConfig.moduleConfigs);
  const itSupport = asRecord(moduleConfigs['it-support'] || siteConfig.itSupport || workspace.productSupport);
  const supportProfile = itSupport.supportProfile === 'product' || workspace.supportProfile === 'product'
    ? 'product'
    : DEFAULT_PRODUCT_SUPPORT_CONFIG.supportProfile;
  return {
    supportProfile,
    requiredFields: asStringArray(itSupport.requiredFields, DEFAULT_PRODUCT_SUPPORT_CONFIG.requiredFields),
    maximumTroubleshootingSteps: asClampedInteger(
      itSupport.maximumTroubleshootingSteps,
      DEFAULT_PRODUCT_SUPPORT_CONFIG.maximumTroubleshootingSteps,
      0,
      5,
    ),
    requireExplicitConfirmation: asBoolean(
      itSupport.requireExplicitConfirmation,
      DEFAULT_PRODUCT_SUPPORT_CONFIG.requireExplicitConfirmation,
    ),
    allowExternalForwarding: asBoolean(
      itSupport.allowExternalForwarding,
      DEFAULT_PRODUCT_SUPPORT_CONFIG.allowExternalForwarding,
    ),
    collectContactFromAuthenticatedAccount: asBoolean(
      itSupport.collectContactFromAuthenticatedAccount,
      DEFAULT_PRODUCT_SUPPORT_CONFIG.collectContactFromAuthenticatedAccount,
    ),
    syntheticOrganizationLabel: asNonEmptyString(
      itSupport.syntheticOrganizationLabel || workspace.syntheticOrganizationLabel,
      DEFAULT_PRODUCT_SUPPORT_CONFIG.syntheticOrganizationLabel,
    ),
    urgentEscalationCategories: asStringArray(
      itSupport.urgentEscalationCategories,
      DEFAULT_PRODUCT_SUPPORT_CONFIG.urgentEscalationCategories,
    ),
  };
}

export function isSolvedAnswer(message: string) {
  return /\b(ja|gel[oö]st|hat geholfen|passt|erledigt|funktioniert)\b/i.test(message);
}

export function isUnresolvedAnswer(message: string) {
  return /\b(nein|nicht gel[oö]st|geht nicht|funktioniert nicht|ticket|supportfall|weitergeben|melden)\b/i.test(message);
}

export function isCancelRequest(message: string) {
  return /\b(abbrechen|stop|egal|lass gut|nicht melden|kein ticket|doch nicht)\b/i.test(message);
}

export function isTicketRequest(message: string) {
  return /\b(ticket|supportfall|weitergeben|melden|an support|mensch|mitarbeiter)\b/i.test(message);
}

export function isUrgentProductCase(message: string, config: ProductSupportConfig) {
  const normalized = message.toLowerCase();
  return config.urgentEscalationCategories.some((entry) => normalized.includes(entry.toLowerCase())) ||
    /\b(datenverlust|sicherheitsvorfall|unberechtigter zugriff|gehackt|ausfall|kritisch|critical|produktivsystem down|nicht erreichbar)\b/i.test(message);
}

export function extractProductFields(
  message: string,
  previous: Partial<ProductTicketFields>,
  config: ProductSupportConfig,
  reporter: { name?: string; email?: string },
): ProductTicketFields {
  const sanitized = redactEvaluationSensitiveText(message);
  const normalized = sanitized.toLowerCase();
  const fields: ProductTicketFields = {
    supportProfile: 'product',
    ...previous,
    customerOrganization: previous.customerOrganization || config.syntheticOrganizationLabel,
  };
  if (config.collectContactFromAuthenticatedAccount) {
    fields.reporterName = reporter.name || fields.reporterName;
    fields.reporterEmail = reporter.email || fields.reporterEmail;
  }
  if (!fields.product) {
    fields.product = 'Kooperationsdemonstrator';
  }
  if (!fields.module) {
    if (/(formular|antrag|prozess)/i.test(normalized)) fields.module = 'Formularverwaltung';
    else if (/(status|vorgang|bearbeitung)/i.test(normalized)) fields.module = 'Vorgangsstatus';
    else if (/(upload|anlage|datei|dokument)/i.test(normalized)) fields.module = 'Dokumenten- und Anlagenverwaltung';
    else if (/(login|anmeldung|konto)/i.test(normalized)) fields.module = 'Anmeldung';
    else fields.module = 'Produktsupport';
  }
  if (!fields.description && sanitized.length > 8 && !isSolvedAnswer(sanitized) && !isCancelRequest(sanitized)) {
    fields.description = sanitized.slice(0, 1200);
  }
  if (!fields.impact) {
    if (/\b(kritisch|critical|ausfall|datenverlust|sicherheitsvorfall|produktivsystem down)\b/i.test(normalized)) fields.impact = 'critical';
    else if (/\b(blockiert|dringend|hoch|kann nicht arbeiten)\b/i.test(normalized)) fields.impact = 'high';
    else if (/\b(mittel|mehrere nutzer|eingeschr[aä]nkt)\b/i.test(normalized)) fields.impact = 'medium';
    else if (/\b(niedrig|frage|hinweis|kosmetik)\b/i.test(normalized)) fields.impact = 'low';
  }
  const processMatch = sanitized.match(/\b(?:formular|prozess|antrag)\s*[:\-]?\s*([A-ZÄÖÜa-zäöü0-9 _/-]{3,80})/);
  if (!fields.processOrFormName && processMatch?.[1]) fields.processOrFormName = processMatch[1].trim();
  const errorMatch = sanitized.match(/\b(?:fehler|fehlermeldung|error)\s*[:\-]\s*([^\n]{3,160})/i);
  if (!fields.errorMessage && errorMatch?.[1]) fields.errorMessage = errorMatch[1].trim();
  if (!fields.alreadyTried && /\b(neu geladen|cache|browser gewechselt|abgemeldet|angemeldet)\b/i.test(normalized)) {
    fields.alreadyTried = sanitized.slice(0, 300);
  }
  return redactEvaluationSensitiveValue(fields);
}

export function missingProductFields(fields: Partial<ProductTicketFields>, config: ProductSupportConfig) {
  const required = config.requiredFields.length > 0 ? config.requiredFields : PRODUCT_REQUIRED_FIELDS;
  return required.filter((field) => {
    const value = fields[field as keyof ProductTicketFields];
    return typeof value !== 'string' || !value.trim();
  });
}

export function nextProductQuestion(missingFields: string[]) {
  const next = missingFields[0];
  if (next === 'product') return 'Um welches Produkt oder Fachverfahren geht es?';
  if (next === 'module') return 'Welches Modul oder welcher Bereich ist betroffen?';
  if (next === 'customerOrganization') return 'Welche Organisation soll im Demo-Supportfall genannt werden?';
  if (next === 'description') return 'Bitte beschreiben Sie kurz, was passiert ist und was Sie erwartet hätten.';
  if (next === 'impact') return 'Wie stark ist die Auswirkung - niedrig, mittel, hoch oder kritisch?';
  return 'Welche Information fehlt noch fuer den Demo-Supportfall?';
}

export function publicPreviewFields(fields: ProductTicketFields): Omit<ProductTicketFields, 'reporterEmail'> {
  const { reporterEmail: _reporterEmail, ...publicFields } = fields;
  return redactEvaluationSensitiveValue(publicFields);
}

export function buildPreviewSummary(fields: ProductTicketFields) {
  const impactLabels: Record<ProductImpact, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    critical: 'Kritisch',
  };
  return [
    `Produkt: ${fields.product || 'offen'}`,
    `Modul: ${fields.module || 'offen'}`,
    `Organisation: ${fields.customerOrganization || 'offen'}`,
    `Auswirkung: ${fields.impact ? impactLabels[fields.impact] : 'offen'}`,
    `Beschreibung: ${fields.description || 'offen'}`,
  ].join('\n');
}
