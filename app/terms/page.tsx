import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | PTrust Oracle',
  description: 'PTrust Oracle Terms of Service — Rules and conditions for using our Pi Network escrow platform.',
};

export default function TermsPage() {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: `By accessing or using PTrust Oracle, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform. You must be a verified Pi Network user with a valid Pi wallet to use PTrust Oracle.`
    },
    {
      title: '2. Description of Service',
      content: `PTrust Oracle is a peer-to-peer escrow service built on Pi Network. We facilitate secure transactions between buyers and sellers by holding funds in escrow until both parties confirm completion. PTrust Oracle does not:
• Take custody of your Pi funds directly
• Guarantee the quality of goods or services exchanged
• Act as a financial institution or payment processor
• Provide legal, financial, or tax advice`
    },
    {
      title: '3. User Responsibilities',
      content: `As a user of PTrust Oracle, you agree to:
• Provide accurate information when creating transactions
• Keep your Buyer Key and Seller Key confidential and secure
• Not use the platform for illegal activities, fraud, or money laundering
• Not attempt to manipulate the Trust Score system
• Complete transactions in good faith
• Respond to disputes within the 15-day evidence window`
    },
    {
      title: '4. Escrow Process & Keys',
      content: `When you create an escrow:
• A unique Buyer Key and Seller Key are generated
• The Buyer Key is required to release funds or open a dispute — keep it private
• The Seller Key is shared with the seller to accept the deal
• Lost keys cannot be recovered — PTrust Oracle has no access to your keys
• Typing CONFIRM to release funds is irreversible`
    },
    {
      title: '5. Platform Fee',
      content: `PTrust Oracle charges a platform fee of 0.1% of each transaction amount. This fee is automatically calculated and deducted at the time of escrow creation. The minimum transaction amount is 0.000001 Pi and the maximum is 1,000,000 Pi. Fees are non-refundable once a transaction is initiated.`
    },
    {
      title: '6. Disputes',
      content: `If a buyer opens a dispute:
• Funds are immediately frozen
• Both parties have 15 days to submit evidence
• PTrust Oracle admin reviews all evidence and makes a final decision
• The admin decision is final and binding
• Abuse of the dispute system may result in account restrictions
• False disputes may negatively affect your Trust Score`
    },
    {
      title: '7. Auto-Release',
      content: `If no action is taken on a delivered transaction for 15 days after the seller marks delivery, funds are automatically released to the seller. This protects sellers from buyer inaction. Buyers should review deliveries promptly.`
    },
    {
      title: '8. Trust Score',
      content: `Your Trust Score is calculated based on your transaction history, ratings, and dispute activity. PTrust Oracle reserves the right to adjust Trust Score calculations at any time. Trust Scores are for informational purposes only and do not constitute a guarantee of user behavior.`
    },
    {
      title: '9. Prohibited Activities',
      content: `The following are strictly prohibited:
• Fraudulent transactions or misrepresentation of goods/services
• Use of the platform for illegal goods, services, or activities
• Attempting to bypass the escrow mechanism
• Creating fake accounts or manipulating ratings
• Harassment of other users via Community Chat
• Attempting to exploit bugs or vulnerabilities
Violations may result in permanent account suspension and reporting to Pi Network.`
    },
    {
      title: '10. Limitation of Liability',
      content: `PTrust Oracle is provided "as is" without warranties of any kind. We are not liable for:
• Lost Buyer Keys or Seller Keys
• Losses arising from fraudulent counterparties
• Technical failures beyond our reasonable control
• Actions taken by Pi Network that affect transactions
• Losses exceeding the transaction amount in dispute
Our maximum liability is limited to the platform fee paid for the specific transaction in question.`
    },
    {
      title: '11. Termination',
      content: `PTrust Oracle reserves the right to suspend or terminate access to any user who violates these terms, engages in fraudulent activity, or poses a risk to other users. Pending transactions at the time of termination will be reviewed and resolved by admin.`
    },
    {
      title: '12. Changes to Terms',
      content: `We may update these Terms of Service at any time. Changes take effect when posted. Continued use of PTrust Oracle after changes constitutes acceptance. We will attempt to notify users of significant changes via the Community Chat or app notifications.`
    },
    {
      title: '13. Governing Law',
      content: `These Terms are governed by the terms and conditions of Pi Network. Any disputes regarding the platform itself (not escrow transactions) should be directed to Riahig45@gmail.com.`
    },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#0A0908', color: '#E8E4DC', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

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
              <p style={{ color: '#8A8378', fontSize: 11, margin: '4px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Terms of Service</p>
            </div>
          </div>
          <p style={{ color: '#8A8378', fontSize: 12, margin: 0 }}>
            Effective Date: July 5, 2026 · Last Updated: July 5, 2026
          </p>
        </div>

        <div style={{ background: 'rgba(196,69,54,0.06)', border: '1px solid rgba(196,69,54,0.15)', borderRadius: 16, padding: '16px 20px', marginBottom: 32 }}>
          <p style={{ color: '#C8C0B4', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            Please read these Terms of Service carefully before using PTrust Oracle. By using our platform, you agree to these terms in full. These terms protect both buyers and sellers using our escrow service.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((sec, i) => (
            <div key={i} style={{ background: '#151310', border: '1px solid rgba(245,196,108,0.10)', borderRadius: 16, padding: '20px 24px' }}>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 800, fontSize: 15, color: '#F5C46C', margin: '0 0 10px' }}>{sec.title}</h2>
              <p style={{ color: '#C8C0B4', fontSize: 12, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{sec.content}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ color: '#8A8378', fontSize: 11 }}>
            Questions? Contact us at{' '}
            <a href="mailto:Riahig45@gmail.com" style={{ color: '#F5C46C' }}>Riahig45@gmail.com</a>
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16 }}>
            <Link href="/privacy" style={{ color: '#8A8378', fontSize: 11, textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/" style={{ color: '#8A8378', fontSize: 11, textDecoration: 'none' }}>← Return to App</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
