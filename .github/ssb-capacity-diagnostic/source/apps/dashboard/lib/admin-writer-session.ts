import { createHmac } from 'node:crypto';
import { openSync, fstatSync, readFileSync, closeSync, constants } from 'node:fs';

export const WRITER_SESSION_COOKIE = 'ssb_writer_session';

export function writerSigningKey(): string {
  const file = process.env.ADMIN_WRITER_SIGNING_KEY_FILE;
  if (!file) throw new Error('Writer key unavailable');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) || stat.uid !== process.getuid?.()) throw new Error('Writer key permissions');
    const key = readFileSync(fd, 'utf8').trim();
    if (key.length < 64) throw new Error('Writer key invalid');
    return key;
  } finally { closeSync(fd); }
}

// Issued only by the password-verified login path, never by the generic BFF proxy.
export function createWriterSessionProof(token: string): string {
  return createHmac('sha256', writerSigningKey()).update(`writer-session-v1:${token}`).digest('hex');
}
