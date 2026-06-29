import { AssistantProfile } from '../assistant-profiles';

export type ConversationIntent =
  | 'question'
  | 'support'
  | 'sales'
  | 'appointment'
  | 'ticket'
  | 'product_advice'
  | 'complaint'
  | 'handoff'
  | 'unknown';

export type ConversationGoal =
  | 'answer_from_knowledge'
  | 'solve_problem'
  | 'collect_request'
  | 'create_ticket'
  | 'recommend_product'
  | 'prepare_contact'
  | 'trigger_integration'
  | 'escalate_human'
  | 'clarify_intent';

export type ConversationStage =
  | 'understand'
  | 'answer'
  | 'qualify'
  | 'collect_details'
  | 'confirm'
  | 'handoff'
  | 'completed'
  | 'recovery';

export type ConversationHistoryEntry = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ConversationDecision = {
  intent: ConversationIntent;
  goal: ConversationGoal;
  stage: ConversationStage;
  confidence: number;
  selectedAgentKey: string | null;
  suggestedAgentKey?: string | null;
  agentSelectionReason?: string;
  agentAvailable?: boolean;
  requiredFields: string[];
  missingFields: string[];
  knownFields: string[];
  nextAction: string;
  shouldUseKnowledge: boolean;
  shouldHandoff: boolean;
  shouldAskQuestion: boolean;
  shouldSummarize: boolean;
  warnings: string[];
  reasons: string[];
};

export type EngineKnowledgeSnippet = {
  id: string;
  sourceId?: string | null;
  documentId: string;
  chunkId: string;
  title: string;
  sourceType: string;
  score: number;
  excerpt: string;
  url?: string;
  scope?: string;
  agentKeys?: string[];
  metadata?: Record<string, unknown>;
};

export type EngineKnowledgeRetrievalResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'available' | 'empty' | 'disabled' | 'error';
  snippets: EngineKnowledgeSnippet[];
  warnings: string[];
  reasons: string[];
};

export type EngineResponseDraft = {
  text: string;
  mode:
    | 'knowledge_answer'
    | 'support_guidance'
    | 'clarification'
    | 'handoff_preparation'
    | 'appointment_preparation'
    | 'product_advice'
    | 'complaint_escalation';
  usedKnowledge: boolean;
  usedKnowledgeSources: EngineKnowledgeSnippet[];
  groundingStatus: 'grounded' | 'partially_grounded' | 'ungrounded' | 'not_required';
  groundingWarnings: string[];
  askedQuestion?: string;
  nextActionLabel: string;
  shouldShowSources: boolean;
  shouldAskQuestion: boolean;
  shouldHandoff: boolean;
  missingFields: string[];
  confidence: number;
};

export type EngineResponseQuality = {
  status: 'good' | 'needs_review' | 'risky' | 'unknown';
  score: number;
  findings: string[];
  risks: string[];
  recommendations: string[];
};

export type EngineResponseSafety = {
  noSideEffects: true;
  publicWidgetUnaffected: true;
  integrationsSuppressed: true;
  sanitized: true;
};

export type ConversationEngineResponsePreview = {
  enabled: boolean;
  decision: ConversationDecision;
  draft: EngineResponseDraft | null;
  knowledgeRetrieval?: EngineKnowledgeRetrievalResult;
  quality: EngineResponseQuality | null;
  safety: EngineResponseSafety;
  warnings: string[];
  reasons: string[];
};

export type ConversationEnginePreviewInput = {
  assistantProfile: AssistantProfile;
  latestUserMessage: string;
  conversationHistory?: ConversationHistoryEntry[];
  existingConversationState?: Record<string, unknown> | null;
  knowledgeAvailable?: boolean;
  expectedIntent?: string;
  expectedGoal?: string;
  expectedAgentKey?: string;
  testMode: true;
};

export type ConversationContext = {
  assistantProfile: AssistantProfile;
  latestUserMessage: string;
  conversationHistory: ConversationHistoryEntry[];
  existingConversationState: Record<string, unknown>;
  knowledgeAvailable: boolean;
  normalizedText: string;
  requiredFields: string[];
  knownFields: string[];
  missingFields: string[];
  warnings: string[];
  reasons: string[];
};
