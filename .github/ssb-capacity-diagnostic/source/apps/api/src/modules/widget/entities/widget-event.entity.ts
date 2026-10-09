export class WidgetEventEntity {
  id!: string;
  siteId!: string;
  sessionId!: string;
  eventType!: string;
  pageUrl!: string;
  metadata!: Record<string, unknown>;
  createdAt!: string;
}
