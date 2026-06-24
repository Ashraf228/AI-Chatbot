#!/usr/bin/env node

if (process.env.RUN_LIVE_EVAL !== '1') {
  console.log('eval:nolis-demo:live not run; set RUN_LIVE_EVAL=1 to enable the optional live-model evaluator.');
  process.exit(0);
}

const required = ['LIVE_EVAL_MODEL'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.log(`eval:nolis-demo:live not run; missing ${missing.join(',')}.`);
  process.exit(0);
}

console.log('eval:nolis-demo:live is intentionally not part of CI.');
console.log('This placeholder accepts only synthetic inputs and must not request or store chain-of-thought.');
console.log('No live model call was executed by default implementation.');
