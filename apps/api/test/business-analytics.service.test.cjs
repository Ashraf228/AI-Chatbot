const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BusinessAnalyticsService,
  ESTIMATED_SUPPORT_MINUTES_PER_CONVERSATION,
} = require('../dist/business-analytics/business-analytics.service.js');

test('BusinessAnalyticsService handles empty site data without division-by-zero', async () => {
  const captured = [];
  const db = {
    async query(sql, params = []) {
      captured.push({ sql, params });
      if (/COALESCE\(AVG\(latency_ms\)/i.test(sql)) {
        return { rows: [{ latency: '0' }] };
      }
      if (/COUNT\(\*\)::text AS total/i.test(sql)) {
        return { rows: [{ total: '0', ready: '0', processing: '0', failed: '0', active_ready: '0' }] };
      }
      if (/COUNT\(\*\)::text AS count/i.test(sql)) {
        return { rows: [{ count: '0' }] };
      }
      return { rows: [] };
    },
  };
  const service = new BusinessAnalyticsService(db);

  const result = await service.buildSiteSummary('site-1');

  assert.equal(result.conversionRate, 0);
  assert.equal(result.handoffRate, 0);
  assert.equal(result.knowledgeHitRate, 0);
  assert.equal(result.estimatedSupportTimeSavedMinutes, 0);
  assert.equal(result.supportTimeAssumptionMinutes, ESTIMATED_SUPPORT_MINUTES_PER_CONVERSATION);
  assert.ok(captured.some((entry) => JSON.stringify(entry.params).includes('site-1')));
});

test('BusinessAnalyticsService aggregates conversations and leads into business KPIs', async () => {
  const db = {
    async query(sql) {
      if (/FROM conversations WHERE site_id = ANY\(\$1::text\[\]\)$/i.test(sql)) {
        return { rows: [{ count: '10' }] };
      }
      if (/FROM conversations WHERE site_id = ANY\(\$1::text\[\]\) AND created_at >= date_trunc/i.test(sql)) {
        return { rows: [{ count: '2' }] };
      }
      if (/FROM conversations WHERE site_id = ANY\(\$1::text\[\]\) AND created_at >= now\(\) - interval '7 days'/i.test(sql)) {
        return { rows: [{ count: '8' }] };
      }
      if (/FROM widget_leads WHERE site_id = ANY\(\$1::text\[\]\) AND created_at >= date_trunc/i.test(sql)) {
        return { rows: [{ count: '1' }] };
      }
      if (/FROM widget_leads WHERE site_id = ANY\(\$1::text\[\]\) AND created_at >= now\(\) - interval '7 days'/i.test(sql)) {
        return { rows: [{ count: '2' }] };
      }
      if (/FROM agent_runs/i.test(sql) && /decisionType/i.test(sql)) {
        return { rows: [{ count: '1' }] };
      }
      if (/FROM tool_invocations/i.test(sql) && /tool_key = 'query_knowledge'/i.test(sql)) {
        return { rows: [{ count: '4' }] };
      }
      if (/FROM tool_invocations/i.test(sql)) {
        return { rows: [{ count: '5' }] };
      }
      if (/FROM agent_tickets/i.test(sql) || /FROM agent_contact_requests/i.test(sql)) {
        return { rows: [{ count: '0' }] };
      }
      if (/COALESCE\(AVG\(latency_ms\)/i.test(sql)) {
        return { rows: [{ latency: '123' }] };
      }
      if (/COUNT\(\*\)::text AS total/i.test(sql)) {
        return { rows: [{ total: '1', ready: '1', processing: '0', failed: '0', active_ready: '1' }] };
      }
      return { rows: [] };
    },
  };
  const service = new BusinessAnalyticsService(db);

  const result = await service.buildSiteSummary('site-1');

  assert.equal(result.conversations7d, 8);
  assert.equal(result.leads7d, 2);
  assert.equal(result.conversionRate, 25);
  assert.equal(result.handoffRate, 12.5);
  assert.equal(result.knowledgeHitRate, 50);
  assert.equal(result.toolExecutionCount, 5);
  assert.equal(result.averageResponseTimeMs, 123);
  assert.equal(result.estimatedSupportTimeSavedMinutes, 32);
});
