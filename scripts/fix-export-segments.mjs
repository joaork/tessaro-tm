// GitHub https://github.com/joaork

import { readdir, rename } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

// On Windows, Next.js 16.4.6 exports some nested RSC segments as directories.
// The client requests those same segments as dot-separated filenames.
if (sep === '\\') {
  const output = resolve('out');
  const entries = await readdir(output, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;
    const directories = relative(output, entry.parentPath).split(sep);
    const segmentStart = directories.findIndex((directory) => directory.startsWith('__next.'));
    if (segmentStart < 0) continue;
    const filename = [...directories.slice(segmentStart), entry.name].join('.');
    await rename(join(entry.parentPath, entry.name), join(output, ...directories.slice(0, segmentStart), filename));
  }
}
