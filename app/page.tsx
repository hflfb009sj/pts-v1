'use client';

import React, {
  useState, useEffect, useMemo, useCallback, useRef,
} from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import {
  ShieldCheck, Wallet, AlertCircle, CheckCircle2, ArrowRight, Lock, Zap,
  Copy, Share2, Key, Package, ClipboardList, Star, BarChart3, AlertTriangle,
  ChevronDown, LogOut, Clock, Mail, Shield, Hash, TrendingUp, Activity,
  Eye, EyeOff, RefreshCw, XCircle, FileText, Users, Info, MessageCircle, Send, User, Search, X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface PiUser { uid: string; username: string; }

type TxStatus =
  | 'PENDING' | 'ACCEPTED' | 'DELIVERED' | 'FROZEN'
  | 'UNDER_REVIEW' | 'RELEASED' | 'REFUNDED' | 'PENDING_ADMIN' | 'EXPIRED';

interface Transaction {
  _id: string;
  transactionNumber: string;
  escrowCode: string;
  sellerWallet: string;
  buyerUsername: string;
  sellerUsername?: string;
  amount: number;
  fee: number;
  description: string;
  status: TxStatus;
  createdAt: string;
  deliveredAt?: string;
  frozenAt?: string;
  releasedAt?: string;
  rating?: number;
  sellerTxHash?: string;
}

interface EscrowResult {
  transactionNumber: string;
  escrowCode: string;
  buyerKey: string;
  sellerKey: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API HELPER
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch(url: string, body?: object) {
  const opts: RequestInit = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' };
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST SCORE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function calculateTrustScore(transactions: Transaction[]): { score: number; level: string; color: string; details: string[]; disputed: number } {
  let score = 50; // base score
  const details = [];
  
  const completed = transactions.filter(t => t.status === 'RELEASED').length;
  const disputed = transactions.filter(t => ['FROZEN', 'UNDER_REVIEW', 'PENDING_ADMIN'].includes(t.status)).length;
  const refunded = transactions.filter(t => t.status === 'REFUNDED').length;
  const total = transactions.length;
  const ratings = transactions.filter(t => t.rating).map(t => t.rating as number);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  
  // Positive factors
  if (completed >= 1) { score += 10; details.push('+10 First completed deal'); }
  if (completed >= 5) { score += 10; details.push('+10 Trusted trader (5+ deals)'); }
  if (completed >= 20) { score += 10; details.push('+10 Elite merchant (20+ deals)'); }
  if (avgRating >= 4.5) { score += 10; details.push('+10 Excellent ratings'); }
  if (avgRating >= 3) { score += 5; details.push('+5 Good ratings'); }
  
  // Negative factors
  if (disputed > 0) { score -= disputed * 10; details.push('-' + (disputed * 10) + ' Active disputes'); }
  if (refunded > 0) { score -= refunded * 5; details.push('-' + (refunded * 5) + ' Refunded deals'); }
  
  score = Math.max(0, Math.min(100, score));
  
  let level = '';
  let color = '';
  if (score >= 71) { level = 'High Trust'; color = 'text-emerald-400'; }
  else if (score >= 41) { level = 'Medium Trust'; color = 'text-amber-400'; }
  else { level = 'Low Trust'; color = 'text-rose-400'; }
  
  return { score, level, color, details, disputed };
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TIMER HOOK — 30-minute inactivity logout
// ─────────────────────────────────────────────────────────────────────────────
function useSessionTimer(onExpire: () => void, active: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onExpire, 30 * 60 * 1000);
  }, [onExpire]);

  useEffect(() => {
    if (!active) return;
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset, active]);
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const inputBase =
  'w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 ' +
  'focus:border-amber-500/50 outline-none text-sm transition-all ' +
  'placeholder-neutral-700 text-neutral-200';

const STATUS_MAP: Record<TxStatus, { bg: string; dot: string; label: string }> = {
  PENDING:       { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/25',       dot: 'bg-amber-400',   label: 'Pending'      },
  ACCEPTED:      { bg: 'bg-orange-500/10 text-orange-400 border-orange-500/25',    dot: 'bg-orange-400',  label: 'Accepted'     },
  DELIVERED:     { bg: 'bg-sky-500/10 text-sky-400 border-sky-500/25',             dot: 'bg-sky-400',     label: 'Delivered'    },
  FROZEN:        { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/25',          dot: 'bg-blue-400',    label: 'Frozen'       },
  UNDER_REVIEW:  { bg: 'bg-violet-500/10 text-violet-400 border-violet-500/25',    dot: 'bg-violet-400',  label: 'Under Review' },
  RELEASED:      { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', label: 'Released'     },
  REFUNDED:      { bg: 'bg-sky-500/10 text-sky-400 border-sky-500/25',             dot: 'bg-sky-400',     label: 'Refunded'     },
  PENDING_ADMIN: { bg: 'bg-violet-500/10 text-violet-400 border-violet-500/25',    dot: 'bg-violet-400',  label: 'Admin Review' },
  EXPIRED:       { bg: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/25', dot: 'bg-neutral-500', label: 'Expired'      },
};

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TxStatus }) {
  const s = STATUS_MAP[status] || STATUS_MAP.PENDING;
  return (
    <span className={'inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ' + s.bg}>
      <span className={'w-1.5 h-1.5 rounded-full ' + s.dot} />
      {s.label}
    </span>
  );
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className={
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ' +
        (ok
          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
          : 'bg-white/5 border border-white/8 text-neutral-500 hover:text-white hover:bg-white/10')
      }>
      {ok ? <CheckCircle2 size={11} /> : <Copy size={11} />}
      {ok ? 'Copied!' : (label ?? 'Copy')}
    </button>
  );
}

function Spin() {
  return <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={'bg-[#0d0d0d] border border-white/6 rounded-2xl ' + className}>
      {children}
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="flex gap-2.5 text-rose-400 text-[11px] p-3.5 bg-rose-500/5 border border-rose-500/15 rounded-xl leading-relaxed">
      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {msg}
    </div>
  );
}

function OkBox({ msg }: { msg: string }) {
  return (
    <div className="flex gap-2.5 text-emerald-400 text-[11px] p-3.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl leading-relaxed">
      <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" /> {msg}
    </div>
  );
}

function InfoBanner({ msg, color = 'amber' }: { msg: string; color?: 'amber' | 'blue' | 'sky' }) {
  const c = {
    amber: 'text-amber-400 bg-amber-500/5 border-amber-500/15',
    blue:  'text-blue-400 bg-blue-500/5 border-blue-500/15',
    sky:   'text-sky-400 bg-sky-500/5 border-sky-500/15',
  }[color];
  return (
    <div className={'text-[11px] font-medium p-3.5 rounded-xl border leading-relaxed flex gap-2 ' + c}>
      <Info size={12} className="flex-shrink-0 mt-0.5" /> {msg}
    </div>
  );
}

function SecHead({ Icon, title, sub }: { Icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-amber-400" />
      </div>
      <div>
        <h2 className="text-base font-black text-white">{title}</h2>
        {sub && <p className="text-[11px] text-neutral-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PrimaryBtn({
  children, disabled, onClick, type = 'button', variant = 'gold',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'gold' | 'white' | 'ghost' | 'danger';
}) {
  const s = {
    gold:   'bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300 shadow-[0_8px_32px_rgba(245,158,11,0.2)]',
    white:  'bg-white text-black hover:bg-amber-50',
    ghost:  'bg-white/5 border border-white/10 text-white hover:bg-white/10',
    danger: 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/15',
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={
        'w-full py-3.5 font-black rounded-xl transition-all duration-200 ' +
        'active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed ' +
        'flex items-center justify-center gap-2 text-[12px] tracking-wide ' + s
      }>
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <label className="text-[9px] uppercase font-black tracking-[0.15em] text-amber-500/80">{label}</label>
        {hint && <span className="text-[9px] text-neutral-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stars({ value, onRate }: { value?: number; onRate?: (n: number) => void }) {
  const [hov, setHov] = useState(0);
  const [sel, setSel] = useState(value || 0);
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          disabled={!onRate}
          onMouseEnter={() => onRate && setHov(n)}
          onMouseLeave={() => onRate && setHov(0)}
          onClick={() => { if (onRate) { setSel(n); onRate(n); } }}
          className="transition-all hover:scale-110 disabled:cursor-default">
          <Star
            size={18}
            className={n <= (hov || sel) ? 'text-amber-400' : 'text-neutral-700'}
            fill={n <= (hov || sel) ? 'currentColor' : 'none'}
          />
        </button>
      ))}
    </div>
  );
}

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'rounded-2xl border overflow-hidden ' + (open ? 'border-amber-500/20' : 'border-white/6 bg-[#0d0d0d]')}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 gap-3 text-left">
        <span className="text-[12px] font-black text-neutral-200 leading-snug">{q}</span>
        <span className={'w-6 h-6 rounded-lg flex items-center justify-center text-sm transition-transform flex-shrink-0 ' +
          (open ? 'bg-amber-500/15 text-amber-400 rotate-45' : 'bg-white/5 text-neutral-500')}>+</span>
      </button>
      {open && <div className="px-5 pb-4 text-[11px] text-neutral-500 leading-relaxed border-t border-white/5 pt-3">{a}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC CONTENT
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', who: 'Buyer',  color: '#f59e0b', title: 'Create Escrow',
    body: 'Buyer pays via Pi Browser. Receives a private Buyer Key (keep it!) and a Seller Key to share with the seller.' },
  { n: '02', who: 'Seller', color: '#38bdf8', title: 'Accept Deal',
    body: 'Seller enters the Escrow Code and their Seller Key. Reviews terms and accepts. Funds stay locked.' },
  { n: '03', who: 'Seller', color: '#38bdf8', title: 'Confirm Delivery',
    body: 'Seller ships the item or completes the service, then presses Confirm Delivery.' },
  { n: '04', who: 'Buyer',  color: '#22c55e', title: 'Release or Dispute',
    body: '"Received" + Buyer Key → funds released instantly to seller.\n"Not Received" → funds freeze and a dispute opens.' },
  { n: '05', who: 'System', color: '#a78bfa', title: 'Auto-Resolution',
    body: 'If buyer ignores delivery for 15 days, funds auto-release to seller. Disputes are resolved by 3 neutral judges (2/3 majority).' },
];

