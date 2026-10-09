import type { LocalServiceIntakeFlowConfig } from '../../site-modules/module-configs';

export type AgentDecisionType =
  | 'answer'
  | 'ask_followup'
  | 'capture_lead'
  | 'schedule_contact'
  | 'create_ticket'
  | 'recommend_service'
  | 'handoff'
  | 'trigger_tool';

export type AgentDecisionNextAction =
  | 'continue_answer'
  | 'ask_for_missing_context'
  | 'ask_for_contact_details'
  | 'prepare_lead_capture'
  | 'prepare_schedule_contact'
  | 'prepare_ticket'
  | 'recommend_human_handoff'
  | 'prepare_tool_execution'
  | 'recommend_service';

export type AgentCollectedFields = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  industry?: string;
  concern?: string;
  companyNeed?: string;
  urgency?: 'low' | 'medium' | 'high' | 'unknown';
  preferredContact?: 'email' | 'phone' | 'unknown';
};

export type AgentDecision = {
  type: AgentDecisionType;
  confidence: number;
  reason: string;
  message: string;
  metadata: Record<string, unknown>;
  suggestedTools: string[];
  requiredFields: string[];
  collectedFields: AgentCollectedFields;
  nextAction: AgentDecisionNextAction;
};

export type AgentMemory = {
  pendingLeadStatus?: 'pending' | 'completed';
  pendingTicketStatus?:
    | 'triage'
    | 'solution_offered'
    | 'ticket_offered'
    | 'collecting'
    | 'ready_to_create'
    | 'created'
    | 'cancelled'
    | 'resolved';
  pendingTicketIssueType?: string;
  pendingTicketSummary?: string;
  pendingTicketUrgency?: string;
  pendingTicketImpact?: string;
  knownEmail?: string;
  knownPhone?: string;
  knownName?: string;
  company?: string;
  industry?: string;
  concern?: string;
  urgency?: 'low' | 'medium' | 'high' | 'unknown';
  preferredContact?: 'email' | 'phone' | 'unknown';
  intentHistory: string[];
  conversationStage?: string;
  rawMetadata: Record<string, unknown>;
};

export type AgentPolicyContext = {
  tenantId: string;
  siteId: string;
  conversationId: string;
  sessionId: string;
  message: string;
  history: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  memory: AgentMemory;
  moduleContext: {
    leadSalesEnabled: boolean;
    ecommerceAdvisorEnabled: boolean;
    propertyTicketingEnabled: boolean;
    itSupportEnabled?: boolean;
    supportEnabled: boolean;
    primaryGoal?: string;
    intakeFlow?: LocalServiceIntakeFlowConfig;
  };
  siteConfig: {
    setupGoal?: string;
    ctaText?: string;
    scheduleUrl?: string;
    contactUrl?: string;
    leadCaptureEnabled?: boolean;
    intakeFlow?: LocalServiceIntakeFlowConfig;
  };
};

export type AgentRunLogStart = {
  runId: string;
  startedAt: number;
} | null;
