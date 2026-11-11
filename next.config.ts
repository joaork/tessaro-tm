import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function config(phase: string): NextConfig {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  const apiPort = process.env.TESSARO_PORT ?? '8787';

  return {
    poweredByHeader: false,
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    ...(development
      ? { rewrites: async () => [{ source: '/api/:path*', destination: 'http://127.0.0.1:' + apiPort + '/api/:path*' }] }
      : { output: 'export' }),
  };
}
