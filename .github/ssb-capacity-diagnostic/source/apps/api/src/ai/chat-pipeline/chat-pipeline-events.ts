import { ResponsePart } from '../../chat/response-parts';
import { ToolExecutionResult } from '../../tools/tool-result.types';
import { ChatPipelineSourceReference } from './chat-pipeline.types';

export type ChatPipelineEvent =
  | {
      type: 'message_start';
      sessionId: string;
      conversationId: string;
    }
  | {
      type: 'token';
      delta: string;
    }
  | {
      type: 'sources';
      sources: ChatPipelineSourceReference[];
    }
  | {
      type: 'tool_event';
      label: string;
      status?: 'success' | 'warning' | 'error' | 'pending';
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'lead_event';
      label: string;
      leadId?: string;
      contactRequestId?: string;
    }
  | {
      type: 'message_end';
      answer: string;
      sessionId: string;
      conversationId: string;
      parts: ResponsePart[];
      sources: ChatPipelineSourceReference[];
      toolResults?: ToolExecutionResult[];
    }
  | {
      type: 'error';
      message: string;
    };
