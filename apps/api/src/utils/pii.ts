export function redactPII(input: string): string {
  let s = input ?? '';

  // Emails
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');

  // Phone numbers (simple)
  s = s.replace(/(\+?\d[\d\s\-()]{7,}\d)/g, '[REDACTED_PHONE]');

  // IBAN (optional)
  s = s.replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, '[REDACTED_IBAN]');

  return s;
}