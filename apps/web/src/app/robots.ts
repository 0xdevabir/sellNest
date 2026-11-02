import type { MetadataRoute } from 'next';

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
