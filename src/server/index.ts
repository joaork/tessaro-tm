// GitHub https://github.com/joaork

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from './app';

const port = Number(process.env.TESSARO_PORT ?? 8787);
const dbPath = process.env.TESSARO_DB ?? 'data/tessaro.sqlite';
const distPath = process.argv.includes('--static') ? resolve('out') : undefined;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('TESSARO_PORT deve ser uma porta entre 1 e 65535.');
if (distPath && !existsSync(resolve(distPath, 'index.html'))) throw new Error('Execute npm run build antes de iniciar a versão compilada.');

const app = createServer({ dbPath, distPath, logger: true, transcriptionKey: process.env.TESSARO_OPENAI_API_KEY?.trim() });
await app.listen({ host: '127.0.0.1', port });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
