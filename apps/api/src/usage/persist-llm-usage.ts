import { PrismaService } from '../db/prisma.service';
import { estimateOpenAICost } from './costs';
import { LlmUsageMeasurement } from './llm-usage';

/** One row per actual provider call; event and token aggregate commit together. */
export async function persistLlmUsage(
  db: PrismaService,
  context: { tenantId: string; siteId: string; conversationId: string; sessionId: string },
  measurement: LlmUsageMeasurement,
): Promise<void> {
  if (measurement.tenantId !== context.tenantId || measurement.siteId !== context.siteId) {
    throw new Error('Usage scope mismatch');
  }
  await db.transaction(async (tx) => {
    const scope = await tx.query(
      `SELECT c.id FROM conversations c JOIN sites s ON s.id = c.site_id
       WHERE c.id = $1 AND c.tenant_id = $2 AND c.site_id = $3 AND c.session_id = $4
         AND s.tenant_id = $2 FOR KEY SHARE OF c, s`,
      [context.conversationId, context.tenantId, context.siteId, context.sessionId],
    );
    if (scope.rows.length !== 1) throw new Error('Usage scope mismatch');
    const u = measurement.usage;
    const cost = u.status === 'confirmed'
      ? estimateOpenAICost({ model: measurement.model, inputTokens: u.inputTokens!, outputTokens: u.outputTokens! })
      : null;
    const inserted = await tx.query(
      `INSERT INTO usage_events (
        id, tenant_id, site_id, conversation_id, session_id, model,
        input_tokens, output_tokens, total_tokens, estimated_cost, latency_ms, success,
        created_at, usage_status, provider_key, call_outcome
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO NOTHING RETURNING id`,
      [measurement.callId, context.tenantId, context.siteId, context.conversationId, context.sessionId,
        measurement.model, u.inputTokens, u.outputTokens, u.totalTokens, cost, measurement.latencyMs,
        measurement.outcome === 'success', measurement.startedAt, u.status, measurement.provider, measurement.outcome],
    );
    if (!inserted.rows.length) return;
    // Request/message counters retain their existing successful-response semantics.
    await tx.query(
      `INSERT INTO usage_daily (tenant_id, site_id, day, input_tokens, output_tokens, total_tokens, estimated_cost)
       VALUES ($1, $2, ($3::timestamptz)::date, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, site_id, day) DO UPDATE SET
         input_tokens = usage_daily.input_tokens + EXCLUDED.input_tokens,
         output_tokens = usage_daily.output_tokens + EXCLUDED.output_tokens,
         total_tokens = usage_daily.total_tokens + EXCLUDED.total_tokens,
         estimated_cost = usage_daily.estimated_cost + EXCLUDED.estimated_cost, updated_at = now()`,
      [context.tenantId, context.siteId, measurement.startedAt, u.status === 'confirmed' ? u.inputTokens : 0, u.status === 'confirmed' ? u.outputTokens : 0, u.status === 'confirmed' ? u.totalTokens : 0, cost ?? 0],
    );
  });
}
