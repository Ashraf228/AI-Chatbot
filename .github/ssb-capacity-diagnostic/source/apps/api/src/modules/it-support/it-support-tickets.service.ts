import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { deepRedactSensitiveValues, redactSensitiveText } from './it-support-flow';

type TicketRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  title: string | null;
  description: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  location: string | null;
  priority: string | null;
  status: string | null;
  category: string | null;
  issue_type: string | null;
  affected_system: string | null;
  impact: string | null;
  urgency: string | null;
  affected_users: string | null;
  device: string | null;
  operating_system: string | null;
  error_message: string | null;
  already_tried: string | null;
  department: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
};

type CountRow = {
  total: string | number;
};

export type ItSupportTicketForwardingStatus = 'queued' | 'not_configured' | 'failed' | 'unknown';

export type ItSupportTicketListInput = {
  tenantId?: string | null;
  siteId: string;
  limit?: string | number;
  offset?: string | number;
  search?: string;
  priority?: string;
  issueType?: string;
  status?: string;
  forwardingStatus?: string;
  from?: string;
  to?: string;
};

export type ItSupportTicketDetailInput = {
  tenantId?: string | null;
  siteId: string;
  ticketId: string;
};

function toInt(value: string | number | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLimit(value: string | number | undefined) {
  return Math.max(1, Math.min(100, toInt(value, 25)));
}

function normalizeOffset(value: string | number | undefined) {
  return Math.max(0, toInt(value, 0));
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDateParam(value: string | undefined, label: string) {
  const trimmed = cleanString(value);
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} must be a valid date`);
  }
  return date.toISOString();
}

function normalizeForwardingStatus(value: unknown): ItSupportTicketForwardingStatus {
  const normalized = cleanString(value).toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'not_configured' || normalized === 'disabled') return 'not_configured';
  if (normalized === 'failed') return 'failed';
  return 'unknown';
}

function redactText(value: string | null | undefined) {
  const text = cleanString(value);
  return text ? redactSensitiveText(text) : null;
}

function redactMetadata(value: Record<string, unknown> | null | undefined) {
  const redacted = deepRedactSensitiveValues(value || {});
  return redacted && typeof redacted === 'object' && !Array.isArray(redacted)
    ? redacted as Record<string, unknown>
    : {};
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

@Injectable()
export class ItSupportTicketsService {
  constructor(private readonly db: PrismaService) {}

  async listItSupportTickets(input: ItSupportTicketListInput) {
    const limit = normalizeLimit(input.limit);
    const offset = normalizeOffset(input.offset);
    const { where, params } = this.buildWhere(input);

    const [countResult, rowsResult] = await Promise.all([
      this.db.query<CountRow>(
        `SELECT COUNT(*)::int AS total
         FROM agent_tickets
         ${where}`,
        params,
      ),
      this.db.query<TicketRow>(
        `SELECT
           id, tenant_id, site_id, title, description, reporter_name, reporter_email,
           reporter_phone, location, priority, status, category, issue_type,
           affected_system, impact, urgency, affected_users, device, operating_system,
           error_message, already_tried, department, source, metadata, created_at
         FROM agent_tickets
         ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    const items = rowsResult.rows.map((row) => this.mapListRow(row));
    return {
      items,
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset,
    };
  }

  async getItSupportTicket(input: ItSupportTicketDetailInput) {
    const { where, params } = this.buildWhere(input, input.ticketId);
    const result = await this.db.query<TicketRow>(
      `SELECT
         id, tenant_id, site_id, title, description, reporter_name, reporter_email,
         reporter_phone, location, priority, status, category, issue_type,
         affected_system, impact, urgency, affected_users, device, operating_system,
         error_message, already_tried, department, source, metadata, created_at
       FROM agent_tickets
       ${where}
       LIMIT 1`,
      params,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('IT support ticket not found');
    }
    return this.mapDetailRow(row);
  }

  private buildWhere(input: ItSupportTicketListInput, ticketId?: string) {
    const clauses = [
      'site_id = $1',
      `(category = 'it_support'
        OR metadata->>'sourceAgent' = 'it-support-agent'
        OR (source = 'chat' AND COALESCE(issue_type, '') <> ''))`,
    ];
    const params: unknown[] = [input.siteId];

    if (cleanString(input.tenantId)) {
      params.push(cleanString(input.tenantId));
      clauses.push(`(tenant_id = $${params.length} OR tenant_id IS NULL)`);
    }

    if (ticketId) {
      params.push(ticketId);
      clauses.push(`id = $${params.length}`);
    }

    const search = cleanString(input.search);
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      clauses.push(`(
        LOWER(COALESCE(title, '')) LIKE $${params.length}
        OR LOWER(COALESCE(description, '')) LIKE $${params.length}
        OR LOWER(COALESCE(affected_system, '')) LIKE $${params.length}
        OR LOWER(COALESCE(reporter_email, '')) LIKE $${params.length}
        OR LOWER(COALESCE(reporter_name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(issue_type, '')) LIKE $${params.length}
      )`);
    }

    const priority = cleanString(input.priority);
    if (priority) {
      params.push(priority);
      clauses.push(`priority = $${params.length}`);
    }

    const issueType = cleanString(input.issueType);
    if (issueType) {
      params.push(issueType);
      clauses.push(`issue_type = $${params.length}`);
    }

    const status = cleanString(input.status);
    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }

    const forwardingStatus = normalizeForwardingStatus(input.forwardingStatus);
    if (cleanString(input.forwardingStatus) && forwardingStatus !== 'unknown') {
      params.push(forwardingStatus);
      clauses.push(`COALESCE(NULLIF(metadata->>'forwardingStatus', ''), 'unknown') = $${params.length}`);
    } else if (cleanString(input.forwardingStatus) === 'unknown') {
      clauses.push(`COALESCE(NULLIF(metadata->>'forwardingStatus', ''), 'unknown') = 'unknown'`);
    }

    const from = normalizeDateParam(input.from, 'from');
    if (from) {
      params.push(from);
      clauses.push(`created_at >= $${params.length}::timestamptz`);
    }

    const to = normalizeDateParam(input.to, 'to');
    if (to) {
      params.push(to);
      clauses.push(`created_at <= $${params.length}::timestamptz`);
    }

    return {
      where: `WHERE ${clauses.join('\n         AND ')}`,
      params,
    };
  }

  private mapListRow(row: TicketRow) {
    const metadata = redactMetadata(row.metadata);
    return {
      id: row.id,
      subject: redactText(row.title) || 'IT-Support-Ticket',
      status: row.status || undefined,
      priority: row.priority || undefined,
      issueType: row.issue_type || undefined,
      affectedSystem: redactText(row.affected_system) || undefined,
      impact: row.impact || undefined,
      urgency: row.urgency || undefined,
      reporterEmail: redactText(row.reporter_email) || undefined,
      reporterName: redactText(row.reporter_name) || undefined,
      reporterPhone: redactText(row.reporter_phone) || undefined,
      device: redactText(row.device) || undefined,
      operatingSystem: redactText(row.operating_system) || undefined,
      forwardingStatus: normalizeForwardingStatus(metadata.forwardingStatus),
      conversationId: metadataString(metadata, 'conversationId') || undefined,
      createdAt: toIso(row.created_at),
      updatedAt: undefined,
    };
  }

  private mapDetailRow(row: TicketRow) {
    const metadata = redactMetadata(row.metadata);
    return {
      id: row.id,
      subject: redactText(row.title) || 'IT-Support-Ticket',
      description: redactText(row.description),
      status: row.status || undefined,
      category: row.category || undefined,
      priority: row.priority || undefined,
      urgency: row.urgency || undefined,
      impact: row.impact || undefined,
      issueType: row.issue_type || undefined,
      affectedSystem: redactText(row.affected_system) || undefined,
      affectedUsers: redactText(row.affected_users) || undefined,
      reporter: {
        name: redactText(row.reporter_name),
        email: redactText(row.reporter_email),
        phone: redactText(row.reporter_phone),
        department: redactText(row.department),
        location: redactText(row.location),
      },
      technicalContext: {
        device: redactText(row.device),
        operatingSystem: redactText(row.operating_system),
        errorMessage: redactText(row.error_message),
        alreadyTried: redactText(row.already_tried),
      },
      source: row.source || undefined,
      forwardingStatus: normalizeForwardingStatus(metadata.forwardingStatus),
      conversationId: metadataString(metadata, 'conversationId') || undefined,
      metadata,
      createdAt: toIso(row.created_at),
      updatedAt: undefined,
    };
  }
}
