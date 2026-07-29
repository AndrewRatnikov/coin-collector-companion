import type { Metadata } from 'next';
import { Cormorant_Garamond, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import './globals.css';

// Heading font (Cormorant Garamond, weight 600 ceiling) — Classical design system.
const cormorantGaramond = Cormorant_Garamond({
  variable: '--font-heading-family',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

// Body font override for this specific mock (the DS's own default is Lora).
const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-body-family',
  subsets: ['latin'],
  weight: ['400', '500'],
});

// Numeric/tabular font for prices, years, counts, percentages, pagination.
const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-mono-family',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Coin Collector Companion',
  description: 'Track your coin collection against canonical set checklists.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        cormorantGaramond.variable,
        ibmPlexSans.variable,
        ibmPlexMono.variable,
        'h-full antialiased',
      ].join(' ')}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <QueryProvider>
            <SiteNav />
            {children}
          </QueryProvider>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
