import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PiSDKProvider } from '@/components/PiSDKProvider';
export const metadata: Metadata = {
  title: 'PTrust Oracle — The Vault of Trust on Pi Network',
  description: 'Secure escrow platform for Pi Network. 0.01% fee, no limits.',
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  userScalable: false, themeColor: '#060504',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <script src="https://sdk.minepi.com/pi-sdk.js"/>
        <script dangerouslySetInnerHTML={{__html:`window.addEventListener('load',function(){if(window.Pi){Pi.init({version:"2.0",sandbox:false});}});`}}/>
      </head>
      <body><PiSDKProvider>{children}</PiSDKProvider></body>
    </html>
  );
}
