import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgentRunDto {
  @IsString()
  @MaxLength(120)
  agentKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  inputSummary?: string;

  @IsOptional()
  @IsString()
  @IsIn(['manual', 'chat', 'automation'])
  triggerSource?: 'manual' | 'chat' | 'automation';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecuteAgentRunDto extends CreateAgentRunDto {
  @IsOptional()
  @IsObject()
  toolInputs?: Record<string, Record<string, unknown>>;

  @IsOptional()
  continueOnError?: boolean;
}

export class ExecuteExistingAgentRunDto {
  @IsOptional()
  @IsObject()
  toolInputs?: Record<string, Record<string, unknown>>;

  @IsOptional()
  continueOnError?: boolean;
}

export class CreateToolInvocationDto {
  @IsString()
  @MaxLength(120)
  toolKey!: string;

  @IsOptional()
  @IsString()
  @IsIn(['queued', 'completed', 'failed', 'skipped'])
  status?: 'queued' | 'completed' | 'failed' | 'skipped';

  @IsOptional()
  @IsObject()
  inputPayload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  errorMessage?: string;
}

export class UpdateAgentTicketStatusDto {
  @IsString()
  @IsIn(['new', 'open', 'in_progress', 'resolved', 'closed'])
  status!: 'new' | 'open' | 'in_progress' | 'resolved' | 'closed';
}