const CATS = [
  { e: '📱', t: 'Electronics',     d: 'Phones, laptops, cameras',      tags: ['Phones', 'Laptops', 'Cameras']  },
  { e: '💎', t: 'Jewelry & Watches', d: 'Verify before releasing',      tags: ['Gold', 'Watches', 'Diamonds']   },
  { e: '🛍️', t: 'General Goods',   d: 'Clothing, furniture, etc.',     tags: ['Clothing', 'Furniture', 'Sports']},
  { e: '💻', t: 'Digital Services', d: 'Design, dev, content',          tags: ['Design', 'Dev', 'Content']      },
  { e: '🏗️', t: 'Milestone Projects', d: 'Pay per milestone',          tags: ['Websites', 'Apps', 'Projects']  },
  { e: '🎮', t: 'Gaming & Accounts', d: 'Accounts, items, keys',        tags: ['Accounts', 'Items', 'Codes']    },
];

const FAQS = [
  { q: 'Are my funds safe if the website is hacked?',
    a: 'Yes. Funds live on the Pi blockchain — not on our servers. Even if the site is compromised, nobody can move funds without your Buyer Key.' },
  { q: 'What is the difference between Buyer Key and Seller Key?',
    a: 'Buyer Key is yours alone — used to release funds or confirm receipt. Seller Key belongs to the seller — used to accept the deal. Neither party can act without their own key.' },
  { q: 'What happens if I lose my Buyer Key?',
    a: 'The key is shown only once. Save it immediately. If lost, contact support with proof of ownership and we will assist through the dispute resolution system.' },
  { q: 'What does PTrust Oracle charge?',
    a: 'Only 1% of the transaction amount, deducted automatically at release. No hidden fees, no setup costs.' },
  { q: 'Who selects the judges?',
    a: '3 judges are randomly selected from verified Pi pioneers with full KYC and no relation to the deal. Majority vote (2 of 3) decides the outcome.' },
  { q: 'What if the seller never delivers?',
    a: 'Open a dispute after the seller confirms delivery. Submit evidence within 15 days. Judges review and rule. If seller wins by default (no buyer evidence), funds auto-release after 15 days.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE (not logged in)
// ─────────────────────────────────────────────────────────────────────────────
function Landing({ onLogin, loading }: { onLogin: () => void; loading: boolean }) {
  const [section, setSection] = useState<string | null>(null);

  // ── Pi Price Ticker ──
  const [piPrice, setPiPrice]         = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState<'Kraken' | 'CoinGecko'>('Kraken');
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrice() {
      setPriceLoading(true);
      try {
        // Primary: Kraken
        const res  = await fetch('https://api.kraken.com/0/public/Ticker?pair=PIUSD');
        const data = await res.json();
        const ticker = data?.result?.PIUSD ?? data?.result?.['PI/USD'];
        const price  = ticker ? parseFloat(ticker.c[0]) : NaN;
        if (!cancelled && !isNaN(price)) {
          setPiPrice(price);
          setPriceSource('Kraken');
          return;
        }
      } catch { /* fall through */ }
      try {
        // Fallback: CoinGecko
        const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd');
        const data = await res.json();
        const price = data?.['pi-network']?.usd;
        if (!cancelled && price) {
          setPiPrice(price);
          setPriceSource('CoinGecko');
        }
      } catch { /* give up */ }
      if (!cancelled) setPriceLoading(false);
    }
    fetchPrice().finally(() => { if (!cancelled) setPriceLoading(false); });
    const interval = setInterval(fetchPrice, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);


  const sections = [
    {
      key: 'how',
      icon: '🔄',
      title: 'How It Works',
      sub: '5 steps that protect every deal',
      content: (
        <div>
          {STEPS.map((s, i) => (
            <div key={i} className={'flex gap-4 items-start py-3.5 ' + (i < STEPS.length - 1 ? 'border-b border-white/4' : '')}>
              <div className="w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                style={{ background: s.color + '12', borderColor: s.color + '30', color: s.color }}>
                {s.n}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-black text-white">{s.title}</span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: s.color + '12', color: s.color }}>{s.who}</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed whitespace-pre-line">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'use',
      icon: '🛍️',
      title: 'What Can I Secure?',
      sub: '6 supported categories',
      content: (
        <div className="space-y-2">
          {CATS.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/2 border border-white/4">
              <span className="text-2xl flex-shrink-0">{c.e}</span>
              <div>
                <div className="text-[12px] font-black text-white">{c.t}</div>
                <div className="text-[10px] text-neutral-600 mt-0.5">{c.d}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.tags.map(t => (
                    <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-white/4 border border-white/6 text-neutral-600">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'dispute',
      icon: '⚖️',
      title: 'Dispute System',
      sub: '3 neutral judges · 15-day window · guaranteed resolution',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { e: '❌', l: 'Not Received',   sub: 'Instant freeze', c: '#ef4444' },
              { e: '📋', l: '15-Day Evidence', sub: 'Both parties',   c: '#f59e0b' },
              { e: '⚖️', l: 'Secret Vote',    sub: '2/3 decides',    c: '#22c55e' },
            ].map(b => (
              <div key={b.l} className="rounded-xl p-3 text-center"
                style={{ background: b.c + '0d', border: '1px solid ' + b.c + '25' }}>
                <div className="text-xl mb-1">{b.e}</div>
                <div className="text-[10px] font-black" style={{ color: b.c }}>{b.l}</div>
                <div className="text-[9px] text-neutral-600 mt-0.5">{b.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3.5 bg-amber-500/4 border border-amber-500/15">
              <div className="text-[11px] font-black text-amber-400 mb-2">Buyer</div>
              {['Funds locked before delivery', 'Buyer Key known only to you', '"Not Received" freezes instantly', '15 days to submit proof'].map(t => (
                <div key={t} className="flex items-start gap-1.5 text-[10px] text-neutral-600 mb-1">
                  <span className="text-emerald-500 flex-shrink-0">✓</span>{t}
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3.5 bg-sky-500/4 border border-sky-500/15">
              <div className="text-[11px] font-black text-sky-400 mb-2">Seller</div>
              {['Funds confirmed before shipment', 'Seller Key proves acceptance', '15-day silence = auto-release', 'Judge protection against fraud'].map(t => (
                <div key={t} className="flex items-start gap-1.5 text-[10px] text-neutral-600 mb-1">
                  <span className="text-emerald-500 flex-shrink-0">✓</span>{t}
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'faq',
      icon: '❓',
      title: 'FAQ',
      sub: 'Common questions answered',
      content: <div className="space-y-2">{FAQS.map((f, i) => <Accordion key={i} q={f.q} a={f.a} />)}</div>,
    },
  ];

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.012]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative max-w-sm mx-auto px-5 pb-16">
        {/* Hero */}
        <div className="flex flex-col items-center text-center pt-14 pb-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/4 border border-white/8 text-neutral-500 text-[9px] font-black tracking-[0.2em] uppercase">
            <ShieldCheck size={11} className="text-amber-400" /> Pi Network Mainnet · Secured
          </div>

          <div>
            <h1 className="text-[76px] font-black tracking-[-0.04em] leading-none" style={{ fontFamily: "'Georgia', serif" }}>
              P<span className="text-transparent" style={{ WebkitTextStroke: '2.5px #f59e0b' }}>TRUST</span>
            </h1>
            <p className="text-[10px] tracking-[0.6em] text-neutral-600 uppercase mt-1">Oracle · Escrow Protocol</p>
          </div>

          <p className="text-neutral-400 text-sm leading-relaxed max-w-[280px]">
            Lock funds · verify delivery · release with confidence.<br />
            The most secure escrow protocol on Pi Network.
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {[{ v: '0%', l: 'Fraud Rate' }, { v: '1%', l: 'Platform Fee' }, { v: '24/7', l: 'Active' }].map(s => (
              <div key={s.l} className="bg-[#0d0d0d] border border-white/6 rounded-xl py-3.5 text-center">
                <div className="text-xl font-black text-amber-400">{s.v}</div>
                <div className="text-[9px] text-neutral-600 uppercase tracking-wider mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          {/* ── Pi Price Ticker ── */}
          <div className="w-full rounded-2xl border border-amber-500/20 bg-[#0d0d0d] overflow-hidden relative">
            {/* subtle gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between px-5 py-4">
              {/* Left: logo + price */}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0 shadow-[0_0_18px_rgba(245,158,11,0.18)]">
                  <span className="text-2xl font-black text-amber-400" style={{ fontFamily: "'Georgia', serif", lineHeight: 1 }}>π</span>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-black tracking-[0.2em] text-neutral-600 mb-0.5">Pi / USD</div>
                  {priceLoading ? (
                    <div className="h-7 w-24 rounded-lg bg-white/6 animate-pulse" />
                  ) : (
                    <div className="text-2xl font-black text-amber-400 tracking-tight">
                      {piPrice !== null ? `$${piPrice.toFixed(4)}` : '—'}
                    </div>
                  )}
                </div>
              </div>
              {/* Right: live badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
                <span className="text-[9px] font-black text-amber-400 tracking-wider">
                  Live · {priceSource}
                </span>
              </div>
            </div>
          </div>

          {/* ── Pi Consensus Value ── */}
          <div className="w-full rounded-2xl border border-violet-500/20 bg-[#0d0d0d] overflow-hidden relative">
            {/* gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-amber-950/20 pointer-events-none" />
            <div className="relative flex items-center gap-4 px-5 py-4">
              {/* Left: π icon tile */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#7c3aed33,#f59e0b22)', border: '1px solid #7c3aed40', boxShadow: '0 0 18px rgba(124,58,237,0.15)' }}>
                <span className="text-2xl font-black" style={{ fontFamily: "'Georgia', serif", lineHeight: 1, background: 'linear-gradient(135deg,#a78bfa,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>π</span>
              </div>
              {/* Right: value block */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] uppercase font-black tracking-[0.2em] text-neutral-600">Pi Consensus Value</span>
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 tracking-wider">GCV</span>
                </div>
                <div className="text-xl font-black tracking-tight" style={{ background: 'linear-gradient(90deg,#fbbf24,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  1 π = 314,159 GCV
                </div>
                <div className="text-[9px] text-neutral-600 mt-0.5">Community Consensus · Global Currency Value</div>
              </div>
            </div>
            <div className="px-5 pb-3">
              <p className="text-[9px] text-neutral-700 leading-relaxed">Based on Pi Network community consensus</p>
            </div>
          </div>

          <button
            onClick={onLogin}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black rounded-xl transition-all active:scale-[0.98] hover:from-amber-400 shadow-[0_12px_40px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2.5 text-sm disabled:opacity-50">
            <Wallet size={17} />
            {loading ? 'Authenticating…' : 'Connect Pi Wallet'}
            {!loading && <ArrowRight size={15} />}
          </button>

          <div className="flex items-center justify-center gap-5">
            {[
              { I: Shield, t: 'Blockchain Protected' },
              { I: Lock,   t: 'Your Key Only'         },
              { I: Users,  t: 'Neutral Judges'         },
            ].map(({ I, t }) => (
              <div key={t} className="flex items-center gap-1.5 text-[10px] text-neutral-600">
                <I size={10} className="text-amber-500/50 flex-shrink-0" />{t}
              </div>
            ))}
          </div>
        </div>

        {/* Expandable sections */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1 pb-1">
            <div className="h-px flex-1 bg-white/6" />
            <span className="text-[9px] font-black tracking-[0.25em] uppercase text-neutral-700">Learn More</span>
            <div className="h-px flex-1 bg-white/6" />
          </div>
          {sections.map(sec => (
            <div key={sec.key}
              className={'rounded-2xl border overflow-hidden transition-all bg-[#0d0d0d] ' + (section === sec.key ? 'border-amber-500/20' : 'border-white/6')}>
              <button
                onClick={() => setSection(section === sec.key ? null : sec.key)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                    <span className="text-base">{sec.icon}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-[12px] font-black text-white">{sec.title}</div>
                    <div className="text-[10px] text-neutral-600">{sec.sub}</div>
                  </div>
                </div>
                <ChevronDown size={14} className={'text-neutral-600 transition-transform duration-200 ' + (section === sec.key ? 'rotate-180' : '')} />
              </button>
              {section === sec.key && (
                <div className="border-t border-white/5 px-4 pb-5 pt-4">{sec.content}</div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 space-y-4">
          <button
            onClick={onLogin}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black rounded-xl active:scale-[0.98] shadow-[0_12px_40px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2.5 text-sm disabled:opacity-50">
            <Wallet size={17} />
            {loading ? 'Authenticating…' : 'Get Started — Connect Pi Wallet'}
          </button>
          <p className="text-center text-[10px] text-neutral-700">
            Support: <span className="text-amber-500/60">Riahig45@gmail.com</span>
          </p>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUYER TAB
// ─────────────────────────────────────────────────────────────────────────────
function BuyerTab({ user }: { user: PiUser }) {
  // Create escrow state
  const [sellerWallet, setSellerWallet] = useState('');
  const [sellerTrustScore, setSellerTrustScore] = useState<number | null>(null);
  const [amount, setAmount]             = useState('');
  const [desc, setDesc]                 = useState('');

  useEffect(() => {
    if (!sellerWallet || sellerWallet.length < 10) {
      setSellerTrustScore(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/escrow/transactions?username=' + encodeURIComponent(sellerWallet));
        const data = await res.json();
        if (data.success && data.transactions.length > 0) {
          setSellerTrustScore(calculateTrustScore(data.transactions).score);
        } else {
          setSellerTrustScore(null);
        }
      } catch {
        setSellerTrustScore(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [sellerWallet]);
  const [creating, setCreating]         = useState(false);
  const [createErr, setCreateErr]       = useState<string | null>(null);
  const [result, setResult]             = useState<EscrowResult | null>(null);
  const [showBK, setShowBK]             = useState(false);
  const [showSK, setShowSK]             = useState(false);

  // Release state
  const [relCode, setRelCode]       = useState('');
  const [relKey, setRelKey]         = useState('');
  const [relConfirm, setRelConfirm] = useState('');
  const [relLoading, setRelLoading] = useState(false);
  const [relErr, setRelErr]         = useState<string | null>(null);
  const [relOk, setRelOk]           = useState<string | null>(null);

  // Dispute state
  const [disCode, setDisCode]       = useState('');
  const [disReason, setDisReason]   = useState('');
  const [disLoading, setDisLoading] = useState(false);
  const [disErr, setDisErr]         = useState<string | null>(null);
  const [disOk, setDisOk]           = useState<string | null>(null);

  // Evidence state
  const [evCode, setEvCode]       = useState('');
  const [evText, setEvText]       = useState('');
  const [evLoading, setEvLoading] = useState(false);
  const [evErr, setEvErr]         = useState<string | null>(null);
  const [evOk, setEvOk]           = useState(false);

  const fee = useMemo(() => {
    const v = parseFloat(amount);
    return isNaN(v) || v <= 0 ? 0 : v * 0.01;
  }, [amount]);

  // Create escrow via Pi.createPayment
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setCreateErr(null); setResult(null);
    try {
      const win = window as any;
      if (!win.Pi) throw new Error('Open this app in Pi Browser');

      const total = parseFloat(amount) + fee;
      let pending: EscrowResult | null = null;

      await new Promise<void>((resolve, reject) => {
        win.Pi.createPayment(
          {
            amount: total,
            memo:   ('PTrust: ' + (desc || 'Escrow')).substring(0, 28),
            metadata: { seller: sellerWallet, buyer: user.username },
          },
          {
            onReadyForServerApproval: async (paymentId: string) => {
              try {
                const res = await apiFetch('/api/escrow/create', {
                  paymentId,
                  sellerWallet,
                  amount:      parseFloat(amount),
                  fee,
                  description: desc || 'No description',
                  buyerUsername: user.username,
                });
                pending = {
                  transactionNumber: res.transactionNumber,
                  escrowCode:        res.escrowCode,
                  buyerKey:          res.buyerKey,
                  sellerKey:         res.sellerKey,
                };
              } catch (err: any) { reject(err); }
            },
            onReadyForServerCompletion: async (paymentId: string, txid: string) => {
              try {
                await apiFetch('/api/escrow/finalize', { paymentId, txid });
                setResult(pending);
                setAmount(''); setSellerWallet(''); setDesc('');
                resolve();
              } catch (err: any) { reject(err); }
            },
            onCancel: () => reject(new Error('Payment cancelled')),
            onError:  (err: Error) => reject(err),
          }
        );
      });
    } catch (err: any) {
      setCreateErr(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setRelLoading(true); setRelErr(null); setRelOk(null);
    try {
      await apiFetch('/api/escrow/release', {
        escrowCode:  relCode.toUpperCase(),
        buyerKey:    relKey,
        confirmText: relConfirm,
        buyerUsername: user.username,
      });
      setRelOk('Funds released successfully! They are on their way to the seller.');
      setRelCode(''); setRelKey(''); setRelConfirm('');
    } catch (err: any) { setRelErr(err.message); }
    finally { setRelLoading(false); }
  };

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisLoading(true); setDisErr(null); setDisOk(null);
    try {
      const res = await apiFetch('/api/escrow/dispute', {
        escrowCode:   disCode.toUpperCase(),
        buyerUsername: user.username,
        reason:        disReason,
      });
      setDisOk('Dispute opened. Funds frozen. Evidence deadline: ' +
        new Date(res.evidenceDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      setDisCode(''); setDisReason('');
    } catch (err: any) { setDisErr(err.message); }
    finally { setDisLoading(false); }
  };

  const handleEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvLoading(true); setEvErr(null); setEvOk(false);
    try {
      await apiFetch('/api/escrow/evidence', {
        escrowCode: evCode.toUpperCase(),
        username:   user.username,
        content:    evText,
      });
      setEvOk(true); setEvText('');
    } catch (err: any) { setEvErr(err.message); }
    finally { setEvLoading(false); }
  };

  return (
    <div className="space-y-4">

      {/* ── Create Escrow ── */}
      {!result ? (
        <Card className="p-6">
          <SecHead Icon={Zap} title="Create Escrow" sub="You pay via Pi Browser. Each party gets their own key." />
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Seller Wallet Address">
              <input required placeholder="G…" value={sellerWallet}
                onChange={e => setSellerWallet(e.target.value)}
                className={inputBase} />
            </Field>

            {sellerTrustScore !== null && sellerTrustScore < 30 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 mt-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <p className="text-[11px] font-black">⚠️ Warning: This seller has a low trust score. Proceed with caution.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (Pi)">
                <input required type="number" min="1" max="100000" step="0.01" placeholder="0.00"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 text-amber-400 font-black text-xl focus:border-amber-500/50 outline-none transition-all placeholder-neutral-800" />
              </Field>
              <Field label="Fee (1%)" hint="auto">
                <div className="w-full bg-neutral-900/40 border border-white/4 rounded-xl py-3 px-4 text-neutral-500 font-black text-xl">
                  {fee > 0 ? fee.toFixed(3) : '—'}
                </div>
              </Field>
            </div>

            <Field label="Deal Terms" hint="optional">
              <textarea placeholder="Describe the goods or service being exchanged…"
                value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none text-sm resize-none transition-all placeholder-neutral-700 text-neutral-300" />
            </Field>

            {createErr && <ErrBox msg={createErr} />}

            <PrimaryBtn type="submit" disabled={creating || !amount || !sellerWallet}>
              {creating ? <><Spin /> Processing Payment…</> : <><Lock size={14} /> Lock Funds in Escrow</>}
            </PrimaryBtn>
          </form>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Success header */}
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={14} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-emerald-400">Escrow Created</h2>
              <p className="text-[10px] text-neutral-600">Keys shown only once — save them now</p>
            </div>
          </div>

          {/* TX Number */}
          <Card className="p-4">
            <div className="text-[9px] uppercase font-black tracking-[0.15em] text-neutral-600 mb-2 flex items-center gap-1">
              <Hash size={9} /> Transaction Number
            </div>
            <div className="text-sm font-black text-amber-400 font-mono tracking-wider mb-2">
              {result.transactionNumber}
            </div>
            <CopyBtn text={result.transactionNumber} label="Copy TX#" />
          </Card>

          {/* Escrow Code */}
          <Card className="p-4 border-amber-500/15">
            <div className="text-[9px] uppercase font-black tracking-[0.15em] text-amber-500/60 mb-2">
              Escrow Code — Share with Seller
            </div>
            <div className="text-3xl font-black text-amber-400 tracking-[0.15em] font-mono mb-3">
              {result.escrowCode}
            </div>
            <div className="flex gap-2 flex-wrap">
              <CopyBtn text={result.escrowCode} label="Copy Code" />
              <button
                onClick={() => {
                  const url = window.location.origin + '/escrow/' + result.escrowCode;
                  if (navigator.share) navigator.share({ title: 'PTrust Escrow', url });
                  else window.open('https://wa.me/?text=' + encodeURIComponent(url));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-black text-amber-400 hover:bg-amber-500/15 transition-colors">
                <Share2 size={11} /> Share
              </button>
            </div>
          </Card>

          {/* Buyer Key */}
          <Card className="p-4 border-amber-500/20 bg-amber-500/3">
            <div className="text-[9px] uppercase font-black tracking-[0.15em] text-amber-400/70 mb-2 flex items-center justify-between">
              <span>Your Buyer Key — Keep Private</span>
              <button onClick={() => setShowBK(!showBK)} className="text-neutral-600 hover:text-neutral-400 transition-colors">
                {showBK ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </div>
            <div className="text-base font-black text-white font-mono tracking-widest mb-1">
              {showBK ? result.buyerKey : 'BK-••••••••'}
            </div>
            <p className="text-[9px] text-amber-400/50 mb-2.5">
              Never share. Required to release funds or open a dispute.
            </p>
            <CopyBtn text={result.buyerKey} label="Copy Buyer Key" />
          </Card>

          {/* Seller Key */}
          <Card className="p-4 border-sky-500/20 bg-sky-500/3">
            <div className="text-[9px] uppercase font-black tracking-[0.15em] text-sky-400/70 mb-2 flex items-center justify-between">
              <span>Seller Key — Send to Seller</span>
              <button onClick={() => setShowSK(!showSK)} className="text-neutral-600 hover:text-neutral-400 transition-colors">
                {showSK ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </div>
            <div className="text-base font-black text-white font-mono tracking-widest mb-1">
              {showSK ? result.sellerKey : 'SK-••••••••'}
            </div>
            <p className="text-[9px] text-sky-400/50 mb-2.5">
              Share this with the seller — required to accept the deal.
            </p>
            <CopyBtn text={result.sellerKey} label="Copy Seller Key" />
          </Card>

          <InfoBanner msg="Send the Escrow Code AND Seller Key to the seller. Keep your Buyer Key private at all times." />

          <button
            onClick={() => { setResult(null); setShowBK(false); setShowSK(false); }}
            className="w-full py-3 text-neutral-600 text-xs font-black hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5">
            + Create Another Escrow
          </button>
        </div>
      )}

      {/* ── Release Funds ── */}
      <Card className="p-6">
        <SecHead Icon={CheckCircle2} title="Confirm Receipt" sub="Release funds after you receive the goods" />
        <form onSubmit={handleRelease} className="space-y-3">
          <Field label="Escrow Code">
            <input required placeholder="PTO-XXXXXX" value={relCode}
              onChange={e => setRelCode(e.target.value.toUpperCase())}
              className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none font-mono text-sm uppercase tracking-widest transition-all placeholder-neutral-700" />
          </Field>
          <Field label="Buyer Key">
            <input required placeholder="BK-XXXXXXXX" value={relKey}
              onChange={e => setRelKey(e.target.value)}
              className={inputBase} />
          </Field>
          <div className="bg-amber-500/4 border border-amber-500/15 rounded-xl p-3.5 space-y-2">
            <p className="text-[10px] text-amber-400/70 font-black">Type CONFIRM to authorize this irreversible release</p>
            <input placeholder="CONFIRM" value={relConfirm}
              onChange={e => setRelConfirm(e.target.value)}
              className="w-full bg-black/60 border border-amber-500/20 rounded-xl py-3 px-4 focus:border-amber-500/60 outline-none text-sm text-center font-black tracking-[0.3em] transition-all placeholder-neutral-700 text-amber-400" />
          </div>
          {relErr && <ErrBox msg={relErr} />}
          {relOk  && <OkBox  msg={relOk} />}
          <PrimaryBtn type="submit" variant="white"
            disabled={relLoading || !!relOk || relConfirm !== 'CONFIRM' || !relCode || !relKey}>
            {relLoading ? <><Spin /> Releasing…</> : 'Received — Release Funds to Seller'}
          </PrimaryBtn>
        </form>
      </Card>

      {/* ── Open Dispute ── */}
      <Card className="p-6">
        <SecHead Icon={XCircle} title="Not Received — Open Dispute" sub="Freeze funds and begin dispute process" />
        <form onSubmit={handleDispute} className="space-y-3">
          <Field label="Escrow Code">
            <input required placeholder="PTO-XXXXXX" value={disCode}
              onChange={e => setDisCode(e.target.value.toUpperCase())}
              className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 focus:border-rose-500/50 outline-none font-mono text-sm uppercase tracking-widest transition-all placeholder-neutral-700" />
          </Field>
          <Field label="Describe the Issue">
            <textarea required placeholder="What went wrong? Be specific…"
              value={disReason} onChange={e => setDisReason(e.target.value)} rows={3}
              className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 focus:border-rose-500/50 outline-none text-sm resize-none transition-all placeholder-neutral-700 text-neutral-300" />
          </Field>
          {disErr && <ErrBox msg={disErr} />}
          {disOk  && <OkBox  msg={disOk} />}
          <PrimaryBtn type="submit" variant="danger" disabled={disLoading || !!disOk}>
            {disLoading ? <><Spin /> Processing…</> : <><XCircle size={14} /> Freeze Funds &amp; Open Dispute</>}
          </PrimaryBtn>
        </form>
      </Card>

      {/* ── Submit Evidence ── */}
      <Card className="p-6">
        <SecHead Icon={FileText} title="Submit Evidence" sub="15-day window after dispute is opened" />
        <form onSubmit={handleEvidence} className="space-y-3">
          <Field label="Escrow Code">
            <input required placeholder="PTO-XXXXXX" value={evCode}
              onChange={e => setEvCode(e.target.value.toUpperCase())}
              className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none font-mono text-sm uppercase tracking-widest transition-all placeholder-neutral-700" />
          </Field>
          <Field label="Evidence" hint="max 5 items">
            <textarea required placeholder="URL, tracking number, description, or any supporting proof…"
              value={evText} onChange={e => setEvText(e.target.value)} rows={4}
              className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none text-sm resize-none transition-all placeholder-neutral-700 text-neutral-300" />
          </Field>
          {evErr && <ErrBox msg={evErr} />}
          {evOk  && <OkBox  msg="Evidence submitted successfully." />}
          <PrimaryBtn type="submit" variant="ghost" disabled={evLoading}>
            {evLoading ? <><Spin /> Submitting…</> : <><FileText size={14} /> Submit Evidence</>}
          </PrimaryBtn>
        </form>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SELLER TAB
// ─────────────────────────────────────────────────────────────────────────────
function SellerTab({ user }: { user: PiUser }) {
  const [code, setCode]       = useState('');
  const [key, setKey]         = useState('');
  const [tx, setTx]           = useState<Transaction | null>(null);
  const [buyerTrust, setBuyerTrust] = useState<{ level: string; color: string } | null>(null);
  const [err, setErr]         = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rated, setRated]     = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true); setErr(null); setTx(null); setBuyerTrust(null);
    try {
      const res = await fetch('/api/escrow/transaction/' + code.toUpperCase());
      const d   = await res.json();
      if (!d.success) throw new Error(d.error);
      const currTx = d.transaction;
      setTx(currTx);

      // Lookup buyer trust score
      if (currTx.buyerUsername) {
        try {
          const trustRes = await fetch('/api/escrow/transactions?username=' + encodeURIComponent(currTx.buyerUsername));
          const trustData = await trustRes.json();
          if (trustData.success && trustData.transactions) {
            const trustObj = calculateTrustScore(trustData.transactions);
            setBuyerTrust(trustObj);
          }
        } catch { /* ignore */ }
      }
    } catch (err: any) { setErr(err.message); }
    finally { setLoading(false); }
  };

  const accept = async () => {
    if (!tx || !key) { setErr('Enter your Seller Key'); return; }
    setLoading(true); setErr(null);
    try {
      await apiFetch('/api/escrow/accept', { escrowCode: tx.escrowCode, sellerUsername: user.username, sellerKey: key });
      setTx({ ...tx, status: 'ACCEPTED', sellerUsername: user.username });
      setKey('');
    } catch (err: any) { setErr(err.message); }
    finally { setLoading(false); }
  };

  const deliver = async () => {
    if (!tx) return;
    setLoading(true); setErr(null);
    try {
      await apiFetch('/api/escrow/complete', { escrowCode: tx.escrowCode, sellerUsername: user.username });
      setTx({ ...tx, status: 'DELIVERED' });
    } catch (err: any) { setErr(err.message); }
    finally { setLoading(false); }
  };

  const rate = async (n: number) => {
    if (!tx) return;
    try {
      await apiFetch('/api/escrow/rate', { escrowCode: tx.escrowCode, rating: n, raterUsername: user.username });
      setRated(true);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <SecHead Icon={Package} title="Seller Dashboard" sub="Enter your Escrow Code and Seller Key to manage your deal" />

        {!tx ? (
          <form onSubmit={lookup} className="space-y-4">
            <Field label="Escrow Code" hint="From buyer">
              <input required placeholder="PTO-XXXXXX" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full bg-black/60 border border-white/8 rounded-xl py-4 px-4 focus:border-amber-500/50 outline-none font-mono text-2xl text-center tracking-[0.2em] uppercase transition-all placeholder-neutral-800 text-amber-400" />
            </Field>
            <Field label="Seller Key" hint="From buyer">
              <input placeholder="SK-XXXXXXXX" value={key}
                onChange={e => setKey(e.target.value)}
                className={inputBase} />
            </Field>
            {err && <ErrBox msg={err} />}
            <PrimaryBtn type="submit" disabled={loading || !code}>
              {loading ? <><Spin /> Looking Up…</> : <><Key size={14} /> Find Escrow</>}
            </PrimaryBtn>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Deal details */}
            <div className="bg-black/40 rounded-xl p-4 space-y-3 border border-white/4">
              {[
                { l: 'TX Number',   v: <span className="font-black text-amber-400 font-mono text-xs">{tx.transactionNumber}</span> },
                { l: 'Escrow Code', v: <span className="font-black text-amber-400 font-mono">{tx.escrowCode}</span>              },
                { l: 'Amount',      v: <span className="font-black text-lg">{tx.amount} <span className="text-amber-400 text-sm">Pi</span></span> },
                { l: 'Buyer',       v: (
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm">@{tx.buyerUsername}</span>
                    {buyerTrust && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-1">
                        {buyerTrust.level === 'High Trust' ? '🟢 High' : buyerTrust.level === 'Medium Trust' ? '🟡 Medium' : '🔴 Low'}
                      </span>
                    )}
                  </div>
                )},
                { l: 'Status',      v: <StatusBadge status={tx.status} />                                                         },
              ].map(({ l, v }) => (
                <div key={l} className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-black tracking-widest text-neutral-600">{l}</span>
                  {v}
                </div>
              ))}
              {tx.description && (
                <div className="pt-1 border-t border-white/4">
                  <div className="text-[9px] uppercase font-black tracking-widest text-neutral-600 mb-1.5">Deal Terms</div>
                  <p className="text-sm text-neutral-300 leading-relaxed">{tx.description}</p>
                </div>
              )}
            </div>

            {/* Action area */}
            {tx.status === 'PENDING' && (
              <div className="space-y-3">
                <InfoBanner msg="Review deal terms above. Enter your Seller Key to accept and lock funds." />
                <Field label="Seller Key">
                  <input placeholder="SK-XXXXXXXX" value={key}
                    onChange={e => setKey(e.target.value)}
                    className={inputBase} />
                </Field>
                <PrimaryBtn onClick={accept} disabled={loading}>
                  {loading ? <><Spin /> Processing…</> : <><Shield size={14} /> Accept Deal</>}
                </PrimaryBtn>
              </div>
            )}

            {tx.status === 'ACCEPTED' && (
              <div className="space-y-3">
                <InfoBanner msg="Deal accepted. Deliver the goods or complete the service, then confirm below." />
                <PrimaryBtn onClick={deliver} disabled={loading}>
                  {loading ? <><Spin /> Processing…</> : <><Package size={14} /> Confirm Delivery Sent</>}
                </PrimaryBtn>
              </div>
            )}

            {tx.status === 'DELIVERED' && (
              <InfoBanner msg="Delivery confirmed. Waiting for buyer to release funds." color="sky" />
            )}

            {tx.status === 'FROZEN' && (
              <InfoBanner msg="Buyer opened a dispute. Submit your evidence in the Buyer tab within 15 days." color="blue" />
            )}

            {tx.status === 'UNDER_REVIEW' && (
              <InfoBanner msg="Judges are reviewing the evidence. A decision will be made soon." color="blue" />
            )}

            {tx.status === 'RELEASED' && (
              <div className="space-y-3">
                <OkBox msg={'Payment of ' + tx.amount + ' Pi released to your wallet.'} />
                {tx.sellerTxHash && (
                  <div className="text-[10px] text-neutral-600 break-all">
                    TxHash: <span className="text-neutral-500 font-mono">{tx.sellerTxHash}</span>
                  </div>
                )}
                {!rated && (
                  <Card className="p-4">
                    <p className="text-[10px] font-black text-neutral-500 mb-3">Rate this transaction</p>
                    <Stars onRate={rate} />
                  </Card>
                )}
                {rated && <OkBox msg="Thank you for rating!" />}
              </div>
            )}

            {tx.status === 'REFUNDED' && (
              <InfoBanner msg="Judges ruled in favor of the buyer. Funds have been refunded." color="blue" />
            )}

            {err && <ErrBox msg={err} />}

            <button
              onClick={() => { setTx(null); setCode(''); setKey(''); setErr(null); setRated(false); }}
              className="w-full py-3 text-neutral-600 text-xs font-black hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5">
              ← Look Up Another Escrow
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function TransactionsTab({
  user,
  onNavigate,
}: {
  user: PiUser;
  onNavigate: (tab: string, code?: string) => void;
}) {
  const [list, setList]     = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/escrow/transactions?username=' + user.username);
      const d   = await res.json();
      setList(d.transactions || []);
    } catch { setList([]); }
    finally { setLoading(false); }
  }, [user.username]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(tx =>
      (tx.escrowCode        || '').toLowerCase().includes(q) ||
      (tx.transactionNumber || '').toLowerCase().includes(q) ||
      (tx.buyerUsername     || '').toLowerCase().includes(q) ||
      (tx.sellerUsername    || '').toLowerCase().includes(q) ||
      (tx.description       || '').toLowerCase().includes(q)
    );
  }, [list, query]);

  const rate = async (escrowCode: string, n: number) => {
    try {
      await apiFetch('/api/escrow/rate', { escrowCode, rating: n, raterUsername: user.username });
      setList(prev => prev.map(t => t.escrowCode === escrowCode ? { ...t, rating: n } : t));
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-base font-black tracking-tight">My Deals</h2>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 hover:text-amber-400 transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
          <Search size={13} className="text-neutral-600" />
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by escrow code or username..."
          className="w-full bg-black/60 border border-white/8 rounded-xl py-2.5 pl-9 pr-9 text-sm focus:border-amber-500/50 outline-none transition-all placeholder-neutral-700 text-neutral-200"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-3 flex items-center text-neutral-600 hover:text-neutral-300 transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-7 w-7 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="text-center py-20 text-neutral-700">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-black text-sm">No transactions yet</p>
          <p className="text-xs mt-1 opacity-60">Create your first escrow in the Buyer tab</p>
        </div>
      )}

      {!loading && list.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-neutral-700">
          <Search size={28} className="mx-auto mb-3 opacity-30" />
          <p className="font-black text-sm">No results found</p>
          <p className="text-xs mt-1 opacity-60">Try a different escrow code or username</p>
        </div>
      )}

      {filtered.map(tx => (
        <Card key={tx._id} className="p-4 space-y-3 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-black text-amber-400 tracking-wider text-[11px] font-mono">
              {tx.transactionNumber || tx.escrowCode}
            </span>
            <StatusBadge status={tx.status} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-600 text-[11px]">Amount</span>
            <span className="font-black">{tx.amount} <span className="text-amber-400 text-xs">Pi</span></span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-600 text-[11px]">
              {tx.buyerUsername === user.username ? 'Role' : 'Role'}
            </span>
            <span className={'text-[11px] font-black px-2 py-0.5 rounded-full ' +
              (tx.buyerUsername === user.username ? 'bg-amber-500/10 text-amber-400' : 'bg-sky-500/10 text-sky-400')}>
              {tx.buyerUsername === user.username ? 'Buyer' : 'Seller'}
            </span>
          </div>

          {tx.description && (
            <p className="text-[10px] text-neutral-600 leading-relaxed border-t border-white/4 pt-2.5">
              {tx.description}
            </p>
          )}

          <div className="text-[9px] text-neutral-700 flex items-center gap-1">
            <Clock size={9} />
            {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>

          {/* Quick actions */}
          <div className="space-y-2">
            {tx.status === 'DELIVERED' && tx.buyerUsername === user.username && (
              <>
                <button
                  onClick={() => onNavigate('buyer', tx.escrowCode)}
                  className="w-full py-2.5 bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 font-black rounded-xl text-[11px] hover:bg-emerald-500/15 transition-all flex items-center justify-center gap-2">
                  <CheckCircle2 size={11} /> Received — Release Funds
                </button>
                <button
                  onClick={() => onNavigate('dispute', tx.escrowCode)}
                  className="w-full py-2.5 bg-rose-500/8 border border-rose-500/20 text-rose-400 font-black rounded-xl text-[11px] hover:bg-rose-500/15 transition-all flex items-center justify-center gap-2">
                  <XCircle size={11} /> Not Received — Dispute
                </button>
              </>
            )}
            {['FROZEN', 'UNDER_REVIEW'].includes(tx.status) && (
              <button
                onClick={() => onNavigate('evidence', tx.escrowCode)}
                className="w-full py-2.5 bg-blue-500/8 border border-blue-500/20 text-blue-400 font-black rounded-xl text-[11px] hover:bg-blue-500/15 transition-all flex items-center justify-center gap-2">
                <FileText size={11} /> Submit Evidence
              </button>
            )}
            {tx.status === 'RELEASED' && !tx.rating && (
              <div className="pt-0.5">
                <p className="text-[9px] text-neutral-600 mb-2">Rate this deal</p>
                <Stars onRate={n => rate(tx.escrowCode, n)} />
              </div>
            )}
            {tx.status === 'RELEASED' && tx.rating && (
              <div className="flex items-center gap-1 pt-0.5">
                <Stars value={tx.rating} />
                <span className="text-[9px] text-neutral-600 ml-1">Rated</span>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS TAB
// ─────────────────────────────────────────────────────────────────────────────
function StatsTab({ user }: { user: PiUser }) {
  const [list, setList]     = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/escrow/transactions?username=' + user.username);
        const d   = await res.json();
        setList(d.transactions || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [user.username]);

  const stats = useMemo(() => ({
    total:    list.length,
    released: list.filter(t => t.status === 'RELEASED').length,
    disputed: list.filter(t => ['FROZEN', 'UNDER_REVIEW'].includes(t.status)).length,
    totalPi:  list.filter(t => t.status === 'RELEASED').reduce((s, t) => s + t.amount, 0),
    asBuyer:  list.filter(t => t.buyerUsername === user.username).length,
    asSeller: list.filter(t => t.sellerUsername === user.username).length,
  }), [list, user.username]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-7 w-7 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-0.5">
        <h2 className="text-base font-black tracking-tight">Statistics</h2>
        <p className="text-[10px] text-neutral-600 mt-0.5">@{user.username}&apos;s trading overview</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { l: 'Total Deals',   v: stats.total,                      accent: 'text-white',       border: '',                     Icon: Activity      },
          { l: 'Completed',     v: stats.released,                   accent: 'text-emerald-400', border: 'border-emerald-500/10', Icon: CheckCircle2  },
          { l: 'Active Disputes', v: stats.disputed,                 accent: 'text-rose-400',    border: 'border-rose-500/10',   Icon: AlertTriangle },
          { l: 'Pi Transacted', v: stats.totalPi.toFixed(1) + ' π', accent: 'text-amber-400',   border: 'border-amber-500/10',  Icon: TrendingUp    },
        ].map(({ l, v, accent, border, Icon }) => (
          <Card key={l} className={'p-4 ' + border}>
            <Icon size={14} className={accent + ' opacity-60 mb-3'} />
            <div className={'text-2xl font-black ' + accent}>{v}</div>
            <div className="text-[9px] text-neutral-600 uppercase tracking-widest mt-1">{l}</div>
          </Card>
        ))}
      </div>

      {/* Role breakdown */}
      <Card className="p-5">
        <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-4">Role Breakdown</div>
        <div className="flex gap-3">
          <div className="flex-1 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-amber-400">{stats.asBuyer}</div>
            <div className="text-[9px] text-neutral-600 mt-1">As Buyer</div>
          </div>
          <div className="flex-1 bg-sky-500/5 border border-sky-500/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-sky-400">{stats.asSeller}</div>
            <div className="text-[9px] text-neutral-600 mt-1">As Seller</div>
          </div>
        </div>
      </Card>

      {/* Success rate */}
      {stats.total > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Success Rate</span>
            <span className="text-sm font-black text-emerald-400">
              {Math.round((stats.released / stats.total) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: (stats.released / stats.total * 100) + '%' }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-neutral-700 mt-2">
            <span>{stats.released} completed</span>
            <span>{stats.total - stats.released} pending / other</span>
          </div>
        </Card>
      )}

      {/* Support */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Mail size={13} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-black">Support</h3>
            <p className="text-[9px] text-neutral-600">Response within 24 hours</p>
          </div>
        </div>
        <PrimaryBtn variant="ghost"
          onClick={() => window.open('mailto:Riahig45@gmail.com?subject=PTrust Oracle Support')}>
          <Mail size={13} /> Contact Support
        </PrimaryBtn>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT TAB — Community messages for all users
// ─────────────────────────────────────────────────────────────────────────────
interface ChatMessage {
  _id?: string;
  username: string;
  text: string;
  createdAt: string;
}

function ChatTab({ username }: { username: string }) {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending]     = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const EMOJIS = ['😊', '👍', '🔒', '✅', '💰', '🤝', '🎉', '🚀', '💎', '🙏', '⭐', '🔥'];

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (data.success) setMessages(data.messages ?? []);
    } catch { /* ignore */ }
    finally { setChatLoading(false); }
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 30_000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Smooth scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Online users: unique usernames active in last 5 minutes
  const onlineUsers = useMemo(() => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const seen = new Set<string>();
    messages.forEach(m => {
      if (new Date(m.createdAt).getTime() >= fiveMinAgo) seen.add(m.username);
    });
    return seen.size;
  }, [messages]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || sending) return;
    setSending(true);
    setShowEmoji(false);
    try {
      const res  = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, text }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMessage('');
        await loadMessages();
      }
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') setShowEmoji(false);
  };

  const insertEmoji = (emoji: string) => {
    setNewMessage(prev => (prev + emoji).slice(0, 500));
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const remaining = 500 - newMessage.length;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={16} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">Community Chat</h2>
              {messages.length > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  {messages.length} msg{messages.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-500">PTrust Oracle Community</p>
          </div>
          {/* Online indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[9px] font-black text-emerald-400">
              {onlineUsers > 0 ? `${onlineUsers} online` : 'Live'}
            </span>
          </div>
        </div>

        {/* ── Messages area ── */}
        <div className="h-[400px] overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a transparent' }}>

          {/* Loading */}
          {chatLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full" />
              <p className="text-[11px] text-neutral-600">Loading messages…</p>
            </div>
          )}

          {/* Empty state with PTrust Oracle branding */}
          {!chatLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center">
                  <span className="text-3xl font-black" style={{ fontFamily: "'Georgia', serif", background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>P</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-[#0d0d0d] border border-amber-500/20 flex items-center justify-center">
                  <MessageCircle size={14} className="text-amber-400" />
                </div>
              </div>
              <div>
                <p className="text-sm font-black text-white">PTrust Oracle Community</p>
                <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
                  No messages yet.<br />Be the first to start the conversation!
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['🔒 Secure', '🤝 Trusted', '💰 Pi Network'].map(t => (
                  <span key={t} className="text-[9px] px-2.5 py-1 rounded-full bg-white/4 border border-white/6 text-neutral-600">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {!chatLoading && messages.map((msg, i) => {
            const isMe = msg.username === username;
            const initial = msg.username.charAt(0).toUpperCase();
            return (
              <div key={msg._id ?? i} className={'flex gap-2.5 items-end ' + (isMe ? 'flex-row-reverse' : '')}>
                {/* Avatar circle with first letter */}
                <div
                  className={'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black shadow-sm ' +
                    (isMe
                      ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black'
                      : 'bg-neutral-800 border border-white/10 text-neutral-400')}
                >
                  {initial}
                </div>

                {/* Bubble + meta */}
                <div className={'flex flex-col gap-1 max-w-[72%] ' + (isMe ? 'items-end' : 'items-start')}>
                  {/* Username label */}
                  <span className={'text-[9px] font-black tracking-wide px-1 ' + (isMe ? 'text-amber-400' : 'text-neutral-500')}>
                    {isMe ? 'You' : '@' + msg.username}
                  </span>
                  {/* Message bubble */}
                  <div
                    className={'text-[12px] leading-relaxed px-3.5 py-2.5 ' +
                      (isMe
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black font-medium rounded-2xl rounded-br-sm shadow-[0_4px_16px_rgba(245,158,11,0.2)]'
                        : 'bg-neutral-800 border border-white/8 text-neutral-200 rounded-2xl rounded-bl-sm')}
                  >
                    {msg.text}
                  </div>
                  {/* Timestamp below bubble */}
                  <span className={'text-[8px] text-neutral-700 px-1 ' + (isMe ? 'text-right' : '')}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* ── Emoji picker ── */}
        {showEmoji && (
          <div className="mx-3 mb-2 p-3 rounded-2xl bg-[#111] border border-white/8 flex flex-wrap gap-2">
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => insertEmoji(e)}
                className="text-xl hover:scale-125 transition-transform active:scale-95"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* ── Pill-shaped input with embedded send button ── */}
        <div className="border-t border-white/5 px-3 py-3">
          <div className="flex items-center gap-2 bg-black/50 border border-white/8 rounded-full px-4 py-1.5 focus-within:border-amber-500/40 transition-all">
            {/* Emoji toggle button */}
            <button
              type="button"
              onClick={() => setShowEmoji(p => !p)}
              className={'text-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0 ' +
                (showEmoji ? 'opacity-100' : 'opacity-50 hover:opacity-100')}
              title="Emoji"
            >
              😊
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value.slice(0, 500))}
              onKeyDown={handleKeyDown}
              placeholder="Message the community…"
              disabled={sending}
              className="flex-1 bg-transparent outline-none text-sm text-neutral-200 placeholder-neutral-700 py-1.5"
            />

            {/* Character countdown */}
            {newMessage.length > 400 && (
              <span className={'text-[9px] font-black flex-shrink-0 ' + (remaining < 50 ? 'text-rose-400' : 'text-neutral-600')}>
                {remaining}
              </span>
            )}

            {/* Send button inside pill */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 shadow-[0_4px_12px_rgba(245,158,11,0.3)]"
            >
              {sending ? <Spin /> : <Send size={13} />}
            </button>
          </div>
        </div>

      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TAB — Only for GhaithriAHI96
// ─────────────────────────────────────────────────────────────────────────────
function AdminTab({ username }: { username: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats]               = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [selected, setSelected]         = useState<Transaction | null>(null);
  const [reason, setReason]             = useState('');
  const [msg, setMsg]                   = useState<string | null>(null);
  const [err, setErr]                   = useState<string | null>(null);
  const [filter, setFilter]             = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin', { action: 'getAll', username });
      setTransactions(res.transactions);
      setStats(res.stats);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: string, escrowCode: string, extra?: object) => {
    setMsg(null); setErr(null);
    try {
      const res = await apiFetch('/api/admin', { action, username, escrowCode, reason, ...extra });
      setMsg(res.message); setSelected(null); setReason(''); load();
    } catch (e: any) { setErr(e.message); }
  };

  const platformStats = useMemo(() => {
    const released = transactions.filter(t => t.status === 'RELEASED');
    const totalPi = released.reduce((s, t) => s + (t.amount || 0), 0);
    const totalFee = released.reduce((s, t) => s + (t.fee || 0), 0);
    const uniqueUsers = new Set([
      ...transactions.map(t => t.buyerUsername),
      ...transactions.map(t => t.sellerUsername).filter(Boolean) as string[],
    ]).size;
    const successRate = transactions.length > 0 ? (released.length / transactions.length) * 100 : 0;
    const avgDealSize = transactions.length > 0 ? transactions.reduce((s, t) => s + (t.amount || 0), 0) / transactions.length : 0;
    const activeDisputes = transactions.filter(t => t.status === 'FROZEN' || t.status === 'UNDER_REVIEW').length;

    return [
      { label: 'Total Pi Transacted', value: totalPi.toLocaleString() + ' π', color: 'text-amber-400', icon: Zap },
      { label: 'Platform Revenue',    value: totalFee.toFixed(2) + ' π',      color: 'text-emerald-400', icon: Wallet },
      { label: 'Total Users',         value: uniqueUsers,                     color: 'text-sky-400', icon: Users },
      { label: 'Success Rate',        value: Math.round(successRate) + '%',   color: 'text-violet-400', icon: TrendingUp },
      { label: 'Avg Deal Size',       value: avgDealSize.toFixed(1) + ' π',   color: 'text-orange-400', icon: Activity },
      { label: 'Active Disputes',     value: activeDisputes,                  color: 'text-rose-400', icon: AlertTriangle },
    ];
  }, [transactions]);

  const suspiciousUsers = useMemo(() => {
    const users = new Map<string, Transaction[]>();
    transactions.forEach(tx => {
      if (tx.buyerUsername) {
        if (!users.has(tx.buyerUsername)) users.set(tx.buyerUsername, []);
        users.get(tx.buyerUsername)!.push(tx);
      }
      if (tx.sellerUsername) {
        if (!users.has(tx.sellerUsername)) users.set(tx.sellerUsername, []);
        users.get(tx.sellerUsername)!.push(tx);
      }
    });

    const suspicious: { username: string; reason: string; trustScore: number }[] = [];

    users.forEach((userTxs, username) => {
      const disputed = userTxs.filter(t => ['FROZEN', 'UNDER_REVIEW', 'PENDING_ADMIN'].includes(t.status)).length;
      const refunded = userTxs.filter(t => t.status === 'REFUNDED').length;
      const total = userTxs.length;
      const refundRate = total > 0 ? refunded / total : 0;
      
      let reason = '';
      if (disputed > 2) reason = 'Too many disputes';
      else if (refunded > 3) reason = 'Too many refunds';
      else if (refundRate > 0.5 && total >= 2) reason = 'High refund rate';

      if (reason) {
        suspicious.push({ username, reason, trustScore: calculateTrustScore(userTxs).score });
      }
    });

    return suspicious;
  }, [transactions]);

  const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.status === filter);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-red-950/40 to-violet-950/40 border border-red-500/20">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
          <Shield size={18} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-sm font-black text-red-400 tracking-widest uppercase">Admin Panel</h2>
          <p className="text-[10px] text-neutral-600">Full control · @{username}</p>
        </div>
        <button onClick={load} className="ml-auto w-8 h-8 rounded-lg bg-white/4 border border-white/6 flex items-center justify-center text-neutral-600 hover:text-red-400 transition-all">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Platform Overview Section */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/20 to-violet-950/20 border border-amber-500/15 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-amber-400" />
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest">Platform Overview</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {platformStats.map((stat, i) => (
            <div key={i} className="bg-black/40 border border-white/6 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-[8px] uppercase text-neutral-500 tracking-wider mb-0.5">{stat.label}</div>
                <div className={`text-sm font-black ${stat.color}`}>{stat.value}</div>
              </div>
              <stat.icon size={16} className={`${stat.color} opacity-80`} />
            </div>
          ))}
        </div>
      </div>

      {/* Fraud Detection Section */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/20 to-orange-950/20 border border-red-500/15 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">Fraud Detection</h3>
        </div>
        
        {suspiciousUsers.length === 0 ? (
          <div className="text-center py-6 border border-white/5 rounded-xl bg-black/20">
            <ShieldCheck size={20} className="mx-auto text-emerald-400 opacity-50 mb-2" />
            <p className="text-[11px] font-black text-emerald-400">No suspicious activity detected</p>
          </div>
        ) : (
          <div className="space-y-2">
            {suspiciousUsers.map(su => (
              <div key={su.username} className="bg-black/40 border border-red-500/10 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-sm truncate">@{su.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-black tracking-wider uppercase">
                        {su.reason}
                      </span>
                      <span className="text-[9px] text-neutral-500">
                        Trust: <span className={su.trustScore >= 71 ? 'text-emerald-400' : su.trustScore >= 41 ? 'text-amber-400' : 'text-rose-400'}>{su.trustScore}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-white/5 pt-2">
                  <button onClick={() => doAction('warn', '', { target: su.username })} className="flex-1 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-[10px] font-black transition-all">
                    Warn User
                  </button>
                  <button onClick={() => doAction('block', '', { target: su.username })} className="flex-1 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-black transition-all">
                    Block User
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { l: 'Total',     v: stats.total,     c: 'text-white'       },
            { l: 'Pending',   v: stats.pending,   c: 'text-amber-400'   },
            { l: 'Delivered', v: stats.delivered, c: 'text-sky-400'     },
            { l: 'Frozen',    v: stats.frozen,    c: 'text-blue-400'    },
            { l: 'Released',  v: stats.released,  c: 'text-emerald-400' },
          ].map(s => (
            <div key={s.l} className="bg-[#0d0d0d] border border-white/6 rounded-xl p-2.5 text-center">
              <div className={'text-lg font-black ' + s.c}>{s.v}</div>
              <div className="text-[8px] text-neutral-600 uppercase tracking-wider mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {['ALL', 'PENDING', 'DELIVERED', 'FROZEN', 'RELEASED', 'REFUNDED', 'PENDING_ADMIN'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ' +
              (filter === f
                ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                : 'bg-white/4 border border-white/6 text-neutral-600 hover:text-neutral-300')}>
            {f}
          </button>
        ))}
      </div>

      {msg && <OkBox msg={msg} />}
      {err && <ErrBox msg={err} />}

      {/* Action Panel */}
      {selected && (
        <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/25 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Selected</p>
              <p className="text-sm font-black text-red-400 font-mono">{selected.escrowCode}</p>
              <p className="text-[10px] text-neutral-500">{selected.amount} Pi · @{selected.buyerUsername}</p>
            </div>
            <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-neutral-600 hover:text-white">
              <XCircle size={13} />
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-black tracking-[0.15em] text-amber-500/80">Reason / Note</label>
            <input placeholder="Reason for this action…" value={reason} onChange={e => setReason(e.target.value)}
              className="w-full bg-black/60 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none text-sm transition-all placeholder-neutral-700 text-neutral-200" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => doAction('refund', selected.escrowCode)}
              className="py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-black hover:bg-emerald-500/15 transition-all flex items-center justify-center gap-1.5">
              <ArrowRight size={12} /> Refund to Buyer
            </button>
            <button onClick={() => doAction('freeze', selected.escrowCode)}
              className="py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-black hover:bg-blue-500/15 transition-all flex items-center justify-center gap-1.5">
              <Lock size={12} /> Freeze
            </button>
            <button onClick={() => doAction('resolve', selected.escrowCode, { resolveFor: 'seller' })}
              className="py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black hover:bg-amber-500/15 transition-all flex items-center justify-center gap-1.5">
              <CheckCircle2 size={12} /> Release to Seller
            </button>
            <button onClick={() => doAction('resolve', selected.escrowCode, { resolveFor: 'buyer' })}
              className="py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-black hover:bg-violet-500/15 transition-all flex items-center justify-center gap-1.5">
              <Shield size={12} /> Resolve for Buyer
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full" />
        </div>
      )}

      {filtered.map(tx => (
        <div key={tx._id}
          onClick={() => setSelected(selected?.escrowCode === tx.escrowCode ? null : tx)}
          className={'p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ' +
            (selected?.escrowCode === tx.escrowCode
              ? 'border-red-500/40 bg-red-950/15'
              : 'border-white/6 bg-[#0d0d0d] hover:border-white/12')}>
          <div className="flex items-center justify-between">
            <span className="font-black text-[11px] font-mono text-red-400/80">{tx.transactionNumber || tx.escrowCode}</span>
            <StatusBadge status={tx.status} />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-600">@{tx.buyerUsername} → @{tx.sellerUsername || '?'}</span>
            <span className="font-black text-white">{tx.amount} <span className="text-amber-400">Pi</span></span>
          </div>
          {tx.description && <p className="text-[9px] text-neutral-700 truncate">{tx.description}</p>}
          <div className="text-[9px] text-neutral-700">
            {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-neutral-700">
          <Shield size={28} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-black">No transactions</p>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────

function ProfileTab({ username }: { username: string }) {
  const [txs, setTxs]           = useState<Transaction[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/escrow/transactions?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        if (data.success) setTxs(data.transactions ?? []);
        else setError(data.error ?? 'Failed to load');
      } catch { setError('Network error'); }
      finally { setLoading(false); }
    })();
  }, [username]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = txs.length;
    const asBuyer   = txs.filter(t => t.buyerUsername === username).length;
    const asSeller  = txs.filter(t => t.sellerUsername === username).length;
    const completed = txs.filter(t => t.status === 'RELEASED').length;
    const trustData = calculateTrustScore(txs);

    const ratings   = txs.map(t => t.rating).filter((r): r is number => r != null);
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

    // Member since: oldest transaction date, or today
    const oldest = txs.length > 0
      ? new Date(txs[txs.length - 1].createdAt)
      : new Date();
    const memberSince = oldest.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Badge
    const badge =
      total >= 20 ? { label: 'Elite Merchant', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', emoji: '💎' }
      : total >= 5  ? { label: 'Trusted Trader',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', emoji: '🤝' }
      :              { label: 'New Pioneer',       color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   emoji: '🚀' };

    return { total, asBuyer, asSeller, completed, trustData, avgRating, memberSince, badge, ratings };
  }, [txs, username]);

  const recent = txs.slice(0, 5);
  const [showTrustDetails, setShowTrustDetails] = useState(false);

  return (
    <div className="space-y-4">

      {/* ── Fraud Warnings ── */}
      {!loading && stats.trustData.score < 30 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <p className="text-sm font-black">⚠️ Low trust user - proceed with caution</p>
        </div>
      )}
      {!loading && stats.trustData.disputed > 2 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
          <AlertCircle size={16} className="flex-shrink-0" />
          <p className="text-sm font-black">Multiple disputes detected</p>
        </div>
      )}

      {/* ── Avatar + identity card ── */}
      <Card className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Large avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-black text-3xl shadow-[0_8px_32px_rgba(245,158,11,0.35)]">
              {username.charAt(0).toUpperCase()}
            </div>
            {/* Badge pip */}
            <div className={'absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full border text-[9px] font-black ' + stats.badge.bg + ' ' + stats.badge.color}>
              {stats.badge.emoji} {stats.badge.label}
            </div>
          </div>

          {/* Name + member since */}
          <div>
            <p className="text-lg font-black text-white">@{username}</p>
            <p className="text-[10px] text-neutral-600 mt-0.5">
              <span className="text-amber-500/60 font-black">Member since</span> {stats.memberSince}
            </p>
          </div>

          {/* Smart Trust Score Component */}
          {loading ? (
            <div className="w-full h-32 rounded-xl bg-white/4 animate-pulse mt-4" />
          ) : (
            <div className="w-full mt-4 bg-[#0d0d0d] rounded-2xl p-4 border border-white/4">
              <div className="relative w-28 h-28 flex items-center justify-center mx-auto mb-3">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="46" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                  <circle cx="56" cy="56" r="46" fill="transparent" stroke="currentColor" strokeWidth="8"
                    className={stats.trustData.score >= 71 ? 'text-emerald-500' : stats.trustData.score >= 41 ? 'text-amber-500' : 'text-rose-500'}
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={(2 * Math.PI * 46) * (1 - stats.trustData.score / 100)}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black ${stats.trustData.color}`}>{stats.trustData.score}</span>
                </div>
              </div>

              <div className="text-center mb-4">
                <div className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 bg-white/5 rounded-full inline-block border border-white/10 ${stats.trustData.color}`}>
                  {stats.trustData.level}
                </div>
              </div>

              {/* Expandable Details */}
              <div className="border-t border-white/5 pt-3 mt-3">
                <button 
                  onClick={() => setShowTrustDetails(!showTrustDetails)}
                  className="w-full flex items-center justify-between text-[11px] font-black text-neutral-400 hover:text-white transition-colors"
                >
                  How is this computed?
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showTrustDetails ? 'rotate-180' : ''}`} />
                </button>
                {showTrustDetails && (
                  <div className="mt-3 space-y-1.5 px-2">
                    <div className="text-[10px] text-neutral-500 mb-2 border-b border-white/5 pb-2 text-left">
                      Base Score: <span className="text-white">50</span>
                    </div>
                    {stats.trustData.details.map((detail, i) => {
                      const isPos = detail.startsWith('+');
                      return (
                        <div key={i} className="flex items-start gap-1.5 text-left">
                          <span className={`text-[10px] font-black flex-shrink-0 ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isPos ? '+' : '-'}
                          </span>
                          <span className="text-[10px] text-neutral-300 leading-relaxed">
                            {detail.substring(1)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <p className="text-[9px] text-neutral-600 text-center mt-4">
                Score updates automatically with each transaction
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: 'Total Deals',  v: stats.total,     c: 'text-white'       },
          { l: 'Completed',    v: stats.completed,  c: 'text-emerald-400' },
          { l: 'As Buyer',     v: stats.asBuyer,    c: 'text-amber-400'   },
          { l: 'As Seller',    v: stats.asSeller,   c: 'text-sky-400'     },
        ].map(s => (
          <div key={s.l} className="bg-[#0d0d0d] border border-white/6 rounded-xl py-3.5 text-center">
            <div className={'text-xl font-black ' + s.c}>
              {loading ? <div className="h-6 w-8 mx-auto rounded-lg bg-white/6 animate-pulse" /> : s.v}
            </div>
            <div className="text-[8px] text-neutral-600 uppercase tracking-wider mt-1 leading-tight px-1">{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Average rating ── */}
      {!loading && stats.avgRating !== null && (
        <Card className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                <Star size={14} className="text-amber-400" fill="currentColor" />
              </div>
              <div>
                <p className="text-[11px] font-black text-white">Average Rating</p>
                <p className="text-[9px] text-neutral-600">{stats.ratings.length} rating{stats.ratings.length !== 1 ? 's' : ''} received</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-amber-400">{stats.avgRating.toFixed(1)}</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} size={12}
                    className={n <= Math.round(stats.avgRating!) ? 'text-amber-400' : 'text-neutral-700'}
                    fill={n <= Math.round(stats.avgRating!) ? 'currentColor' : 'none'}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Error state ── */}
      {error && <ErrBox msg={error} />}

      {/* ── Recent transactions ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
            <ClipboardList size={14} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-black text-white">Recent Deals</p>
            <p className="text-[10px] text-neutral-600">Last {Math.min(5, txs.length)} transactions</p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && recent.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-700">
            <User size={28} className="opacity-20" />
            <p className="text-sm font-black">No transactions yet</p>
            <p className="text-[11px]">Start your first deal in the Buyer tab</p>
          </div>
        )}

        {!loading && recent.length > 0 && (
          <div className="divide-y divide-white/4">
            {recent.map((tx, i) => {
              const isBuyer = tx.buyerUsername === username;
              return (
                <div key={tx._id ?? i} className="px-5 py-3.5 flex items-center gap-3">
                  {/* Role pill */}
                  <span className={'text-[8px] font-black px-2 py-1 rounded-lg border flex-shrink-0 ' +
                    (isBuyer
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-sky-500/10 border-sky-500/20 text-sky-400')}>
                    {isBuyer ? 'Buyer' : 'Seller'}
                  </span>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white font-mono truncate">
                      {tx.transactionNumber || tx.escrowCode}
                    </p>
                    <p className="text-[9px] text-neutral-600 truncate">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  {/* Amount + status */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-black text-white">{tx.amount} <span className="text-amber-400">π</span></p>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
function App({ user, onLogout }: { user: PiUser; onLogout: () => void }) {
  const [tab, setTab] = useState<'buyer' | 'seller' | 'transactions' | 'stats' | 'chat' | 'profile' | 'admin'>('buyer'); const username = user.username; const isAdmin = username === 'GhaithriAHI96';

  // For deep-linking from transactions tab
  const navigate = useCallback((dest: string, code?: string) => {
    setTab('buyer');
    // code is available for pre-filling — handled inside BuyerTab via state lifting if needed
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center bg-[#080808] text-white pb-28">
      <div className="fixed top-0 left-0 right-0 h-[250px] bg-gradient-to-b from-amber-500/[0.025] to-transparent pointer-events-none" />

      <div className="w-full max-w-lg px-4 mt-6 space-y-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between py-1">
          <div>
            <h1 className="text-xl font-black tracking-[-0.03em]" style={{ fontFamily: "'Georgia', serif" }}>
              P<span className="text-amber-400">TRUST</span>
            </h1>
            <p className="text-neutral-600 text-[10px] tracking-wide">@{user.username}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-black text-sm">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center text-neutral-600 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
              title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* Tab bar — 2 rows: top 3 + bottom 3 (or 4) */}
        <div className={'grid gap-1 p-1 bg-[#0d0d0d] border border-white/6 rounded-2xl ' + (isAdmin ? 'grid-cols-3' : 'grid-cols-3')}>
          {([
            { key: 'buyer',        label: 'Buyer',   Icon: Lock          },
            { key: 'seller',       label: 'Seller',  Icon: Package       },
            { key: 'transactions', label: 'Deals',   Icon: ClipboardList },
            { key: 'stats',        label: 'Stats',   Icon: BarChart3     },
            { key: 'chat',         label: 'Chat',    Icon: MessageCircle },
            { key: 'profile',      label: 'Profile', Icon: User          },
            ...(isAdmin ? [{ key: 'admin' as const, label: 'Admin', Icon: Shield }] : []),
          ] as const).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={
                'flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[9px] font-black tracking-wide transition-all duration-200 ' +
                (tab === key
                  ? (key === 'admin' ? 'bg-red-500 text-white shadow-[0_4px_16px_rgba(239,68,68,0.3)]' : 'bg-amber-500 text-black shadow-[0_4px_16px_rgba(245,158,11,0.25)]')
                  : 'text-neutral-600 hover:text-neutral-300')
              }>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'buyer'        && <BuyerTab        user={user} />}
        {tab === 'seller'       && <SellerTab        user={user} />}
        {tab === 'transactions' && <TransactionsTab  user={user} onNavigate={navigate} />}
        {tab === 'stats'        && <StatsTab         user={user} />}
        {tab === 'chat'         && <ChatTab          username={username} />}
        {tab === 'profile'      && <ProfileTab       username={username} />}
        {tab === 'admin'        && isAdmin && <AdminTab username={username} />}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT — uses PiSDKProvider
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [expired, setExpired] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleExpire = useCallback(() => setExpired(true), []);
  useSessionTimer(handleExpire, !!user);

  if (!mounted) return null;

  if (expired) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#080808] text-white">
        <div className="text-center space-y-6 max-w-xs w-full">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Clock size={24} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Session Expired</h2>
            <p className="text-neutral-500 text-sm mt-2 leading-relaxed">
              You were inactive for 30 minutes. Please sign in again.
            </p>
          </div>
          <PrimaryBtn onClick={() => { setExpired(false); authenticateUser(); }}>
            <Wallet size={15} /> Sign In Again
          </PrimaryBtn>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-black text-white" style={{ fontFamily: "'Georgia', serif" }}>
            P<span className="text-transparent" style={{ WebkitTextStroke: '2px #f59e0b' }}>TRUST</span>
          </h1>
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
          <p className="text-neutral-600 text-xs tracking-widest uppercase">Connecting to Pi Network…</p>
        </div>
      </main>
    );
  }

  if (!user) return <Landing onLogin={authenticateUser} loading={loading} />;
  return <App user={user} onLogout={() => window.location.reload()} />;}