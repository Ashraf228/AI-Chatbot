export type PlanCode = 'starter' | 'business' | 'agency' | 'enterprise';

export type PlanLimits = {
  maxSites?: number;
  monthlyMessages?: number;
  monthlyLeads?: number;
  maxKnowledgeSources?: number;
  maxIntegrations?: number;
} | null;

export type PlanFeatures = {
  customBranding?: boolean;
  whiteLabel?: boolean;
  strictKnowledgeMode?: boolean;
  privacyExport?: boolean;
  prioritySupport?: boolean;
  customLimits?: boolean;
};

export type BillingPlan = {
  id: string;
  code: PlanCode;
  name: string;
  description: string;
  monthlyPriceCents: number | null;
  currency: string;
  limits: PlanLimits;
  features: PlanFeatures;
  isActive: boolean;
};

export type TenantSubscription = {
  id: string;
  tenantId: string;
  planId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'internal';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  metadata: Record<string, unknown>;
};

export type LimitCheck = {
  key: keyof NonNullable<PlanLimits>;
  limit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
};
