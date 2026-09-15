import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../db/prisma.service';
import { ProviderApprovalStorageLookupService } from '../knowledge-sources/provider-approval-storage-lookup.service';
import { resolveSiteRuntimeGrantDeploymentEnvironment } from '../knowledge-sources/site-runtime-grant-runtime-contract';

export type LlmGenerationRuntimeContext = {
  tenantId: string;
  siteId: string;
};

const LLM_GENERATION_PURPOSE = 'llm_generation';
const LLM_PROVIDER_KEY = 'openai';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const PUBLIC_LLM_DENIAL = 'Die Antwortgenerierung ist derzeit nicht sicher verfuegbar.';

type LlmRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function isAllowedOpenAiRequestUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'api.openai.com' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      (url.pathname === '/v1' || url.pathname.startsWith('/v1/'))
    );
  } catch {
    return false;
  }
}

async function openAiOnlyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const requestUrl = input instanceof Request ? input.url : input.toString();
  if (!isAllowedOpenAiRequestUrl(requestUrl)) {
    throw new Error('LLM provider target rejected');
  }

  return globalThis.fetch(input, { ...init, redirect: 'error' });
}

@Injectable()
export class LlmService {
  private client: OpenAI | null = null;

  constructor(
    private readonly db: PrismaService,
    private readonly approvalLookup: ProviderApprovalStorageLookupService,
  ) {}

  async answer(system: string, user: string, context: LlmGenerationRuntimeContext) {
    const config = this.resolveRuntimeConfig();
    await this.assertGenerationAuthorized(context, config.model);

    const start = Date.now();

    const res = await this.getClient(config).chat.completions.create({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const latencyMs = Date.now() - start;

    const text = res.choices[0]?.message?.content ?? '';

    // ✅ OpenAI Usage auslesen
    const usage = res.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return {
      text,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      model: config.model,
      latencyMs,
    };
  }

  async streamAnswer(
    system: string,
    user: string,
    onChunk: (chunk: string) => Promise<void> | void,
    context: LlmGenerationRuntimeContext,
  ) {
    const config = this.resolveRuntimeConfig();
    await this.assertGenerationAuthorized(context, config.model);
    const start = Date.now();

    const stream = await this.getClient(config).chat.completions.create({
      model: config.model,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    let text = '';

    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content ?? '';
      if (!delta) {
        continue;
      }

      text += delta;
      await onChunk(delta);
    }

    return {
      text,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      model: config.model,
      latencyMs: Date.now() - start,
    };
  }

  private async assertGenerationAuthorized(
    context: LlmGenerationRuntimeContext | null | undefined,
    model: string,
  ): Promise<void> {
    const tenantId = context?.tenantId?.trim() || '';
    const siteId = context?.siteId?.trim() || '';
    const normalizedModel = model.trim();
    const environment = resolveSiteRuntimeGrantDeploymentEnvironment();

    if (!tenantId || !siteId || !normalizedModel || !environment.supported) {
      this.denyGeneration();
    }

    try {
      const site = await this.db.query<{ id: string }>(
        `SELECT id
         FROM sites
         WHERE id = $1
           AND tenant_id = $2
         LIMIT 1`,
        [siteId, tenantId],
      );
      if (site.rows.length !== 1) {
        this.denyGeneration();
      }
    } catch {
      this.denyGeneration();
    }

    const decision = await this.approvalLookup.evaluateSiteRuntimeLlmGenerationApprovalFromStorage({
      tenantId,
      siteId,
      environment: environment.environment,
      providerKey: LLM_PROVIDER_KEY,
      model: normalizedModel,
    });
    const policy = decision.policy;
    const policyMatchesAttempt =
      decision.allowed &&
      decision.decisionCode === 'allowed' &&
      policy?.scopeKind === 'site_runtime' &&
      policy.tenantId.trim() === tenantId &&
      policy.siteId.trim() === siteId &&
      policy.environment === environment.environment &&
      policy.provider.trim() === LLM_PROVIDER_KEY &&
      policy.model.trim() === normalizedModel &&
      policy.purpose.trim() === LLM_GENERATION_PURPOSE &&
      policy.sourceId == null &&
      policy.sourceTypes.length === 0 &&
      policy.usageContexts.length === 1 &&
      policy.usageContexts[0] === LLM_GENERATION_PURPOSE;

    if (!policyMatchesAttempt) {
      this.denyGeneration();
    }
  }

  private denyGeneration(): never {
    throw new ServiceUnavailableException(PUBLIC_LLM_DENIAL);
  }

  private resolveRuntimeConfig(): LlmRuntimeConfig {
    const model = (process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim();
    const apiKey = process.env.OPENAI_API_KEY?.trim() || '';
    const configuredBaseUrl = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, '') || OPENAI_BASE_URL;

    if (
      !apiKey ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model) ||
      configuredBaseUrl !== OPENAI_BASE_URL
    ) {
      this.denyGeneration();
    }

    return { apiKey, baseUrl: OPENAI_BASE_URL, model };
  }

  private getClient(config: LlmRuntimeConfig): OpenAI {
    this.client ??= new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      fetch: openAiOnlyFetch,
      logLevel: 'off',
      maxRetries: 0,
    });
    return this.client;
  }
}
