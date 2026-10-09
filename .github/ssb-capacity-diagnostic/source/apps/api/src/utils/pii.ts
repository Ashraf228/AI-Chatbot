const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(\+?\d[\d\s\-()]{7,}\d)/g;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const SENSITIVE_KEY_PATTERN = /(secret|token|password|passwort|api[_-]?key|apikey|oauth|authorization|private[_-]?key|cookie|smtp|redis|postgres|openai)/i;

export function maskEmail(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  const [local, domain] = value.split('@');
  if (!local || !domain) {
    return '[email]';
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPhone(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) {
    return '[phone]';
  }
  return `***${digits.slice(-4)}`;
}

export function redactPII(input: string): string {
  let s = input ?? '';

  // Emails
  s = s.replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');

  // Phone numbers (simple)
  s = s.replace(PHONE_PATTERN, '[REDACTED_PHONE]');

  // IBAN (optional)
  s = s.replace(IBAN_PATTERN, '[REDACTED_IBAN]');

  return s;
}

export function sanitizeForAuditLog(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactPII(value.length > 2000 ? `${value.slice(0, 2000)}...` : value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForAuditLog(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, '[redacted]'];
      }
      if (/email/i.test(key) && typeof entry === 'string') {
        return [key, maskEmail(entry)];
      }
      if (/phone|telefon/i.test(key) && typeof entry === 'string') {
        return [key, maskPhone(entry)];
      }
      return [key, sanitizeForAuditLog(entry)];
    }),
  );
}
