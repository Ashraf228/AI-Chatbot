export type BusinessQuestion = {
  question: string;
  count: number;
};

export type BusinessTimePoint = {
  date: string;
  count: number;
};

export type BusinessConversation = {
  id: string;
  siteId: string;
  siteName: string;
  sessionId: string;
  lastActiveAt: string;
  messageCount: number;
  lastMessage: string;
  hasLead: boolean;
  hasHandoff: boolean;
  hasTicket: boolean;
};

export type BusinessLead = {
  id: string;
  siteId: string;
  siteName: string;
  sessionId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  createdAt: string;
};

export type BusinessSiteMetric = {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  isLive: boolean;
  siteKey: string;
  conversations7d: number;
  leads7d: number;
  conversionRate: number;
};

export type RecommendedAction = {
  siteId: string;
  siteName: string;
  label: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export type KnowledgeSummary = {
  total: number;
  ready: number;
  processing: number;
  failed: number;
  activeReady: number;
};

export type BusinessActivity = {
  id: string;
  label: string;
  status: string;
  createdAt: string;
};

export type BusinessSummary = {
  totalConversations: number;
  conversationsToday: number;
  conversations7d: number;
  leadsToday: number;
  leads7d: number;
  conversionRate: number;
  handoffRate: number;
  toolExecutionCount: number;
  knowledgeHitRate: number;
  averageResponseTimeMs: number;
  estimatedSupportTimeSavedMinutes: number;
  openHandoffsOrTickets: number;
  activeSites?: number;
  sites?: BusinessSiteMetric[];
  topQuestions: BusinessQuestion[];
  unansweredQuestions: BusinessQuestion[];
  conversationsOverTime: BusinessTimePoint[];
  leadsOverTime: BusinessTimePoint[];
  recentConversations: BusinessConversation[];
  recentLeads: BusinessLead[];
  recentActivity?: BusinessActivity[];
  recommendedActions: RecommendedAction[];
  knowledge?: KnowledgeSummary;
  supportTimeAssumptionMinutes: number;
};

export function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE").format(value || 0);
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value || 0)}%`;
}

export function formatMinutes(value: number) {
  if (value >= 60) {
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value / 60)} Std.`;
  }
  return `${formatNumber(value)} Min.`;
}
