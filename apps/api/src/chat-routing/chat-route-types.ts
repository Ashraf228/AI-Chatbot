export type ChatRouteKind = 'faq' | 'hybrid' | 'advisor' | 'agent';

export type ChatRouteDecision = {
  route: ChatRouteKind;
  reason: string;
  moduleKey?: string;
  agentKey?: string;
  guide: string;
  cta?: {
    action: 'lead_capture';
    label: string;
    description?: string;
  };
};

export type ChatRouteContext = {
  message: string;
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  enabledModuleKeys: string[];
  moduleConfigs?: Record<string, Record<string, unknown>>;
};
