import type { Metadata } from 'next';
import { Cormorant_Garamond, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import { QueryProvider } from '@/components/providers/query-provider';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_COOKIE_NAME, parseLocale } from '@/lib/i18n/locale-cookie';
import enLanding from '@/lib/i18n/locales/en/landing';
import { siteMetadataBase } from '@/lib/site-url';
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

// Absolute base for Open Graph / Twitter image URLs. Unset: Next's own default.
const metadataBase = siteMetadataBase(process.env.NEXT_PUBLIC_SITE_URL);

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: 'Coin Collector Companion',
  // Metadata is static, so it stays English.
  description: enLanding['landing.metaDescription'],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The visitor's locale from the ccc-locale cookie, so <html lang> and the first render match it.
  // Reading cookies makes every route dynamically rendered (see the 2026-11-16 locale-cookie ADR).
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <html
      lang={locale}
      className={[
        cormorantGaramond.variable,
        ibmPlexSans.variable,
        ibmPlexMono.variable,
        'h-full antialiased',
      ].join(' ')}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale={locale}>
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
