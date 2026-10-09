import { readFileSync, fstatSync, openSync, closeSync, constants } from 'node:fs';

export function privateFile(file: string | undefined): string {
  if (!file) throw new Error('Private file binding missing');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.nlink !== 1 || info.size > 1048576 || (info.mode & 0o777) !== 0o600
      || info.uid !== process.getuid?.()) throw new Error('Private file permissions invalid');
    return readFileSync(fd, 'utf8').trim();
  } finally { closeSync(fd); }
}
