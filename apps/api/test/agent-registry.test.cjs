const test = require('node:test');
const assert = require('node:assert/strict');
const { getAgentDefinition } = require('../dist/agents/agent-registry.js');

test('agent registry exposes dedicated IT support agent', () => {
  const agent = getAgentDefinition('it-support-agent');

  assert.equal(agent.label, 'IT-Support-Agent');
  assert.equal(agent.category, 'support');
  assert.deepEqual(agent.requiredModuleKeys, ['it-support', 'knowledge-faq']);
  assert.deepEqual(agent.toolKeys, ['query_knowledge', 'create_ticket', 'push_webhook', 'handoff']);
  assert.deepEqual(agent.defaultToolPlan, ['query_knowledge', 'create_ticket', 'push_webhook']);
});
