import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | PTrust Oracle',
  description: 'PTrust Oracle Privacy Policy — How we handle your data on Pi Network.',
};

export default function PrivacyPage() {
  const sections = [
    {
      title: '1. Information We Collect',
      content: `PTrust Oracle collects only the information necessary to provide our escrow service:
• Pi Network username (provided by Pi Network authentication)
• Pi wallet address (used for escrow transactions)
• Transaction details (amounts, descriptions, escrow codes)
• Community chat messages (public, visible to all users)
• Transaction ratings and reviews`
    },
    {
      title: '2. How We Use Your Information',
      content: `We use collected information solely to:
• Process and track escrow transactions
• Verify transaction parties
• Calculate Trust Scores based on transaction history
• Provide dispute resolution support
• Display community statistics`
    },
    {
      title: '3. Data Storage',
      content: `Your data is stored securely in MongoDB Atlas (encrypted at rest). We do not store:
• Private keys or seed phrases
• Pi Network passwords
• Payment card information
• Personal identification documents (KYC is handled entirely by Pi Network)`
    },
    {
      title: '4. Data Sharing',
      content: `We do not sell, trade, or share your personal data with third parties. Transaction data is shared only between the buyer and seller involved in a specific escrow. Admin has access to transaction data solely for dispute resolution.`
    },
    {
      title: '5. Pi Network Authentication',
      content: `Authentication is handled entirely by Pi Network via the official Pi SDK. PTrust Oracle receives only your username and wallet address from Pi Network. We do not store your Pi access tokens beyond the session.`
    },
    {
      title: '6. Cookies & Local Storage',
      content: `PTrust Oracle uses no tracking cookies. Session state is managed in memory only and cleared when you close the app.`
    },
    {
      title: '7. Data Retention',
      content: `Transaction records are retained indefinitely to maintain the integrity of the Trust Score system and audit trail. Chat messages are retained for 90 days. You may request deletion of your chat history by contacting support.`
    },
    {
      title: '8. Your Rights',
      content: `You have the right to:
• Access your transaction data (visible in the Deals tab)
• Request a copy of your data
• Request deletion of non-transactional data
• Opt out of the community chat at any time
Contact: Riahig45@gmail.com`
    },
    {
      title: '9. Security',
      content: `We implement industry-standard security measures including HTTPS encryption, server-side input validation, rate limiting on all API endpoints, and no storage of private keys. Escrow funds are protected by dual-key cryptography — neither PTrust Oracle nor any third party can release funds without the Buyer Key.`
    },
    {
      title: '10. Changes to This Policy',
      content: `We may update this Privacy Policy. Changes will be reflected with an updated date below. Continued use of PTrust Oracle constitutes acceptance of the updated policy.`
    },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#0A0908', color: '#E8E4DC', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#8A8378', fontSize: 12, fontWeight: 700, textDecoration: 'none', marginBottom: 24 }}>
            ← Back to PTrust Oracle
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#F5C46C,#B8893E 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 20, color: '#151310' }}>π</span>
            </div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 28, margin: 0, color: '#E8E4DC' }}>
                P<span style={{ color: '#F5C46C' }}>TRUST</span> Oracle
              </h1>
              <p style={{ color: '#8A8378', fontSize: 11, margin: '4px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Privacy Policy</p>
            </div>
          </div>
          <p style={{ color: '#8A8378', fontSize: 12, margin: 0 }}>
            Effective Date: July 5, 2026 · Last Updated: July 5, 2026
          </p>
        </div>

        {/* Intro */}
        <div style={{ background: 'rgba(245,196,108,0.06)', border: '1px solid rgba(245,196,108,0.15)', borderRadius: 16, padding: '16px 20px', marginBottom: 32 }}>
          <p style={{ color: '#C8C0B4', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            PTrust Oracle is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data when using our escrow service on Pi Network.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((sec, i) => (
            <div key={i} style={{ background: '#151310', border: '1px solid rgba(245,196,108,0.10)', borderRadius: 16, padding: '20px 24px' }}>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 800, fontSize: 15, color: '#F5C46C', margin: '0 0 10px' }}>{sec.title}</h2>
              <p style={{ color: '#C8C0B4', fontSize: 12, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{sec.content}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ color: '#8A8378', fontSize: 11 }}>
            Questions? Contact us at{' '}
            <a href="mailto:Riahig45@gmail.com" style={{ color: '#F5C46C' }}>Riahig45@gmail.com</a>
          </p>
          <Link href="/" style={{ display: 'inline-block', marginTop: 16, color: '#8A8378', fontSize: 11, textDecoration: 'none' }}>
            ← Return to PTrust Oracle
          </Link>
        </div>
      </div>
    </main>
  );
}
