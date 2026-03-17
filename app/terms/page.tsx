'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, FileText, Users, Percent, Scale, AlertTriangle, Mail } from 'lucide-react';

const EFFECTIVE_DATE = 'March 18, 2026';

interface Section {
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    icon: FileText,
    title: '1. Acceptance of Terms',
    body: (
      <p className="text-neutral-400 text-[13px] leading-relaxed">
        By accessing or using PTrust Oracle, you agree to be bound by these Terms of Service and our
        Privacy Policy. If you do not agree to these terms, do not use the platform. These terms may
        be updated at any time; continued use constitutes acceptance of any revised terms.
      </p>
    ),
  },
  {
    icon: ShieldCheck,
    title: '2. Description of Service',
    body: (
      <div className="space-y-3 text-neutral-400 text-[13px] leading-relaxed">
        <p>
          PTrust Oracle is a <strong className="text-neutral-200">decentralized escrow intermediary</strong>{' '}
          built on the <strong className="text-neutral-200">Pi Network</strong>. We facilitate secure
          peer-to-peer transactions by holding Pi funds in escrow until both buyer and seller fulfill
          their agreed obligations.
        </p>
        <p>
          PTrust Oracle does <strong className="text-rose-400">not</strong> act as a bank, financial
          institution, or payment processor. It is a smart escrow coordination layer.
        </p>
      </div>
    ),
  },
  {
    icon: Users,
    title: '3. User Responsibilities',
    body: (
      <ul className="space-y-2 text-neutral-400 text-[13px] leading-relaxed">
        <li className="flex gap-2">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
          A <strong className="text-neutral-200">valid, KYC-verified Pi Network account</strong> is required to use this platform.
        </li>
        <li className="flex gap-2">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
          You are solely responsible for <strong className="text-neutral-200">saving your Buyer Key</strong>. It is shown only once. Loss of your Buyer Key may result in loss of access to your funds.
        </li>
        <li className="flex gap-2">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
          You must not use PTrust Oracle to facilitate <strong className="text-neutral-200">illegal, fraudulent, or prohibited transactions</strong>.
        </li>
        <li className="flex gap-2">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
          You agree to provide accurate deal descriptions and act in <strong className="text-neutral-200">good faith</strong> during all transactions and disputes.
        </li>
      </ul>
    ),
  },
  {
    icon: Percent,
    title: '4. Platform Fee',
    body: (
      <div className="space-y-3 text-neutral-400 text-[13px] leading-relaxed">
        <p>
          PTrust Oracle charges a flat <strong className="text-amber-400 text-sm">1%</strong> fee on all
          successfully released escrow transactions. This fee is automatically deducted at the time of
          fund release.
        </p>
        <ul className="space-y-2">
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
            No fee is charged if a transaction is refunded to the buyer.
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
            No setup fees, subscription fees, or hidden charges.
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
            The fee structure may be updated with prior notice to users.
          </li>
        </ul>
      </div>
    ),
  },
  {
    icon: Scale,
    title: '5. Dispute Resolution',
    body: (
      <div className="space-y-3 text-neutral-400 text-[13px] leading-relaxed">
        <p>
          In the event of a dispute, funds are immediately <strong className="text-neutral-200">frozen</strong>{' '}
          and both parties have up to <strong className="text-neutral-200">15 days</strong> to submit evidence.
        </p>
        <p>
          Disputes are reviewed by <strong className="text-neutral-200">3 randomly selected neutral judges</strong>{' '}
          from the verified Pi pioneer pool. A majority vote (2 of 3) determines the outcome.
        </p>
        <p>
          The <strong className="text-neutral-200">PTrust Oracle administration</strong> reserves the right to make
          final decisions in unresolvable disputes or cases of clear fraudulent behavior.
        </p>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-400 text-[11px]">
          ⚖️ &nbsp; All dispute decisions are final and binding once the judge vote is concluded.
        </div>
      </div>
    ),
  },
  {
    icon: AlertTriangle,
    title: '6. Limitations of Liability',
    body: (
      <div className="space-y-3 text-neutral-400 text-[13px] leading-relaxed">
        <p>
          PTrust Oracle is provided <strong className="text-neutral-200">"as is"</strong> without warranties of
          any kind. We are not liable for:
        </p>
        <ul className="space-y-2">
          <li className="flex gap-2">
            <span className="text-rose-500 flex-shrink-0 mt-0.5">·</span>
            Loss of funds resulting from lost Buyer or Seller Keys.
          </li>
          <li className="flex gap-2">
            <span className="text-rose-500 flex-shrink-0 mt-0.5">·</span>
            Pi Network blockchain downtime, transaction delays, or failures outside our control.
          </li>
          <li className="flex gap-2">
            <span className="text-rose-500 flex-shrink-0 mt-0.5">·</span>
            Losses arising from fraudulent behavior by counterparties.
          </li>
          <li className="flex gap-2">
            <span className="text-rose-500 flex-shrink-0 mt-0.5">·</span>
            Indirect, consequential, or incidental damages of any kind.
          </li>
        </ul>
        <p>
          Our total liability in any circumstance is limited to the <strong className="text-neutral-200">1% fee</strong>{' '}
          collected on the transaction in question.
        </p>
      </div>
    ),
  },
  {
    icon: Mail,
    title: '7. Contact',
    body: (
      <div className="text-neutral-400 text-[13px] leading-relaxed space-y-2">
        <p>For any questions, concerns, or legal inquiries regarding these terms, contact us at:</p>
        <a
          href="mailto:Riahig45@gmail.com"
          className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors font-black text-sm"
        >
          <Mail size={13} />
          Riahig45@gmail.com
        </a>
      </div>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/[0.03] rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative max-w-lg mx-auto px-5 pb-20">
        {/* Back button */}
        <div className="pt-8 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-[12px] font-black tracking-wide"
          >
            <ArrowLeft size={14} />
            Back to PTrust Oracle
          </Link>
        </div>

        {/* Header */}
        <div className="mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/4 border border-white/8 text-neutral-500 text-[9px] font-black tracking-[0.2em] uppercase">
            <ShieldCheck size={11} className="text-amber-400" />
            PTrust Oracle
          </div>

          <div>
            <h1
              className="text-4xl font-black tracking-[-0.03em] leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Terms of{' '}
              <span className="text-transparent" style={{ WebkitTextStroke: '2px #f59e0b' }}>
                Service
              </span>
            </h1>
            <p className="text-[11px] text-neutral-600 mt-2 tracking-wide">
              Effective date: <span className="text-neutral-500">{EFFECTIVE_DATE}</span>
            </p>
          </div>

          <p className="text-neutral-400 text-sm leading-relaxed">
            Please read these terms carefully before using PTrust Oracle. By using the platform,
            you agree to all terms outlined below.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((sec, i) => {
            const Icon = sec.icon;
            return (
              <div
                key={i}
                className="bg-[#0d0d0d] border border-white/6 rounded-2xl overflow-hidden"
              >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-amber-400" />
                  </div>
                  <h2 className="text-[13px] font-black text-white">{sec.title}</h2>
                </div>
                <div className="px-5 py-4">{sec.body}</div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-neutral-700 mt-10 leading-relaxed">
          PTrust Oracle reserves the right to modify these terms at any time.
          The most current version will always be available at this URL.
        </p>
      </div>
    </main>
  );
}
