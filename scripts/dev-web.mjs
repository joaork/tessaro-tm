// GitHub https://github.com/joaork

import { spawn } from 'node:child_process';
import { error as logError } from 'node:console';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const port = Number(process.env.TESSARO_WEB_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('TESSARO_WEB_PORT deve ser uma porta válida.');

const next = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  stdio: 'inherit',
});
next.on('error', (error) => {
  logError(error.message);
  process.exitCode = 1;
});
next.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 0 : 1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => next.kill(signal));
