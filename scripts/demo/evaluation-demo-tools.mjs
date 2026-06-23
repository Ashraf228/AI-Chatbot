import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import process from 'node:process';
import { DEMO_ARTICLES, DEMO_PROFILE_KEY, DEMO_SCENARIOS, DEMO_SEED_VERSION, renderDemoArticle } from './evaluation-demo-content.mjs';

const MAX_DEFAULT_EXPIRES_DAYS = 30;
const PASSWORD_HASH_PREFIX = 'scrypt';

export function maskEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}***@${domain}`;
}

function normalizeSlug(value, label) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function requireEnv(env, key) {
  const value = String(env[key] || '').trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function validateHttpUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not contain credentials`);
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

function validateOrigin(value) {
  const url = new URL(validateHttpUrl(value, 'DEMO_ALLOWED_ORIGIN'));
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('DEMO_ALLOWED_ORIGIN must be an origin without path, query or fragment');
  }
  return url.origin;
}

function validateFutureExpiry(value, allowLongExpiry = false) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('DEMO_VIEWER_EXPIRES_AT must be an ISO timestamp');
  const now = Date.now();
  if (timestamp <= now) throw new Error('DEMO_VIEWER_EXPIRES_AT must be in the future');
  const max = now + MAX_DEFAULT_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
  if (!allowLongExpiry && timestamp > max) {
    throw new Error('DEMO_VIEWER_EXPIRES_AT must be at most 30 days in the future unless --allow-long-expiry is set');
  }
  return new Date(timestamp).toISOString();
}

function validatePassword(value) {
  const password = String(value || '');
  if (!password) throw new Error('DEMO_VIEWER_PASSWORD is required');
  if (password.length < 12) throw new Error('DEMO_VIEWER_PASSWORD must be at least 12 characters');
  return password;
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${PASSWORD_HASH_PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    execute: argv.includes('--execute'),
    rotateViewerPassword: argv.includes('--rotate-viewer-password'),
    allowLongExpiry: argv.includes('--allow-long-expiry'),
    confirm: argv.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length) || '',
  };
}

export function loadConfig(env = process.env, options = {}) {
  const viewerEmail = requireEnv(env, 'DEMO_VIEWER_EMAIL').toLowerCase();
  const config = {
    partnerDisplayName: requireEnv(env, 'DEMO_PARTNER_DISPLAY_NAME'),
    workspaceTitle: requireEnv(env, 'DEMO_WORKSPACE_TITLE'),
    tenantSlug: normalizeSlug(requireEnv(env, 'DEMO_TENANT_SLUG'), 'DEMO_TENANT_SLUG'),
    tenantDisplayName: requireEnv(env, 'DEMO_TENANT_DISPLAY_NAME'),
    siteSlug: normalizeSlug(requireEnv(env, 'DEMO_SITE_SLUG'), 'DEMO_SITE_SLUG'),
    siteDisplayName: requireEnv(env, 'DEMO_SITE_DISPLAY_NAME'),
    viewerEmail,
    viewerDisplayName: requireEnv(env, 'DEMO_VIEWER_DISPLAY_NAME'),
    viewerPassword: options.requirePassword === false ? '' : validatePassword(env.DEMO_VIEWER_PASSWORD),
    viewerExpiresAt: validateFutureExpiry(requireEnv(env, 'DEMO_VIEWER_EXPIRES_AT'), options.allowLongExpiry),
    allowedOrigin: validateOrigin(requireEnv(env, 'DEMO_ALLOWED_ORIGIN')),
    privacyUrl: validateHttpUrl(requireEnv(env, 'DEMO_PRIVACY_URL'), 'DEMO_PRIVACY_URL'),
    supportContactLabel: String(env.DEMO_SUPPORT_CONTACT_LABEL || '').trim() || 'Demo-Support',
    profileKey: DEMO_PROFILE_KEY,
    seedVersion: DEMO_SEED_VERSION,
  };
  return config;
}

