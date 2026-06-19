-- Normalize documented widget analytics legacy event names to the canonical
-- event contract. Unknown historical values are intentionally left unchanged
-- so they remain auditable instead of being silently reclassified.

UPDATE widget_events
SET event_type = CASE event_type
  WHEN 'widget_loaded' THEN 'impression'
  WHEN 'widget_impression' THEN 'impression'
  WHEN 'widget_opened' THEN 'open'
  WHEN 'widget_closed' THEN 'close'
  WHEN 'fallback_answer' THEN 'fallback'
  ELSE event_type
END
WHERE event_type IN (
  'widget_loaded',
  'widget_impression',
  'widget_opened',
  'widget_closed',
  'fallback_answer'
);
