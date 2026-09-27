import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256 } from '../../utils/hash';

type Scope = { tenantId: string; siteId: string };
type Identity = Scope & { traceId: string };
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TMPFS = 0x01021994;
const MAX_BYTES = 64 * 1024;
const MAX_FILES = 32;
const FORMAT = 'knowledge-pilot-trace-v1';
const FLAGS = fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;

function fail(): never { throw new Error('Knowledge pilot trace storage unavailable or invalid'); }
const validId = (value: unknown) => typeof value === 'string' && ID.test(value);
function prefix(scope: Scope) {
  if (!validId(scope.tenantId) || !validId(scope.siteId)) fail();
  return `trace-${sha256(`${scope.tenantId}\0${scope.siteId}`)}-`;
}
function name(identity: Identity) {
  if (!UUID.test(identity.traceId)) fail();
  return `${prefix(identity)}${identity.traceId}.jsonl`;
}

function directory() {
  const dir = process.env.KNOWLEDGE_PILOT_TRACE_DIR;
  if (!dir || !path.isAbsolute(dir) || path.resolve(dir) !== dir || fs.realpathSync(dir) !== dir) fail();
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.geteuid?.()
    || (stat.mode & 0o7777) !== 0o700 || fs.statfsSync(dir).type !== TMPFS) fail();
  // A private leaf alone is insufficient if an untrusted user can replace an
  // ancestor. Root-owned sticky directories such as /dev/shm are acceptable.
  for (let parent = path.dirname(dir); ; parent = path.dirname(parent)) {
    const ancestor = fs.lstatSync(parent);
    if (!ancestor.isDirectory() || ancestor.isSymbolicLink()
      || (ancestor.uid !== 0 && ancestor.uid !== process.geteuid?.())
      || ((ancestor.mode & 0o022) !== 0 && !(ancestor.uid === 0 && (ancestor.mode & 0o1000)))) fail();
    if (parent === path.dirname(parent)) break;
  }
  return { dir, stat };
}

function fileStat(fd: number) {
  const stat = fs.fstatSync(fd);
  if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.geteuid?.()
    || (stat.mode & 0o7777) !== 0o600 || stat.size > MAX_BYTES) fail();
  return stat;
}

function entries(dir: string) {
  const files = fs.readdirSync(dir);
  // Use a dedicated mount/directory, never a general-purpose temporary folder.
  if (files.length > MAX_FILES || files.some((file) => !/^trace-[a-f0-9]{64}-[a-f0-9-]{36}\.jsonl$/.test(file))) fail();
  return files;
}

/** No stdout, stderr, database, Redis or fallback sink. Each attempt owns one file. */
export function createKnowledgePilotTraceSink(identity: Identity) {
  const initial = directory();
  const filename = path.join(initial.dir, name(identity));
  let original: fs.Stats | undefined;
  let events = 0;
  let failed = false;
  return {
    write(event: Record<string, unknown>): boolean {
      let fd: number | undefined;
      let created = false;
      let appendStart: fs.Stats | undefined;
      try {
        if (failed || events >= 2 || event.tenantId !== identity.tenantId
          || event.siteId !== identity.siteId || event.traceId !== identity.traceId) return false;
        const current = directory();
        if (current.dir !== initial.dir || current.stat.dev !== initial.stat.dev || current.stat.ino !== initial.stat.ino) fail();
        if (!original && entries(current.dir).length >= MAX_FILES) fail();
        const first = !original;
        const header = first ? `${JSON.stringify({ format: FORMAT, tenantId: identity.tenantId,
          siteId: identity.siteId, traceId: identity.traceId })}\n` : '';
        const bytes = Buffer.from(`${header}${JSON.stringify(event)}\n`);
        if (bytes.length > MAX_BYTES) fail();
        // Later stages never use O_CREAT. Deleting a trace during generation
        // cannot make its completion recreate the removed file.
        fd = fs.openSync(filename, fs.constants.O_WRONLY | FLAGS
          | (first ? fs.constants.O_CREAT | fs.constants.O_EXCL : fs.constants.O_APPEND), 0o600);
        created = first;
        const stat = fileStat(fd);
        if (original && (stat.dev !== original.dev || stat.ino !== original.ino)) fail();
        if (stat.size + bytes.length > MAX_BYTES) fail();
        if (!first) appendStart = stat;
        original = stat;
        if (fs.writeSync(fd, bytes) !== bytes.length) fail();
        events++;
        return true;
      } catch {
        failed = true;
        if (created && fd !== undefined) {
          try {
            const opened = fs.fstatSync(fd);
            const current = fs.lstatSync(filename);
            if (opened.isFile() && opened.nlink === 1 && !current.isSymbolicLink()
              && current.dev === opened.dev && current.ino === opened.ino) fs.unlinkSync(filename);
          } catch { /* Preserve unrelated files if ownership cannot be established. */ }
        } else if (appendStart && fd !== undefined) {
          try {
            // Roll back only the attempted append on the same verified open
            // file. Never reopen a path that may now refer to another trace.
            const current = fileStat(fd);
            if (current.dev === appendStart.dev && current.ino === appendStart.ino
              && current.size >= appendStart.size) fs.ftruncateSync(fd, appendStart.size);
          } catch { /* Listing reports any unreadable remainder explicitly. */ }
        }
        return false;
      } finally { if (fd !== undefined) fs.closeSync(fd); }
    },
  };
}

