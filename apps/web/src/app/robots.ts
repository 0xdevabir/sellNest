import type { MetadataRoute } from 'next';

// Read WEB_URL at request time, so one image can serve staging and production.
export const dynamic = 'force-dynamic';

const site = (process.env.WEB_URL ?? 'http://localhost:3100').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/inbox', '/notifications', '/sell', '/admin', '/welcome', '/explore?', '/api/'],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
