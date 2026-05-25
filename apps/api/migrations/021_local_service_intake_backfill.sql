WITH local_service_intake AS (
  SELECT
    jsonb_build_object(
      'templateKey', 'local-services',
      'subIndustry', 'drain_cleaning',
      'requiredFields', jsonb_build_array('problem', 'location', 'urgency', 'phone', 'name'),
      'questionOrder', jsonb_build_array('problem', 'location', 'urgency', 'phone', 'name'),
      'genericLocalServiceKeywords', jsonb_build_array(
        'notdienst',
        'einsatz',
        'einsatzort',
        'rückruf',
        'rueckruf',
        'kosten',
        'preis',
        'dringend',
        'heute',
        'morgen',
        'termin'
      ),
      'preferredVocabulary', jsonb_build_array(
        'Einsatz',
        'Problem',
        'Einsatzort',
        'Dringlichkeit',
        'Rückruf',
        'Notdienst'
      ),
      'forbiddenGenericTerms', jsonb_build_array(
        'Projekt',
        'Support-Anfrage',
        'Business-Prozess',
        'Automatisierung',
        'Beratungsgespräch'
      ),
      'problemKeywords', jsonb_build_array(
        'toilette',
        'wc',
        'abfluss',
        'rohrreinigung',
        'kanalreinigung',
        'rohr',
        'rückstau',
        'rueckstau',
        'keller',
        'kanal',
        'rohrbruch',
        'verstopft',
        'wasser läuft nicht ab',
        'wasser laeuft nicht ab',
        'überflutet',
        'ueberflutet'
      ),
      'pricingKeywords', jsonb_build_array(
        'laufende meter',
        'laufenden metern',
        'meter',
        'abrechnung',
        'abrechnen',
        'kosten',
        'preis',
        'rohrreinigung kostet'
      ),
      'callbackKeywords', jsonb_build_array(
        'rückruf',
        'rueckruf',
        'zurückrufen',
        'zurueckrufen',
        'anrufen',
        'kontaktiert werden'
      ),
      'questionTexts', jsonb_build_object(
        'problem', 'Was genau ist betroffen - Toilette, Abfluss, Keller oder Kanal?',
        'location', 'In welchem Ort oder welcher PLZ befindet sich der Einsatzort?',
        'urgency', 'Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?',
        'phone', 'Unter welcher Telefonnummer kann der Notdienst Sie zurückrufen?',
        'name', 'Auf welchen Namen dürfen wir die Anfrage aufnehmen?',
        'callback', 'Gerne. Geht es um einen akuten Notfall oder um eine allgemeine Anfrage?'
      ),
      'pricingAnswerTemplate',
      'Die Kosten hängen vom Aufwand, der Verstopfung und den benötigten laufenden Metern ab. Eine genaue Einschätzung ist nach kurzer Problembeschreibung möglich.'
    ) AS flow,
    jsonb_build_object(
      '/',
      jsonb_build_array(
        'Was ist gerade betroffen?',
        'Was kostet der Einsatz?',
        'Ich brauche einen Rückruf'
      )
    ) AS suggested_questions
),
local_service_sites AS (
  SELECT s.id
  FROM sites s
  WHERE COALESCE(s.config->>'industry', s.config->>'industryTemplate', '') IN (
    'local-services',
    'local_service',
    'local-service',
    'local_services'
  )
)
UPDATE sites s
SET config = jsonb_set(
  jsonb_set(
    COALESCE(s.config, '{}'::jsonb),
    '{conversationFlow}',
    CASE
      WHEN s.config->'conversationFlow' IS NULL OR s.config->'conversationFlow' = '{}'::jsonb
        THEN local_service_intake.flow
      ELSE s.config->'conversationFlow'
    END,
    true
  ),
  '{suggestedQuestionsByPath}',
  CASE
    WHEN s.config->'suggestedQuestionsByPath' IS NULL
      OR s.config->'suggestedQuestionsByPath' = '{}'::jsonb
      OR (s.config->'suggestedQuestionsByPath')::text ~* '(projekt|support|business|automatisierung|beratungsgespräch)'
      THEN local_service_intake.suggested_questions
    ELSE s.config->'suggestedQuestionsByPath'
  END,
  true
)
FROM local_service_intake
WHERE s.id IN (SELECT id FROM local_service_sites);

