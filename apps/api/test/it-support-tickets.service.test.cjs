const test = require('node:test');
const assert = require('node:assert/strict');
const { ItSupportTicketsService } = require('../dist/modules/it-support/it-support-tickets.service.js');

function ticket(overrides = {}) {
  return {
    id: 'ticket-1',
    tenant_id: 'tenant-1',
    site_id: 'site-1',
    title: 'VPN funktioniert nicht',
    description: 'VPN bricht ab.',
    reporter_name: 'Max Mustermann',
    reporter_email: 'max@example.com',
    reporter_phone: '+4917600000000',
    location: 'Berlin',
    priority: 'high',
    status: 'new',
    category: 'it_support',
    issue_type: 'vpn',
    affected_system: 'VPN',
    impact: 'single_user',
    urgency: 'high',
    affected_users: 'ein Nutzer',
    device: 'Laptop',
    operating_system: 'Windows',
    error_message: 'Fehler 691',
    already_tried: 'Neustart',
    department: 'Sales',
    source: 'chat',
    metadata: { sourceAgent: 'it-support-agent', forwardingStatus: 'queued', conversationId: 'conv-1' },
    created_at: new Date('2026-06-10T12:00:00.000Z'),
    ...overrides,
  };
}

function placeholderValue(sql, params, pattern) {
  const match = sql.match(pattern);
  if (!match) return undefined;
  const index = Number(match[1]) - 1;
  return params[index];
}

function createHarness(rows) {
  const queries = [];
  const db = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      let filtered = rows.filter((row) => row.site_id === params[0]);

      if (/category = 'it_support'/i.test(sql)) {
        filtered = filtered.filter((row) =>
          row.category === 'it_support' ||
          row.metadata?.sourceAgent === 'it-support-agent' ||
          (row.source === 'chat' && Boolean(row.issue_type)),
        );
      }

      const tenantId = placeholderValue(sql, params, /tenant_id = \$(\d+)/i);
      if (tenantId) {
        filtered = filtered.filter((row) => row.tenant_id === tenantId || row.tenant_id === null);
      }

      const id = placeholderValue(sql, params, /\bid = \$(\d+)/i);
      if (id) {
        filtered = filtered.filter((row) => row.id === id);
      }

      const priority = placeholderValue(sql, params, /priority = \$(\d+)/i);
      if (priority) {
        filtered = filtered.filter((row) => row.priority === priority);
      }

      const issueType = placeholderValue(sql, params, /issue_type = \$(\d+)/i);
      if (issueType) {
        filtered = filtered.filter((row) => row.issue_type === issueType);
      }

      const status = placeholderValue(sql, params, /status = \$(\d+)/i);
      if (status) {
        filtered = filtered.filter((row) => row.status === status);
      }

      const forwarding = placeholderValue(sql, params, /metadata->>'forwardingStatus'[\s\S]*= \$(\d+)/i);
      if (forwarding) {
        filtered = filtered.filter((row) => (row.metadata?.forwardingStatus || 'unknown') === forwarding);
      } else if (/metadata->>'forwardingStatus'[\s\S]*= 'unknown'/i.test(sql)) {
        filtered = filtered.filter((row) => !row.metadata?.forwardingStatus);
      }

      const search = placeholderValue(sql, params, /LIKE \$(\d+)/i);
      if (search) {
        const needle = String(search).replaceAll('%', '').toLowerCase();
        filtered = filtered.filter((row) =>
          [
            row.title,
            row.description,
            row.affected_system,
            row.reporter_email,
            row.reporter_name,
            row.issue_type,
          ].some((value) => String(value || '').toLowerCase().includes(needle)),
        );
      }

      if (/COUNT\(\*\)/i.test(sql)) {
        return { rows: [{ total: filtered.length }] };
      }

      if (/ORDER BY/i.test(sql)) {
        const limit = Number(params[params.length - 2] || 25);
        const offset = Number(params[params.length - 1] || 0);
        return { rows: filtered.slice(offset, offset + limit) };
      }

      return { rows: filtered.slice(0, 1) };
    },
  };
  return {
    service: new ItSupportTicketsService(db),
    queries,
  };
}

