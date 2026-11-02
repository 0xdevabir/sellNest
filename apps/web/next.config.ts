import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  poweredByHeader: false,
  // Browsers only ever talk to one origin, so the session cookie stays first-party.
  // In production Nginx handles these paths before they reach Next.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${api}/socket.io/:path*` },
    ];
  },
};

export default config;
