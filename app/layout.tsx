import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { PiSDKProvider } from '@/components/PiSDKProvider';
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
      <body className={inter.className}>
        <PiSDKProvider>
          {children}
        </PiSDKProvider>
      </body>
    </html>
  );
}