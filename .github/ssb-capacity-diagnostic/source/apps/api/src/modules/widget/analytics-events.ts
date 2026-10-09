import { BadRequestException } from '@nestjs/common';

export const WIDGET_ANALYTICS_EVENT_TYPES = [
  'impression',
  'open',
  'close',
  'chat_started',
  'message_sent',
  'message_received',
  'fallback',
  'lead_modal_opened',
  'lead_submitted',
  'consent_accepted',
] as const;

export type WidgetAnalyticsEventType = typeof WIDGET_ANALYTICS_EVENT_TYPES[number];

export const WIDGET_ANALYTICS_LEGACY_EVENT_ALIASES = {
  widget_loaded: 'impression',
  widget_impression: 'impression',
  widget_opened: 'open',
  widget_closed: 'close',
  fallback_answer: 'fallback',
} as const satisfies Record<string, WidgetAnalyticsEventType>;

export type WidgetAnalyticsAcceptedEventType =
  | WidgetAnalyticsEventType
  | keyof typeof WIDGET_ANALYTICS_LEGACY_EVENT_ALIASES;

export const WIDGET_ANALYTICS_ACCEPTED_EVENT_TYPES = [
  ...WIDGET_ANALYTICS_EVENT_TYPES,
  ...Object.keys(WIDGET_ANALYTICS_LEGACY_EVENT_ALIASES),
] as WidgetAnalyticsAcceptedEventType[];

const canonicalEvents = new Set<string>(WIDGET_ANALYTICS_EVENT_TYPES);

export function normalizeWidgetAnalyticsEventType(value: string): WidgetAnalyticsEventType {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (canonicalEvents.has(trimmed)) {
    return trimmed as WidgetAnalyticsEventType;
  }

  const alias = WIDGET_ANALYTICS_LEGACY_EVENT_ALIASES[
    trimmed as keyof typeof WIDGET_ANALYTICS_LEGACY_EVENT_ALIASES
  ];
  if (alias) {
    return alias;
  }

  throw new BadRequestException('Unknown widget analytics event type');
}