test('ItSupportTicketsService lists only IT tickets for the requested site', async () => {
  const { service, queries } = createHarness([
    ticket({ id: 'site-a-it' }),
    ticket({ id: 'site-b-it', site_id: 'site-2' }),
    ticket({ id: 'property-ticket', category: 'property', issue_type: null, metadata: {}, title: 'Mieterticket' }),
    ticket({ id: 'legacy-it', category: 'support', issue_type: 'mfa', metadata: {}, title: 'MFA gesperrt' }),
  ]);

  const result = await service.listItSupportTickets({ tenantId: 'tenant-1', siteId: 'site-1' });

  assert.deepEqual(result.items.map((item) => item.id), ['site-a-it', 'legacy-it']);
  assert.equal(result.total, 2);
  assert.ok(queries.some((entry) => /site_id = \$1/i.test(entry.sql)));
});

test('ItSupportTicketsService loads details only in the requested site scope', async () => {
  const { service } = createHarness([
    ticket({ id: 'own-ticket' }),
    ticket({ id: 'other-ticket', site_id: 'site-2' }),
  ]);

  const detail = await service.getItSupportTicket({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    ticketId: 'own-ticket',
  });

  assert.equal(detail.id, 'own-ticket');
  await assert.rejects(
    () => service.getItSupportTicket({ tenantId: 'tenant-1', siteId: 'site-1', ticketId: 'other-ticket' }),
    /IT support ticket not found|Not Found/i,
  );
});

test('ItSupportTicketsService applies priority, issue type, forwarding and search filters', async () => {
  const { service } = createHarness([
    ticket({ id: 'vpn-queued', priority: 'critical', issue_type: 'vpn', metadata: { forwardingStatus: 'queued' } }),
    ticket({ id: 'printer-failed', priority: 'normal', issue_type: 'printer', affected_system: 'Drucker', metadata: { forwardingStatus: 'failed' } }),
  ]);

  const result = await service.listItSupportTickets({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    priority: 'critical',
    issueType: 'vpn',
    forwardingStatus: 'queued',
    search: 'vpn',
  });

  assert.deepEqual(result.items.map((item) => item.id), ['vpn-queued']);
});

test('ItSupportTicketsService redacts sensitive data in details and metadata', async () => {
  const { service } = createHarness([
    ticket({
      id: 'secret-ticket',
      description: 'Passwort ist Test123 und VPN geht nicht.',
      error_message: 'MFA Code ist 123456',
      metadata: {
        sourceAgent: 'it-support-agent',
        forwardingStatus: 'queued',
        access_token: 'secret-token-value',
        nested: { apiKey: 'secret-value' },
      },
    }),
  ]);

  const detail = await service.getItSupportTicket({
    tenantId: 'tenant-1',
    siteId: 'site-1',
    ticketId: 'secret-ticket',
  });
  const serialized = JSON.stringify(detail);

  assert.match(detail.description, /Passwort \[redacted\]/);
  assert.match(detail.technicalContext.errorMessage, /MFA \[redacted\]/i);
  assert.doesNotMatch(serialized, /Test123|123456|secret-token-value|secret-value/);
  assert.equal(detail.metadata.access_token, '[redacted]');
  assert.equal(detail.metadata.nested.apiKey, '[redacted]');
});

test('ItSupportTicketsService maps missing forwardingStatus to unknown', async () => {
  const { service } = createHarness([
    ticket({ id: 'queued-ticket', metadata: { forwardingStatus: 'queued' } }),
    ticket({ id: 'old-ticket', metadata: {} }),
  ]);

  const result = await service.listItSupportTickets({ tenantId: 'tenant-1', siteId: 'site-1' });

  assert.equal(result.items.find((item) => item.id === 'queued-ticket').forwardingStatus, 'queued');
  assert.equal(result.items.find((item) => item.id === 'old-ticket').forwardingStatus, 'unknown');
});
