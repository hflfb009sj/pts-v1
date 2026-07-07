import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { PiSDKProvider } from '@/components/PiSDKProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import React from 'react';

const inter = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-fraunces',
  display: 'swap',
});

const interFont = { className: 'font-sans' };

export const metadata: Metadata = {
  title: 'PTrust Oracle | Secure Pi Escrow',
  description: 'Lock funds · verify delivery · release with confidence. The most secure escrow protocol on Pi Network.',
  keywords: ['Pi Network', 'Escrow', 'PTrust Oracle', 'Secure Trade', 'Pi Escrow', 'Blockchain'],
  authors: [{ name: 'PTrust Oracle' }],
  openGraph: {
    title: 'PTrust Oracle — Secure Escrow on Pi Network',
    description: 'Lock funds · verify delivery · release with confidence.',
    type: 'website',
    url: 'https://pts-v1.vercel.app',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0908',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: '#0A0908', margin: 0, padding: 0 }}>
        <ErrorBoundary>
          <PiSDKProvider>
            {children}
          </PiSDKProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
