// Synthetic, provider-free legacy process. Receipts follow fsynced local effects, not process exit.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const kinds = ['http', 'stream', 'import', 'provider', 'queue', 'background', 'reporter', 'writers'];
let binding, acceptedAt, closedAt, window;
process.on('message', message => {
  try {
    if (message.action === 'accept') {
      if (binding) throw Error('already accepted');
      binding = message.binding; window = hash(message.owner); acceptedAt = new Date().toISOString();
      process.send({ acceptedAt, kinds });
    } else if (message.action === 'fence') {
      if (!binding || closedAt) throw Error('invalid fence');
      closedAt = new Date().toISOString();
      process.send({ closedAt, acceptanceClosed: true });
    } else if (message.action === 'new-work') {
      process.send({ denied: Boolean(closedAt) });
    } else if (message.action === 'complete') {
      if (!closedAt) throw Error('fence required');
      const coverage = kinds.map(kind => {
        const id = `synthetic-${kind}`, effect = Buffer.from(`completed ${id}`);
        const fd = fs.openSync(path.join(binding.root, `${id}.effect`), 'wx', 0o600);
        try { fs.writeFileSync(fd, effect); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        const receipt = { id, kind, service: binding.service, window, sourceGeneration: 'legacy-synthetic',
          outcome: kind === message.uncertain ? 'unknown' : 'completed', sourceEvidence: hash(effect),
          acceptedAt, completedAt: new Date().toISOString() };
        const bytes = JSON.stringify(receipt);
        fs.writeFileSync(path.join(binding.root, `legacy-receipt-${id}.json`), bytes, { mode: 0o600, flag: 'wx' });
        return { kind, admissionEvidence: hash(`fenced:${closedAt}:${kind}`),
          writerEvidence: hash(`owned-synthetic-process:${process.pid}:${kind}`),
          operations: [{ id, receiptSha256: hash(bytes) }] };
      });
      const proof = { version: 1, service: binding.service, generation: binding.generation, sourceGeneration: 'legacy-synthetic',
        epoch: 0, window, closedAt, expiresAt: new Date(Date.parse(closedAt) + 60 * 60 * 1000).toISOString(), coverage };
      const bytes = JSON.stringify(proof);
      fs.writeFileSync(path.join(binding.root, 'legacy-observer.json'), bytes, { mode: 0o600, flag: 'wx' });
      process.send({ proof, digest: hash(bytes) });
    } else throw Error('unknown action');
  } catch (error) { process.send({ error: error.message }); }
});