export function knowledgePilotTraceStatus() {
  try {
    const { dir } = directory();
    const count = entries(dir).length;
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
    return { ready: count < MAX_FILES, storage: 'tmpfs', files: count, maxFiles: MAX_FILES, maxBytesPerTrace: MAX_BYTES };
  } catch { return { ready: false, storage: 'unavailable' }; }
}

export function readKnowledgePilotTrace(identity: Identity) {
  const { dir } = directory();
  const fd = fs.openSync(path.join(dir, name(identity)), fs.constants.O_RDONLY | FLAGS);
  try {
    fileStat(fd);
    const text = fs.readFileSync(fd, 'utf8');
    if (Buffer.byteLength(text) > MAX_BYTES || !text.endsWith('\n')) fail();
    const [header, ...events] = text.trimEnd().split('\n').map((line) => JSON.parse(line));
    if (header.format !== FORMAT || header.tenantId !== identity.tenantId
      || header.siteId !== identity.siteId || header.traceId !== identity.traceId
      || events.length < 1 || events.length > 2
      || events.some((event) => event.tenantId !== identity.tenantId || event.siteId !== identity.siteId
        || event.traceId !== identity.traceId || event.schemaVersion !== 1)) fail();
    return { tenantId: identity.tenantId, siteId: identity.siteId, traceId: identity.traceId, events };
  } finally { fs.closeSync(fd); }
}

export function listKnowledgePilotTraces(scope: Scope, sessionId: string) {
  if (!validId(sessionId)) fail();
  const scopePrefix = prefix(scope);
  const { dir } = directory();
  const result: { traceId: string; events: number }[] = [];
  const unreadableTraceIds: string[] = [];
  for (const file of entries(dir).filter((entry) => entry.startsWith(scopePrefix))) {
    const traceId = file.slice(scopePrefix.length, -'.jsonl'.length);
    try {
      const trace = readKnowledgePilotTrace({ ...scope, traceId });
      if (trace.events.every((event) => event.sessionId === sessionId)) result.push({ traceId, events: trace.events.length });
    } catch {
      // Preserve valid session results without hiding damaged/unreadable files.
      // Their session cannot be established; they are not matching traces or
      // deletion targets for this session unless independently identified.
      unreadableTraceIds.push(traceId);
    }
  }
  return { traces: result, unreadableTraceIds, complete: unreadableTraceIds.length === 0 };
}

/** Exact scope + UUID only; no glob, recursive deletion or shared-log mutation. */
export function deleteKnowledgePilotTrace(identity: Identity) {
  const { dir } = directory();
  const filename = path.join(dir, name(identity));
  let fd: number;
  try { fd = fs.openSync(filename, fs.constants.O_RDONLY | FLAGS); }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { deleted: false, absent: true };
    throw error;
  }
  try {
    const opened = fileStat(fd);
    const current = fs.lstatSync(filename);
    if (current.dev !== opened.dev || current.ino !== opened.ino || current.isSymbolicLink()) fail();
    fs.unlinkSync(filename);
  } finally { fs.closeSync(fd); }
  try { fs.lstatSync(filename); fail(); }
  catch (error) { if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error; }
  return { deleted: true, absent: true };
}

/** Provider-free operator proof on the actual mount, restricted to a fresh file. */
export function probeKnowledgePilotTraceStore(scope: Scope) {
  const identity = { tenantId: scope.tenantId, siteId: scope.siteId, traceId: randomUUID() };
  const event = { schemaVersion: 1, ...identity, sessionId: 'storage-probe', conversationId: 'storage-probe',
    mode: 'normal', at: new Date().toISOString(), phase: 'no_evidence', candidateCount: 0, selectedCount: 0,
    candidatesTruncated: false, selectedTruncated: false, candidates: [], selected: [] };
  const sink = createKnowledgePilotTraceSink(identity);
  if (!sink.write(event)) fail();
  let readBack = false;
  let removed: { deleted: boolean; absent: boolean };
  try { readBack = JSON.stringify(readKnowledgePilotTrace(identity).events) === JSON.stringify([event]); }
  finally { removed = deleteKnowledgePilotTrace(identity); }
  if (!readBack || !removed.deleted || !removed.absent) fail();
  return { ready: true, readBack, ...removed };
}
