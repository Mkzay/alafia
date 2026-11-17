import type { Metadata, Viewport } from 'next';
import { Chakra_Petch } from 'next/font/google';
import { APP_DESCRIPTION, APP_NAME, NAV } from '@/components/copy/common';
import { AppNav } from '@/components/shell/AppNav';
import { ServiceWorkerRegistration } from '@/components/shell/ServiceWorkerRegistration';
import './globals.css';

// Downloaded at build time and served from the app, so no network is needed for fonts.
const chakra = Chakra_Petch({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-chakra',
});

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: APP_DESCRIPTION,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0b0f17',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={chakra.variable}>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-20 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          {NAV.skipToContent}
        </a>
        <main id="main">{children}</main>
        <AppNav />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