WITH local_service_intake AS (
  SELECT jsonb_build_object(
    'templateKey', 'local-services',
    'subIndustry', 'drain_cleaning',
    'requiredFields', jsonb_build_array('problem', 'location', 'urgency', 'phone', 'name'),
    'questionOrder', jsonb_build_array('problem', 'location', 'urgency', 'phone', 'name'),
    'genericLocalServiceKeywords', jsonb_build_array(
      'notdienst',
      'einsatz',
      'einsatzort',
      'rückruf',
      'rueckruf',
      'kosten',
      'preis',
      'dringend',
      'heute',
      'morgen',
      'termin'
    ),
    'preferredVocabulary', jsonb_build_array(
      'Einsatz',
      'Problem',
      'Einsatzort',
      'Dringlichkeit',
      'Rückruf',
      'Notdienst'
    ),
    'forbiddenGenericTerms', jsonb_build_array(
      'Projekt',
      'Support-Anfrage',
      'Business-Prozess',
      'Automatisierung',
      'Beratungsgespräch'
    ),
    'problemKeywords', jsonb_build_array(
      'toilette',
      'wc',
      'abfluss',
      'rohrreinigung',
      'kanalreinigung',
      'rohr',
      'rückstau',
      'rueckstau',
      'keller',
      'kanal',
      'rohrbruch',
      'verstopft',
      'wasser läuft nicht ab',
      'wasser laeuft nicht ab',
      'überflutet',
      'ueberflutet'
    ),
    'pricingKeywords', jsonb_build_array(
      'laufende meter',
      'laufenden metern',
      'meter',
      'abrechnung',
      'abrechnen',
      'kosten',
      'preis',
      'rohrreinigung kostet'
    ),
    'callbackKeywords', jsonb_build_array(
      'rückruf',
      'rueckruf',
      'zurückrufen',
      'zurueckrufen',
      'anrufen',
      'kontaktiert werden'
    ),
    'questionTexts', jsonb_build_object(
      'problem', 'Was genau ist betroffen - Toilette, Abfluss, Keller oder Kanal?',
      'location', 'In welchem Ort oder welcher PLZ befindet sich der Einsatzort?',
      'urgency', 'Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?',
      'phone', 'Unter welcher Telefonnummer kann der Notdienst Sie zurückrufen?',
      'name', 'Auf welchen Namen dürfen wir die Anfrage aufnehmen?',
      'callback', 'Gerne. Geht es um einen akuten Notfall oder um eine allgemeine Anfrage?'
    ),
    'pricingAnswerTemplate',
    'Die Kosten hängen vom Aufwand, der Verstopfung und den benötigten laufenden Metern ab. Eine genaue Einschätzung ist nach kurzer Problembeschreibung möglich.'
  ) AS flow
),
local_service_sites AS (
  SELECT s.id
  FROM sites s
  WHERE COALESCE(s.config->>'industry', s.config->>'industryTemplate', '') IN (
    'local-services',
    'local_service',
    'local-service',
    'local_services'
  )
)
INSERT INTO site_modules(site_id, module_key, is_enabled, config, created_at, updated_at)
SELECT
  s.id,
  'lead-sales',
  true,
  jsonb_build_object(
    'primaryGoal', 'lead_capture',
    'ctaLabel', 'Rückruf anfragen',
    'ctaDescription', 'Wir nehmen den Einsatz kurz auf.',
    'qualificationFocus', 'Kläre Problem, Einsatzort und Dringlichkeit in einer Frage nach der anderen.',
    'handoffInstruction', 'Frage erst nach Problem, Einsatzort und Dringlichkeit, danach nach Telefonnummer und Name.',
    'intakeFlow', local_service_intake.flow
  ),
  now(),
  now()
FROM local_service_sites s
CROSS JOIN local_service_intake
ON CONFLICT (site_id, module_key) DO UPDATE SET
  config = CASE
    WHEN site_modules.config->'intakeFlow' IS NULL OR site_modules.config->'intakeFlow' = '{}'::jsonb
      THEN site_modules.config || jsonb_build_object('intakeFlow', EXCLUDED.config->'intakeFlow')
    ELSE site_modules.config
  END,
  updated_at = now();
