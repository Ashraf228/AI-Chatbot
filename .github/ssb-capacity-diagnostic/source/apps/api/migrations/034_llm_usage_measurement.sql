-- Additive accounting metadata. Existing records are not retroactively confirmed.
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS usage_status TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS provider_key TEXT,
  ADD COLUMN IF NOT EXISTS call_outcome TEXT;
ALTER TABLE usage_events
  ALTER COLUMN input_tokens DROP NOT NULL,
  ALTER COLUMN output_tokens DROP NOT NULL,
  ALTER COLUMN total_tokens DROP NOT NULL,
  ALTER COLUMN estimated_cost DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'usage_events'::regclass AND conname = 'usage_events_llm_measurement_check') THEN
    ALTER TABLE usage_events ADD CONSTRAINT usage_events_llm_measurement_check CHECK (
      (usage_status = 'legacy' AND provider_key IS NULL AND call_outcome IS NULL)
      OR (
        usage_status IN ('confirmed', 'missing', 'incomplete')
        AND provider_key IS NOT NULL AND provider_key = 'openai'
        AND call_outcome IS NOT NULL AND call_outcome IN ('success', 'error', 'aborted')
        AND (input_tokens IS NULL OR input_tokens >= 0)
        AND (output_tokens IS NULL OR output_tokens >= 0)
        AND (total_tokens IS NULL OR total_tokens >= 0)
        AND (usage_status <> 'confirmed' OR (
          input_tokens IS NOT NULL AND output_tokens IS NOT NULL AND total_tokens IS NOT NULL
          AND input_tokens::bigint + output_tokens::bigint = total_tokens::bigint
        ))
        AND (usage_status <> 'missing' OR (input_tokens IS NULL AND output_tokens IS NULL AND total_tokens IS NULL))
        AND (usage_status = 'confirmed' OR estimated_cost IS NULL)
      )
    );
  END IF;
END $$;
