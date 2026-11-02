import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { Header, MobileNav } from '@/components/shell';
import { getCatalog, getMe, getPlace } from '@/lib/server';
import './globals.css';

const font = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_URL ?? 'http://localhost:3100'),
  title: { default: 'SellNest: buy nearby, sell easily', template: '%s | SellNest' },
  description: 'Buy and sell used items with people near you, starting with the Daffodil International University community.',
  openGraph: { siteName: 'SellNest', type: 'website', locale: 'en_BD' },
};

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [me, catalog, place] = await Promise.all([getMe().catch(() => null), getCatalog(), getPlace()]);
  return (
    <html lang="en" className={font.variable}>
      <body className="min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Providers me={me} catalog={catalog} place={place}>
          <Header />
          <div id="main">{children}</div>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
