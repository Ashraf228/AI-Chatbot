#!/usr/bin/env node
import { createRequire } from 'node:module';
import { loadConfig, parseArgs, printSafeJson, provisionEvaluationDemo, summarizePlan } from './evaluation-demo-tools.mjs';

const require = createRequire(import.meta.url);
const { PrismaService } = require('../../apps/api/dist/db/prisma.service.js');
const { IngestService } = require('../../apps/api/dist/ingest/ingest.service.js');
const { KnowledgeSourcesService } = require('../../apps/api/dist/knowledge-sources/knowledge-sources.service.js');
const { EmbeddingService } = require('../../apps/api/dist/vector/embedding.service.js');
const { VectorService } = require('../../apps/api/dist/vector/vector.service.js');

async function main() {
  const args = parseArgs();
  const config = loadConfig(process.env, args);
  if (!args.execute && !process.env.DATABASE_URL) {
    printSafeJson({
      mode: 'dry-run',
      plan: summarizePlan(config),
      dryRun: true,
      database: 'not-connected',
      note: 'Set DATABASE_URL for an existence-aware dry-run. No data was written.',
    });
    return;
  }

  const db = new PrismaService();
  const sites = {
    async getSite(siteId) {
      const res = await db.query('SELECT * FROM sites WHERE id = $1 LIMIT 1', [siteId]);
      return res.rows[0] || null;
    },
  };
  const knowledgeSources = new KnowledgeSourcesService(db, sites);
  const ingest = new IngestService(
    db,
    new EmbeddingService(),
    new VectorService(db),
    sites,
    knowledgeSources,
  );

  printSafeJson({ mode: args.execute ? 'execute' : 'dry-run', plan: summarizePlan(config) });
  const result = await provisionEvaluationDemo(db, config, {
    ...args,
    ingestDemoArticle: (input) => ingest.ingestTextIntoExistingSource(input),
  });
  printSafeJson(result);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Provisioning failed');
  process.exit(1);
});