function sourceIdFor(siteId, demoSeedKey) {
  return `demo_source_${siteId}_${demoSeedKey}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function buildSiteConfig(config) {
  return {
    isActive: true,
    domain: config.allowedOrigin,
    websiteUrl: config.allowedOrigin,
    privacyUrl: config.privacyUrl,
    consentRequired: true,
    leadCaptureEnabled: false,
    industry: config.profileKey,
    setupGoal: 'support',
    primaryGoal: 'support',
    botType: 'product-support-demo',
    knowledgeMode: 'strict',
    fallbackBehavior: 'grounded_only',
    tone: 'professional',
    ctaText: 'Demo testen',
    launcherLabel: 'Demo testen',
    welcomeMessage: 'Guten Tag. Welche Frage zum Demonstrator darf ich beantworten?',
    systemPrompt:
      'Sie sind ein Produktsupport-Assistent fuer einen synthetischen Kooperationsdemonstrator. Antworten Sie nur auf Grundlage freigegebener Demonstrationsinhalte. Treffen Sie keine Verwaltungsentscheidung, geben Sie keine Rechtsauskunft und behaupten Sie keine Produktivintegration. Wenn keine belastbare Quelle vorliegt, sagen Sie: Diese Frage kann ich auf Grundlage der freigegebenen Demonstrationsinhalte nicht zuverlaessig beantworten.',
    templateId: config.profileKey,
    templateVersion: 1,
    templateAppliedAt: new Date().toISOString(),
    templateAppliedBy: 'demo-provisioning',
    suggestedQuestionsByPath: {
      '/evaluation': DEMO_SCENARIOS.map((scenario) => scenario.prompt),
    },
    topTestQuestions: DEMO_SCENARIOS.map((scenario) => scenario.prompt),
    reportKpis: ['evaluationQuestions', 'sourcedAnswers', 'knowledgeGaps'],
    evaluationWorkspace: {
      partnerDisplayName: config.partnerDisplayName,
      workspaceTitle: config.workspaceTitle,
      supportContactLabel: config.supportContactLabel,
      disclaimer:
        'Kooperationsdemonstrator mit synthetischen Inhalten. Keine Verbindung zu Produktivsystemen oder externen Fachverfahren.',
      scenarios: DEMO_SCENARIOS,
      technicalFeatures: [
        'Mandanten- und Site-Trennung',
        'Quellenbasierte Antworten',
        'Kontrollierte Nicht-Antwort',
        'Strukturierte Uebergabe als Vorschau',
        'Zeitlich begrenzter Evaluationszugang',
        'Keine Verwaltungsentscheidung durch die KI',
      ],
    },
    demoProfile: config.profileKey,
    demoSeedVersion: config.seedVersion,
  };
}

export function summarizePlan(config) {
  return {
    tenantSlug: config.tenantSlug,
    tenantDisplayName: config.tenantDisplayName,
    siteSlug: config.siteSlug,
    siteDisplayName: config.siteDisplayName,
    partnerDisplayName: config.partnerDisplayName,
    workspaceTitle: config.workspaceTitle,
    viewerEmail: maskEmail(config.viewerEmail),
    viewerExpiresAt: config.viewerExpiresAt,
    allowedOrigin: config.allowedOrigin,
    privacyUrl: config.privacyUrl,
    demoProfile: config.profileKey,
    articles: DEMO_ARTICLES.length,
    scenarios: DEMO_SCENARIOS.length,
  };
}

export async function provisionEvaluationDemo(db, config, options = {}) {
  const dryRun = options.execute !== true;
  const actions = [];
  const counts = { tenants: 0, sites: 0, viewers: 0, sources: 0, documents: 0, chunks: 0, scenarios: DEMO_SCENARIOS.length };
  const ingestDemoArticle = options.ingestDemoArticle;

  const tenant = await db.query('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [config.tenantSlug]);
  const site = await db.query('SELECT id, tenant_id, is_evaluation_demo FROM sites WHERE id = $1 OR site_key = $1 LIMIT 1', [config.siteSlug]);
  const viewer = await db.query('SELECT id, tenant_id, role, evaluation_site_id FROM tenant_users WHERE tenant_id = $1 AND lower(email) = $2 LIMIT 1', [config.tenantSlug, config.viewerEmail]);
  const foreignViewer = await db.query('SELECT id FROM tenant_users WHERE tenant_id <> $1 AND lower(email) = $2 LIMIT 1', [config.tenantSlug, config.viewerEmail]);
  if (foreignViewer.rows[0]) throw new Error('Viewer email already exists in another tenant');

  actions.push(tenant.rows[0] ? 'update tenant display name' : 'create tenant');
  actions.push(site.rows[0] ? 'update demo site config' : 'create demo site');
  actions.push(viewer.rows[0] ? 'validate/update viewer account' : 'create viewer account');
  actions.push(`upsert ${DEMO_ARTICLES.length} marked synthetic knowledge articles`);

  if (dryRun) return { dryRun: true, actions, counts, summary: summarizePlan(config) };
  if (typeof ingestDemoArticle !== 'function') {
    throw new Error('Execute provisioning requires an ingestion callback with embeddings');
  }

  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO tenants(id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [config.tenantSlug, config.tenantDisplayName],
    );

    const siteConfig = buildSiteConfig(config);
    await tx.query(
      `INSERT INTO sites(id, site_key, tenant_id, name, allowed_domains, config, is_evaluation_demo)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,true)
       ON CONFLICT (id) DO UPDATE SET
         site_key = EXCLUDED.site_key,
         tenant_id = EXCLUDED.tenant_id,
         name = EXCLUDED.name,
         allowed_domains = EXCLUDED.allowed_domains,
         config = (sites.config - 'siteKey') || EXCLUDED.config,
         is_evaluation_demo = true`,
      [config.siteSlug, config.siteSlug, config.tenantSlug, config.siteDisplayName, [config.allowedOrigin], JSON.stringify(siteConfig)],
    );

    const existingSite = await tx.query('SELECT id, tenant_id, is_evaluation_demo FROM sites WHERE id = $1 LIMIT 1', [config.siteSlug]);
    const siteRow = existingSite.rows[0];
    if (!siteRow || siteRow.tenant_id !== config.tenantSlug || siteRow.is_evaluation_demo !== true) {
      throw new Error('Demo site validation failed');
    }

    const metadata = viewer.rows[0] && !options.rotateViewerPassword
      ? undefined
      : { passwordHash: hashPassword(config.viewerPassword) };
    if (viewer.rows[0] && !options.rotateViewerPassword) {
      await tx.query(
        `UPDATE tenant_users
         SET display_name = $3,
             role = 'viewer',
             is_active = true,
             expires_at = $4::timestamptz,
             evaluation_site_id = $5,
             updated_at = now()
         WHERE tenant_id = $1 AND lower(email) = $2`,
        [config.tenantSlug, config.viewerEmail, config.viewerDisplayName, config.viewerExpiresAt, config.siteSlug],
      );
    } else {
      await tx.query(
        `INSERT INTO tenant_users(
           id, tenant_id, email, display_name, role, is_active, metadata, expires_at, evaluation_site_id, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,'viewer',true,$5::jsonb,$6::timestamptz,$7,now(),now())
         ON CONFLICT (tenant_id, email) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           role = 'viewer',
           is_active = true,
           metadata = EXCLUDED.metadata,
           expires_at = EXCLUDED.expires_at,
           evaluation_site_id = EXCLUDED.evaluation_site_id,
           updated_at = now()`,
        [randomUUID(), config.tenantSlug, config.viewerEmail, config.viewerDisplayName, JSON.stringify(metadata), config.viewerExpiresAt, config.siteSlug],
      );
    }

    for (const item of DEMO_ARTICLES) {
      const sourceId = sourceIdFor(config.siteSlug, item.demoSeedKey);
      const sourceConfig = {
        demo: true,
        synthetic: true,
        demoSeedKey: item.demoSeedKey,
        demoSeedVersion: config.seedVersion,
        demoProfile: config.profileKey,
        sourceType: 'demo',
        language: 'de',
        tags: item.tags,
        scenarioKeys: item.scenarioKeys,
        title: item.title,
        summary: item.summary,
      };
      await tx.query(
        `INSERT INTO knowledge_sources(
           id, tenant_id, site_id, source_type, label, description, sync_status, is_active, config, last_synced_at, created_at, updated_at
         ) VALUES ($1,$2,$3,'manual',$4,$5,'ready',true,$6::jsonb,now(),now(),now())
         ON CONFLICT (id) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           site_id = EXCLUDED.site_id,
           label = EXCLUDED.label,
           description = EXCLUDED.description,
           sync_status = 'ready',
           is_active = true,
           config = EXCLUDED.config,
           last_synced_at = now(),
           updated_at = now()`,
        [sourceId, config.tenantSlug, config.siteSlug, item.title, item.summary, JSON.stringify(sourceConfig)],
      );
    }
  });

  let insertedChunks = 0;
  for (const item of DEMO_ARTICLES) {
    const sourceId = sourceIdFor(config.siteSlug, item.demoSeedKey);
    const sourceConfig = {
      demo: true,
      synthetic: true,
      demoSeedKey: item.demoSeedKey,
      demoSeedVersion: config.seedVersion,
      demoProfile: config.profileKey,
      sourceType: 'demo',
      language: 'de',
      tags: item.tags,
      scenarioKeys: item.scenarioKeys,
      title: item.title,
      summary: item.summary,
      siteId: config.siteSlug,
      tenantId: config.tenantSlug,
      updatedAt: item.updatedAt,
      version: item.version,
    };
    const result = await ingestDemoArticle({
      tenantId: config.tenantSlug,
      siteId: config.siteSlug,
      sourceId,
      type: 'manual',
      title: item.title,
      text: renderDemoArticle(item),
      metadata: sourceConfig,
    });
    insertedChunks += Number(result?.chunks || result?.inserted || 0);
  }

  counts.tenants = tenant.rows[0] ? 0 : 1;
  counts.sites = site.rows[0] ? 0 : 1;
  counts.viewers = viewer.rows[0] ? 0 : 1;
  counts.sources = DEMO_ARTICLES.length;
  counts.documents = DEMO_ARTICLES.length;
  counts.chunks = insertedChunks;
  return { dryRun: false, actions, counts, summary: summarizePlan(config) };
}

export async function verifyEvaluationDemo(db, config) {
  const rows = await db.query(
    `SELECT
       (SELECT count(*)::int FROM tenants WHERE id = $1) AS tenant_count,
       (SELECT count(*)::int FROM sites WHERE id = $2 AND tenant_id = $1 AND is_evaluation_demo = true) AS demo_site_count,
       (SELECT count(*)::int FROM tenant_users WHERE tenant_id = $1 AND role = 'viewer' AND is_active = true AND evaluation_site_id = $2) AS viewer_count,
       (SELECT min(expires_at)::text FROM tenant_users WHERE tenant_id = $1 AND role = 'viewer' AND is_active = true AND evaluation_site_id = $2) AS earliest_expiry,
       (SELECT count(*)::int FROM knowledge_sources WHERE tenant_id = $1 AND site_id = $2 AND config->>'demo' = 'true' AND config->>'synthetic' = 'true') AS source_count,
       (SELECT count(*)::int FROM documents d JOIN knowledge_sources ks ON ks.id = d.source_id WHERE d.tenant_id = $1 AND d.site_id = $2 AND ks.config->>'demo' = 'true' AND ks.config->>'synthetic' = 'true') AS document_count,
       (SELECT count(*)::int FROM chunks WHERE tenant_id = $1 AND site_id = $2 AND metadata->>'demo' = 'true' AND metadata->>'synthetic' = 'true') AS chunk_count,
       (SELECT count(*)::int FROM chunks WHERE tenant_id = $1 AND site_id = $2 AND metadata->>'demo' = 'true' AND metadata->>'synthetic' = 'true' AND embedding IS NOT NULL) AS searchable_chunk_count,
       (SELECT count(*)::int FROM chunks WHERE tenant_id = $1 AND site_id = $2 AND COALESCE(metadata->>'demo','false') <> 'true') AS unmarked_chunks`,
    [config.tenantSlug, config.siteSlug],
  );
  const row = rows.rows[0] || {};
  return {
    tenantFound: Number(row.tenant_count || 0) === 1,
    demoSiteFound: Number(row.demo_site_count || 0) === 1,
    isEvaluationDemo: Number(row.demo_site_count || 0) === 1,
    activeViewerCount: Number(row.viewer_count || 0),
    earliestExpiresAt: row.earliest_expiry || null,
    evaluationAssignmentOk: Number(row.viewer_count || 0) > 0,
    syntheticSources: Number(row.source_count || 0),
    syntheticDocuments: Number(row.document_count || 0),
    chunks: Number(row.chunk_count || 0),
    searchableChunks: Number(row.searchable_chunk_count || 0),
    scenarios: DEMO_SCENARIOS.length,
    unmarkedActiveDocumentsInEvaluationRetrieval: Number(row.unmarked_chunks || 0),
    configurationComplete:
      Number(row.tenant_count || 0) === 1 &&
      Number(row.demo_site_count || 0) === 1 &&
      Number(row.viewer_count || 0) > 0 &&
      Number(row.source_count || 0) === DEMO_ARTICLES.length &&
      Number(row.searchable_chunk_count || 0) >= DEMO_ARTICLES.length,
  };
}

export async function resetEvaluationDemo(db, config, options = {}) {
  if (options.confirm !== config.siteSlug) {
    throw new Error('Reset confirmation must match DEMO_SITE_SLUG');
  }
  const site = await db.query('SELECT id, tenant_id, is_evaluation_demo FROM sites WHERE id = $1 AND tenant_id = $2 LIMIT 1', [config.siteSlug, config.tenantSlug]);
  const row = site.rows[0];
  if (!row || row.is_evaluation_demo !== true) throw new Error('Reset target must be a demo site in the requested tenant');

  const counts = await db.query(
    `SELECT
       (SELECT count(*)::int FROM evaluation_chat_sessions WHERE tenant_id = $1 AND site_id = $2) AS sessions,
       (SELECT count(*)::int FROM conversations c WHERE c.tenant_id = $1 AND c.site_id = $2 AND c.session_id LIKE 'evaluation:%') AS conversations,
       (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.tenant_id = $1 AND c.site_id = $2 AND c.session_id LIKE 'evaluation:%') AS messages`,
    [config.tenantSlug, config.siteSlug],
  );
  const planned = counts.rows[0] || {};
  if (options.execute !== true) return { dryRun: true, counts: planned };

  await db.transaction(async (tx) => {
    const conversations = await tx.query(
      `SELECT id FROM conversations
       WHERE tenant_id = $1 AND site_id = $2 AND session_id LIKE 'evaluation:%'`,
      [config.tenantSlug, config.siteSlug],
    );
    const ids = conversations.rows.map((entry) => entry.id);
    if (ids.length > 0) {
      await tx.query('DELETE FROM messages WHERE conversation_id = ANY($1::text[])', [ids]);
      await tx.query('DELETE FROM conversations WHERE id = ANY($1::text[])', [ids]);
    }
    await tx.query('DELETE FROM evaluation_chat_sessions WHERE tenant_id = $1 AND site_id = $2', [config.tenantSlug, config.siteSlug]);
  });

  return { dryRun: false, counts: planned };
}

export function printSafeJson(value) {
  console.log(JSON.stringify(value, null, 2));
}
