import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { PiSDKProvider } from '@/components/PiSDKProvider';
import Script from 'next/script';
import React from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PTrust Oracle | Secure Pi Escrow',
  description: 'The premier decentralized trust layer for Pi Network.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Load Pi SDK before anything else */}
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={inter.className}>
        <PiSDKProvider>
          {children}
        </PiSDKProvider>
      </body>
    </html>
  );
}