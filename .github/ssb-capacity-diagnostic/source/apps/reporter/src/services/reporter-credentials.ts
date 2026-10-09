export function reporterCredential() {
  if (process.env.ADMIN_KEY || process.env.DATABASE_URL || process.env.REDIS_URL || process.env.ADMIN_WRITER_DATABASE_URL_FILE
    || process.env.ADMIN_WRITER_SIGNING_KEY_FILE || process.env.MIGRATOR_DATABASE_URL_FILE
    || process.env.MAINTENANCE_OPERATOR_FILE || Object.keys(process.env).some(k => k.startsWith('PG') && process.env[k])) throw new Error('Privileged reporter credentials forbidden');
  const token = process.env.REPORTER_API_TOKEN || '';
  if (token.length < 32) throw new Error('REPORTER_API_TOKEN missing');
  return token;
}

export function reporterSiteIds(): string[] {
  const bindings: unknown = JSON.parse(process.env.REPORTER_SITE_BINDINGS || '[]');
  if (!Array.isArray(bindings) || !bindings.length || bindings.some(b => !b || !/^[A-Za-z0-9_-]+$/.test(b.siteId)
    || !/^[A-Za-z0-9_-]+$/.test(b.tenantId) || Object.keys(b).sort().join(',') !== 'siteId,tenantId')
    || new Set(bindings.map(b => b.siteId)).size !== bindings.length) throw new Error('REPORTER_SITE_BINDINGS invalid');
  return bindings.map(b => b.siteId);
}
