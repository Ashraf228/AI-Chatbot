export type ToolExecutionContext = {
  tenantId: string;
  siteId: string;
  conversationId: string;
  messageId?: string;
  source: 'widget' | 'dashboard' | 'api' | 'system';
  decisionId?: string;
  userId?: string;
  visitorId?: string;
};
