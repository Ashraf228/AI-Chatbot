export class WidgetSessionEntity {
  id!: string;
  siteId!: string;
  visitorId!: string;
  startedAt!: string;
  lastSeenAt!: string;
  sourceUrl?: string;
  userAgent?: string;
  leadCaptured!: boolean;
}
