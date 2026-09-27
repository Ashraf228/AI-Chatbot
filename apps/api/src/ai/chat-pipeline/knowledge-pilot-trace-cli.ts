import {
  deleteKnowledgePilotTrace, knowledgePilotTraceStatus, listKnowledgePilotTraces, readKnowledgePilotTrace,
  probeKnowledgePilotTraceStore,
} from './knowledge-pilot-trace-store';

/** Local OS-operator tool shipped in the API image; no HTTP endpoint or provider. */
export function runKnowledgePilotTraceCommand(args: string[]) {
  const [command, ...rest] = args;
  const keys = command === 'status' ? [] : command === 'probe' ? ['tenant-id', 'site-id'] : command === 'list'
    ? ['tenant-id', 'site-id', 'session-id'] : ['tenant-id', 'site-id', 'trace-id'];
  if (!['status', 'probe', 'list', 'read', 'delete'].includes(command) || rest.length !== keys.length * 2) {
    throw new Error('Invalid trace command');
  }
  const options: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].replace(/^--/, '');
    if (!rest[i].startsWith('--') || !keys.includes(key) || Object.prototype.hasOwnProperty.call(options, key)) throw new Error('Invalid trace option');
    options[key] = rest[i + 1];
  }
  if (command === 'status') return knowledgePilotTraceStatus();
  const scope = { tenantId: options['tenant-id'], siteId: options['site-id'] };
  if (command === 'probe') return probeKnowledgePilotTraceStore(scope);
  if (command === 'list') return listKnowledgePilotTraces(scope, options['session-id']);
  const identity = { ...scope, traceId: options['trace-id'] };
  return command === 'read' ? readKnowledgePilotTrace(identity) : deleteKnowledgePilotTrace(identity);
}

if (require.main === module) {
  try {
    const result = runKnowledgePilotTraceCommand(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if ('ready' in result && !result.ready) process.exitCode = 2;
  } catch {
    // Never print filesystem paths, file content or raw OS/parser exceptions.
    process.stderr.write('Knowledge pilot trace operation failed.\n');
    process.exitCode = 1;
  }
}
