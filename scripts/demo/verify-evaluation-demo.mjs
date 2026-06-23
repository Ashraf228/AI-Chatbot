#!/usr/bin/env node
import { PrismaService } from '../../apps/api/dist/db/prisma.service.js';
import { loadConfig, parseArgs, printSafeJson, verifyEvaluationDemo } from './evaluation-demo-tools.mjs';

async function main() {
  const args = parseArgs();
  const config = loadConfig(process.env, { ...args, allowLongExpiry: true, requirePassword: false });
  const db = new PrismaService();
  const result = await verifyEvaluationDemo(db, config);
  printSafeJson(result);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Verification failed');
  process.exit(1);
});
