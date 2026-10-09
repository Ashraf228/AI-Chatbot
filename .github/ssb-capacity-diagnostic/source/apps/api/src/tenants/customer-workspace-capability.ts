export const CUSTOMER_WORKSPACE_CAPABILITY_KEY = 'customerWorkspaceOperatorV1';

export const CUSTOMER_WORKSPACE_ROLES = new Set(['owner', 'admin', 'manager', 'editor']);

type CustomerWorkspaceCapability = {
  enabled: true;
  siteIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function isCanonicalWorkspaceId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 120
    && value === value.trim()
    && value !== '.'
    && value !== '..'
    && !value.includes('*');
}

export function parseCustomerWorkspaceCapability(value: unknown): CustomerWorkspaceCapability | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('enabled') || !keys.includes('siteIds')) return null;
  if (
    value.enabled !== true
    || !Array.isArray(value.siteIds)
    || value.siteIds.length === 0
    || value.siteIds.length > 100
  ) return null;
  if (!value.siteIds.every(isCanonicalWorkspaceId) || new Set(value.siteIds).size !== value.siteIds.length) {
    return null;
  }
  return { enabled: true, siteIds: [...value.siteIds] };
}

export function createCustomerWorkspaceCapability(siteIds: unknown): CustomerWorkspaceCapability | null {
  if (!Array.isArray(siteIds) || siteIds.length === 0 || siteIds.length > 100) return null;
  return parseCustomerWorkspaceCapability({ enabled: true, siteIds });
}
