'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, Database, Globe, UserCheck, Mail } from 'lucide-react';

const EFFECTIVE_DATE = 'March 18, 2026';

interface Section {
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    icon: Database,
    title: 'Information We Collect',
    body: (
      <ul className="space-y-2 text-neutral-400 text-[13px] leading-relaxed">
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>Your <strong className="text-neutral-200">Pi Network username</strong> — obtained via the Pi SDK during authentication.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span><strong className="text-neutral-200">Transaction data</strong> — escrow amounts, fees, statuses, and timestamps.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span><strong className="text-neutral-200">Escrow details</strong> — seller wallet addresses, deal descriptions, and dispute reasons you provide.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span><strong className="text-neutral-200">Hashed keys</strong> — Buyer and Seller keys stored as one-way bcrypt hashes only. We can never recover plain-text keys.</li>
      </ul>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'How We Use Information',
    body: (
      <ul className="space-y-2 text-neutral-400 text-[13px] leading-relaxed">
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>To <strong className="text-neutral-200">process and track escrow transactions</strong> between buyers and sellers.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>To <strong className="text-neutral-200">resolve disputes</strong> by providing context to neutral judges.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>To <strong className="text-neutral-200">calculate and collect</strong> the 1% platform fee upon fund release.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>We <strong className="text-rose-400">never</strong> sell, rent, or share your data with third-party advertisers or data brokers.</li>
      </ul>
    ),
  },
  {
    icon: Lock,
    title: 'Data Storage & Security',
    body: (
      <div className="space-y-3 text-neutral-400 text-[13px] leading-relaxed">
        <p>All data is stored on <strong className="text-neutral-200">MongoDB Atlas</strong> with encryption at rest. Buyer and Seller keys are hashed using <strong className="text-neutral-200">bcrypt</strong> before storage — plain-text keys are never persisted.</p>
        <p>Access to our database is restricted to authenticated server-side API routes only. No client-side code has direct database access.</p>
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 text-[11px]">
          ✓ &nbsp; We <strong>never</strong> store private keys in plain text — ever.
        </div>
      </div>
    ),
  },
  {
    icon: Globe,
    title: 'Third-Party Services',
    body: (
      <ul className="space-y-2 text-neutral-400 text-[13px] leading-relaxed">
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span><strong className="text-neutral-200">Pi Network SDK</strong> — used for user authentication and Pi payment processing. Subject to Pi Network's own privacy policy.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span><strong className="text-neutral-200">Stellar Blockchain</strong> — all Pi transactions are settled on the public Stellar ledger. Transaction hashes are publicly visible by design.</li>
        <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0 mt-0.5">·</span><strong className="text-neutral-200">Kraken / CoinGecko</strong> — public price APIs are used for the live Pi price ticker. No personal data is sent to these services.</li>
      </ul>
    ),
  },
  {
    icon: UserCheck,
    title: 'Your Rights',
    body: (
      <div className="space-y-3 text-neutral-400 text-[13px] leading-relaxed">
        <p>You have the right to request deletion of your account data. To do so, contact us at the email below with your Pi username and a description of the data you wish removed.</p>
        <p>We will process deletion requests within <strong className="text-neutral-200">14 business days</strong>, subject to retention requirements for active escrow transactions.</p>
      </div>
    ),
  },
  {
    icon: Mail,
    title: 'Contact',
    body: (
      <div className="text-neutral-400 text-[13px] leading-relaxed space-y-2">
        <p>For any privacy-related questions or data deletion requests, please reach out to:</p>
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

export default function PrivacyPage() {
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
              Privacy{' '}
              <span className="text-transparent" style={{ WebkitTextStroke: '2px #f59e0b' }}>
                Policy
              </span>
            </h1>
            <p className="text-[11px] text-neutral-600 mt-2 tracking-wide">
              Effective date: <span className="text-neutral-500">{EFFECTIVE_DATE}</span>
            </p>
          </div>

          <p className="text-neutral-400 text-sm leading-relaxed">
            PTrust Oracle ("we", "us") is committed to protecting your privacy. This policy explains
            what data we collect, how we use it, and your rights.
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
          PTrust Oracle reserves the right to update this policy at any time.
          Continued use of the platform constitutes acceptance of the updated policy.
        </p>
      </div>
    </main>
  );
}
