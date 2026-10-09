const test = require('node:test');
const assert = require('node:assert/strict');
const { AgentOrchestratorService } = require('../dist/agents/agent-orchestrator.service.js');

test('AgentOrchestratorService executes the default tool plan and aggregates summaries', async () => {
  const statusUpdates = [];
  const toolCalls = [];
  let storedRun = null;

  const service = new AgentOrchestratorService(
    {
      async createRun(siteId, payload) {
        storedRun = {
          id: 'run-1',
          siteId,
          agentKey: payload.agentKey,
          inputSummary: payload.inputSummary,
          metadata: payload.metadata || {},
        };
        return storedRun;
      },
      async getRunById() {
        return storedRun;
      },
      async updateRunStatus(runId, payload) {
        statusUpdates.push({ runId, payload });
        storedRun = {
          ...storedRun,
          id: runId,
          metadata: {
            ...(storedRun?.metadata || {}),
            ...(payload.metadata || {}),
          },
          status: payload.status,
          outputSummary: payload.outputSummary || null,
          errorMessage: payload.errorMessage || null,
        };
        return storedRun;
      },
      async listToolInvocations() {
        return toolCalls.map((call, index) => ({
          id: `tool-${index + 1}`,
          toolKey: call.toolKey,
          toolLabel: call.toolKey,
          status: 'completed',
        }));
      },
    },
    {
      async execute(runId, payload) {
        toolCalls.push({ runId, ...payload });
        if (payload.toolKey === 'search_catalog') {
          return {
            status: 'completed',
            outputPayload: { resultCount: 2 },
          };
        }

        if (payload.toolKey === 'query_knowledge') {
          return {
            status: 'completed',
            outputPayload: { hits: [{ title: 'FAQ' }] },
          };
        }

        return {
          status: 'completed',
          outputPayload: { webhookJobId: 'job-1' },
        };
      },
    },
  );

  const result = await service.createAndExecute('site-1', {
    agentKey: 'ecommerce-product-advisor',
    inputSummary: 'Ich suche Sneaker fuer Herren',
    triggerSource: 'manual',
    metadata: {
      webhook: {
        providerKey: 'crm-webhook',
        payload: { source: 'test' },
      },
    },
  });

  assert.equal(toolCalls.length, 3);
  assert.deepEqual(
    toolCalls.map((call) => call.toolKey),
    ['search_catalog', 'query_knowledge', 'push_webhook'],
  );
  assert.equal(toolCalls[0].controlRunStatus, false);
  assert.equal(statusUpdates[0].payload.status, 'processing');
  assert.equal(statusUpdates.at(-1).payload.status, 'completed');
  assert.match(statusUpdates.at(-1).payload.outputSummary, /Katalog-Treffer/);
  assert.ok(result.run);
  assert.equal(result.tools.length, 3);
});
