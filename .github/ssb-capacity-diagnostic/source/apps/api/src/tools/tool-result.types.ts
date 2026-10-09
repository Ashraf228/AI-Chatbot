export type ToolExecutionStatus =
  | 'success'
  | 'failed'
  | 'missing_fields'
  | 'queued'
  | 'skipped';

export type ToolExecutionResult = {
  toolName: string;
  status: ToolExecutionStatus;
  message: string;
  data?: Record<string, unknown>;
  missingFields?: string[];
  error?: {
    code: string;
    message: string;
  };
  auditId?: string;
};

export type ToolAuditEntry = {
  runId: string;
  invocationId: string;
  startedAt: number;
} | null;
