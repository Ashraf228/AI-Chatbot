import { ResponsePart } from '../../chat/response-parts';
import { ChatRouteDecision } from '../../chat-routing/chat-route-types';
import { VectorChunkMetadata } from '../../vector/vector.service';
import {
  ShopifyCollection,
  ShopifyProduct,
} from '../../integrations/shopify/shopify-catalog.service';
import { AgentDecision } from '../orchestration/agent-decision.types';
import { ToolExecutionResult } from '../../tools/tool-result.types';

export type ChatPipelineSource = 'widget' | 'dashboard' | 'api';

export type ChatPipelineHistoryEntry = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ChatPipelineSourceReference = {
  sourceId?: string;
  title?: string;
  type?: string;
  url?: string;
  score: number;
  excerpt?: string;
  metadata: VectorChunkMetadata;
};

export type ChatPipelineInput = {
  tenantId: string;
  siteId: string;
  message: string;
  source: ChatPipelineSource;
  sessionId?: string;
  siteConfig?: Record<string, unknown> | null;
  systemPrompt?: string | null;
  conversationFlow?: unknown;
  sourceUrl?: string | null;
};

export type ChatPipelineResult = {
  answer: string;
  parts: ResponsePart[];
  sources: ChatPipelineSourceReference[];
  sessionId: string;
  conversationId: string;
  route?: ChatRouteDecision['route'] | 'agent';
  decision?: AgentDecision;
  toolResults?: ToolExecutionResult[];
};

export type ChatPipelineAdvisorContext = {
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
  clarificationQuestion?: string;
  effectiveQuery?: string;
  state: string;
  stateGuide: string;
};

export type ChatPipelineUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  success: boolean;
};
