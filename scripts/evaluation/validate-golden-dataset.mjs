#!/usr/bin/env node
import { DATASET_VERSION, validateDataset } from './golden-shared.mjs';

const validation = await validateDataset();

if (!validation.ok) {
  console.error(`dataset=${DATASET_VERSION}`);
  console.error(`valid=false`);
  for (const error of validation.errors.slice(0, 20)) {
    console.error(error);
  }
  process.exit(1);
}

console.log(`dataset=${DATASET_VERSION}`);
console.log(`valid=true`);
console.log(`cases=${validation.cases.length}`);
console.log(`multiTurn=${validation.multiTurnCount}`);
console.log(`coveredDemoSeedKeys=${validation.positiveCoverage.size}/${validation.knownSeedKeys.size}`);
