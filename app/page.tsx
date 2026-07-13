'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import {
  AlertCircle, CheckCircle2, ArrowRight, Lock, Zap, Copy, Share2, Key,
  Package, ClipboardList, Star, BarChart3, AlertTriangle, ChevronDown,
  LogOut, Clock, Mail, Shield, Hash, TrendingUp, Activity, Eye, EyeOff,
  RefreshCw, XCircle, FileText, Info, MessageCircle, Send, User,
  Search, X, FileDown, Home,
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
async function apiFetch(url: string, body?: object): Promise<any> {
  const opts: RequestInit = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' };
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST SCORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function calculateTrustScore(transactions: Transaction[]) {
  let score = 50;
  const details: string[] = [];
  const completed = transactions.filter(t => t.status === 'RELEASED').length;
  const disputed  = transactions.filter(t => ['FROZEN','UNDER_REVIEW','PENDING_ADMIN'].includes(t.status)).length;
  const refunded  = transactions.filter(t => t.status === 'REFUNDED').length;
  const ratings   = transactions.filter(t => t.rating).map(t => t.rating as number);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  if (completed >= 1)   { score += 10; details.push('+10 First completed deal'); }
  if (completed >= 5)   { score += 10; details.push('+10 Trusted trader (5+ deals)'); }
  if (completed >= 20)  { score += 10; details.push('+10 Elite merchant (20+ deals)'); }
  if (avgRating >= 4.5) { score += 10; details.push('+10 Excellent ratings'); }
  if (avgRating >= 3)   { score += 5;  details.push('+5 Good ratings'); }
  if (disputed > 0)     { score -= disputed * 10; details.push(`-${disputed * 10} Active disputes`); }
  if (refunded > 0)     { score -= refunded * 5;  details.push(`-${refunded * 5} Refunded deals`); }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 71 ? 'High Trust' : score >= 41 ? 'Medium Trust' : 'Low Trust';
  const color = score >= 71 ? '#5C8374'   : score >= 41 ? '#F5C46C'      : '#C44536';
  return { score, level, color, details, disputed };
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TIMER
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
// ONLINE STATUS
// ─────────────────────────────────────────────────────────────────────────────
function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:     '#0A0908',
  card:   '#151310',
  card2:  '#1C1A17',
  gold:   '#F5C46C',
  goldD:  '#B8893E',
  sage:   '#5C8374',
  terra:  '#C44536',
  sky:    '#6FA8C9',
  violet: '#9B8AC4',
  muted:  '#8A8378',
  border: 'rgba(245,196,108,0.10)',
} as const;

const STATUS_STYLE: Record<TxStatus, { bg: string; dot: string; label: string; color: string }> = {
  PENDING:       { bg: 'rgba(245,196,108,.08)', dot: '#F5C46C', label: 'Pending',      color: '#F5C46C' },
  ACCEPTED:      { bg: 'rgba(111,168,201,.08)', dot: '#6FA8C9', label: 'Accepted',     color: '#6FA8C9' },
  DELIVERED:     { bg: 'rgba(92,131,116,.08)',  dot: '#5C8374', label: 'Delivered',    color: '#5C8374' },
  FROZEN:        { bg: 'rgba(111,168,201,.08)', dot: '#6FA8C9', label: 'Frozen',       color: '#6FA8C9' },
  UNDER_REVIEW:  { bg: 'rgba(155,138,196,.08)', dot: '#9B8AC4', label: 'Under Review', color: '#9B8AC4' },
  RELEASED:      { bg: 'rgba(92,131,116,.08)',  dot: '#5C8374', label: 'Released',     color: '#5C8374' },
  REFUNDED:      { bg: 'rgba(111,168,201,.08)', dot: '#6FA8C9', label: 'Refunded',     color: '#6FA8C9' },
  PENDING_ADMIN: { bg: 'rgba(196,69,54,.08)',   dot: '#C44536', label: 'Admin Review', color: '#C44536' },
  EXPIRED:       { bg: 'rgba(138,131,120,.08)', dot: '#8A8378', label: 'Expired',      color: '#8A8378' },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Seal({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `radial-gradient(circle at 35% 30%, ${C.gold}, ${C.goldD} 70%)`,
      boxShadow: `0 2px 8px rgba(0,0,0,.45), inset 0 1px 2px rgba(255,255,255,.28)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: size * 0.38, color: C.card }}>π</span>
    </div>
  );
}

function StatusBadge({ status }: { status: TxStatus }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.PENDING;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
      padding: '3px 8px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.color}25`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

function Spin() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      border: '2px solid currentColor', borderTopColor: 'transparent',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  );
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
        background: ok ? 'rgba(92,131,116,.15)' : C.card2,
        color: ok ? C.sage : C.muted,
        border: `1px solid ${ok ? 'rgba(92,131,116,.35)' : C.border}`,
        transition: 'all .2s',
      }}>
      {ok ? <CheckCircle2 size={11} /> : <Copy size={11} />}
      {ok ? 'Copied!' : (label ?? 'Copy')}
    </button>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 24, padding: 20,
      boxShadow: '0 2px 16px rgba(0,0,0,.3)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: 14, borderRadius: 16, fontSize: 11, lineHeight: 1.6,
      background: 'rgba(196,69,54,.08)', color: C.terra, border: `1px solid rgba(196,69,54,.30)`,
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{msg}
    </div>
  );
}

function OkBox({ msg }: { msg: string }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: 14, borderRadius: 16, fontSize: 11, lineHeight: 1.6,
      background: 'rgba(92,131,116,.08)', color: C.sage, border: `1px solid rgba(92,131,116,.30)`,
    }}>
      <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />{msg}
    </div>
  );
}

function InfoBanner({ msg, type = 'gold' }: { msg: string; type?: 'gold' | 'sky' | 'terra' }) {
  const col = type === 'gold' ? C.gold : type === 'sky' ? C.sky : C.terra;
  return (
    <div style={{
      display: 'flex', gap: 8, padding: 12, borderRadius: 14, fontSize: 11, lineHeight: 1.6,
      background: `${col}0d`, color: col, border: `1px solid ${col}25`,
    }}>
      <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />{msg}
    </div>
  );
}

function PrimaryBtn({
  children, disabled, onClick, type = 'button', variant = 'gold',
}: {
  children: React.ReactNode; disabled?: boolean; onClick?: () => void;
  type?: 'button' | 'submit'; variant?: 'gold' | 'ghost' | 'danger' | 'sage';
}) {
  const styles: Record<string, React.CSSProperties> = {
    gold:   { background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, color: C.card, boxShadow: `0 8px 24px rgba(245,196,108,.25)` },
    ghost:  { background: C.card2, color: '#E8E4DC', border: `1px solid ${C.border}` },
    danger: { background: 'rgba(196,69,54,.10)', color: C.terra, border: 'rgba(196,69,54,.30)' },
    sage:   { background: 'rgba(92,131,116,.12)', color: C.sage, border: `1px solid rgba(92,131,116,.30)` },
  };
  return (
    <button
      type={type} disabled={disabled} onClick={onClick}
      style={{
        width: '100%', padding: '15px 20px', fontWeight: 800, borderRadius: 18,
        fontSize: 13, letterSpacing: '0.02em', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, transition: 'all .2s', border: 'none',
        ...styles[variant],
      }}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingInline: 2 }}>
        <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: `${C.gold}90` }}>{label}</label>
        {hint && <span style={{ fontSize: 9, color: C.muted }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function InputBase({ placeholder, value, onChange, type = 'text', min, max, step, required, readOnly, mono, big, gold }: {
  placeholder?: string; value: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; min?: string; max?: string; step?: string; required?: boolean; readOnly?: boolean;
  mono?: boolean; big?: boolean; gold?: boolean;
}) {
  return (
    <input
      type={type} placeholder={placeholder} value={value} onChange={onChange}
      min={min} max={max} step={step} required={required} readOnly={readOnly}
      style={{
        width: '100%', background: C.card2, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '14px 18px', outline: 'none', transition: 'border-color .2s',
        fontSize: big ? 22 : 13, fontWeight: big ? 800 : 500,
        color: gold ? C.gold : readOnly ? C.muted : '#E8E4DC',
        fontFamily: mono ? 'monospace' : 'inherit',
        letterSpacing: mono ? '0.1em' : 'inherit',
      }}
    />
  );
}

function TextArea({ placeholder, value, onChange, rows = 3, required }: {
  placeholder?: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number; required?: boolean;
}) {
  return (
    <textarea
      placeholder={placeholder} value={value} onChange={onChange} rows={rows} required={required}
      style={{
        width: '100%', background: C.card2, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '14px 18px', outline: 'none', resize: 'none',
        fontSize: 13, color: '#C8C0B4', fontFamily: 'inherit', lineHeight: 1.6,
      }}
    />
  );
}

function Stars({ value, onRate }: { value?: number; onRate?: (n: number) => void }) {
  const [hov, setHov] = useState(0);
  const [sel, setSel] = useState(value || 0);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} disabled={!onRate} type="button"
          onMouseEnter={() => onRate && setHov(n)}
          onMouseLeave={() => onRate && setHov(0)}
          onClick={() => { if (onRate) { setSel(n); onRate(n); } }}
          style={{ background: 'none', border: 'none', cursor: onRate ? 'pointer' : 'default', padding: 0 }}>
          <Star size={22} style={{ color: n <= (hov || sel) ? C.gold : '#3A3631', fill: n <= (hov || sel) ? C.gold : 'none', transition: 'color .15s' }} />
        </button>
      ))}
    </div>
  );
}

function DealTracker({ status }: { status: TxStatus }) {
  const steps = ['Created', 'Accepted', 'Delivered', 'Released'];
  const idx = status === 'PENDING' ? 0 : status === 'ACCEPTED' ? 1 : status === 'DELIVERED' ? 2 : status === 'RELEASED' ? 3 : 0;
  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 16, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((step, i) => (
          <React.Fragment key={step}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800,
                background: i < idx ? C.sage : i === idx ? C.gold : C.card,
                color: i < idx ? '#0A0908' : i === idx ? C.card : C.muted,
                boxShadow: i === idx ? `0 0 0 4px rgba(245,196,108,.18)` : 'none',
                border: i > idx ? `1px solid ${C.border}` : 'none',
              }}>
                {i < idx ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, color: i === idx ? C.gold : i < idx ? C.sage : C.muted }}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, borderRadius: 99, margin: '0 4px 14px', background: i < idx ? C.sage : C.border }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', who: 'Buyer',  color: C.gold,   title: 'Create Escrow',    body: 'Buyer pays via Pi Browser. Gets a private Buyer Key and a Seller Key to share.' },
  { n: '02', who: 'Seller', color: C.sky,    title: 'Accept Deal',      body: 'Seller enters Escrow Code + Seller Key. Reviews terms and accepts. Funds stay locked.' },
  { n: '03', who: 'Seller', color: C.sky,    title: 'Confirm Delivery', body: 'Seller delivers the goods or service, then confirms.' },
  { n: '04', who: 'Buyer',  color: C.sage,   title: 'Release or Dispute', body: '"Received" + Buyer Key → funds released.\n"Not Received" → funds freeze, dispute opens.' },
  { n: '05', who: 'System', color: C.violet, title: 'Auto-Resolution',  body: '15 days silence = auto-release. Disputes resolved by admin.' },
];

const FAQS = [
  { q: 'Are my funds safe if the website is hacked?',              a: 'Yes. Funds live on the Pi blockchain. Nobody can move them without your Buyer Key.' },
  { q: 'What is the difference between Buyer Key and Seller Key?', a: 'Buyer Key releases funds or opens disputes. Seller Key accepts the deal. Keep yours private.' },
  { q: 'What happens if I lose my Buyer Key?',                     a: 'The key is shown only once. Save it immediately. Contact support if lost.' },
  { q: 'What does PTrust Oracle charge?',                          a: 'Only 0.1% of the transaction amount. No hidden fees.' },
  { q: 'What if the seller never delivers?',                       a: 'Open a dispute. Admin reviews evidence and decides within 15 days.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.card2, border: `1px solid ${open ? `${C.gold}30` : C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} type="button"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#E8E4DC', lineHeight: 1.4 }}>{q}</span>
        <span style={{
          width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0, transition: 'transform .2s',
          background: open ? `${C.gold}20` : 'rgba(255,255,255,.04)',
          color: open ? C.gold : C.muted,
          transform: open ? 'rotate(45deg)' : 'none',
        }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', fontSize: 11, color: C.muted, lineHeight: 1.7, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>{a}</div>
      )}
    </div>
  );
}

function Landing({ onLogin, loading }: { onLogin: () => void; loading: boolean }) {
  const [section, setSection] = useState<string | null>(null);
  const [piPrice, setPiPrice] = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState('Kraken');
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrice() {
      setPriceLoading(true);
      try {
        const res  = await fetch('https://api.kraken.com/0/public/Ticker?pair=PIUSD');
        const data = await res.json();
        const ticker = data?.result?.PIUSD ?? data?.result?.['PI/USD'];
        const price  = ticker ? parseFloat(ticker.c[0]) : NaN;
        if (!cancelled && !isNaN(price)) { setPiPrice(price); setPriceSource('Kraken'); setPriceLoading(false); return; }
        throw new Error('no price');
      } catch {
        try {
          const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd');
          const data = await res.json();
          if (!cancelled) { setPiPrice(data?.['pi-network']?.usd || null); setPriceSource('CoinGecko'); }
        } catch { if (!cancelled) setPiPrice(null); }
        if (!cancelled) setPriceLoading(false);
      }
    }
    fetchPrice();
    const iv = setInterval(fetchPrice, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const sections = [
    {
      key: 'how', icon: '🔄', title: 'How It Works', sub: '5 steps that protect every deal',
      content: (
        <div>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: i < STEPS.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${s.color}30`, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 800, color: s.color }}>{s.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#E8E4DC' }}>{s.title}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: `${s.color}12`, color: s.color }}>{s.who}</span>
                </div>
                <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'faq', icon: '❓', title: 'FAQ', sub: 'Common questions answered',
      content: <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</div>,
    },
  ];

  return (
    <main style={{ minHeight: '100vh', background: `radial-gradient(ellipse at 50% -20%, rgba(245,196,108,.07), transparent 55%), ${C.bg}`, color: '#E8E4DC' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 20px 80px' }}>
        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60, paddingBottom: 32, gap: 18 }}>
          <Seal size={76} />
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 68, lineHeight: 1, letterSpacing: '-0.03em', margin: 0 }}>
              P<span style={{ color: C.gold }}>TRUST</span>
            </h1>
            <p style={{ fontSize: 10, letterSpacing: '0.45em', textTransform: 'uppercase', color: C.muted, marginTop: 6 }}>Oracle · Escrow Protocol</p>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#C8C0B4', maxWidth: 260, margin: 0 }}>
            Lock funds · verify delivery · release with confidence.
          </p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%' }}>
            {[{ v: '0%', l: 'Fraud Rate' }, { v: '0.1%', l: 'Platform Fee' }, { v: '24/7', l: 'Active' }].map(s => (
              <div key={s.l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '14px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, color: C.gold }}>{s.v}</div>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Price card */}
          <div style={{ width: '100%', padding: '14px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${C.gold}10, ${C.gold}05)`, border: `1px solid ${C.gold}20` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Seal size={38} />
              <div>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: C.muted }}>Pi / USD · {priceSource}</div>
                {priceLoading
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}><Spin /><span style={{ fontSize: 11, color: C.muted }}>Fetching…</span></div>
                  : piPrice
                    ? <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 22, color: C.gold, marginTop: 2 }}>{'$' + piPrice.toFixed(4)}</div>
                    : <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Unavailable</div>
                }
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, color: C.sage }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.sage, animation: 'pulse 2s infinite' }} />LIVE
            </div>
          </div>

          {/* GCV */}
          <div style={{ width: '100%', padding: '14px 16px', borderRadius: 20, background: 'rgba(155,138,196,.10)', border: '1px solid rgba(155,138,196,.20)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'rgba(155,138,196,.6)' }}>Pi Consensus Value · GCV</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 18, color: '#C4B8F0', marginTop: 4 }}>1 π = 314,159 GCV</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>Community Consensus · Global Currency Value</div>
              </div>
              <span style={{ fontSize: 28 }}>⚖️</span>
            </div>
          </div>

          {/* CTA */}
          <button onClick={onLogin} disabled={loading} type="button"
            style={{
              width: '100%', padding: '18px 24px', fontWeight: 800, fontSize: 14, borderRadius: 20, border: 'none',
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, color: C.card,
              boxShadow: `0 12px 40px rgba(245,196,108,.30)`, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all .2s',
            }}>
            <span style={{ fontSize: 20 }}>π</span>
            {loading ? 'Connecting…' : 'Connect Pi Wallet'}
            {!loading && <ArrowRight size={16} />}
          </button>

          {/* Trust pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            {[{ i: '🔒', t: 'Blockchain' }, { i: '🔑', t: 'Your Key Only' }, { i: '⚖️', t: 'Fair Dispute' }].map(({ i, t }) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.muted }}>
                <span>{i}</span>{t}
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sections.map(sec => (
            <div key={sec.key} style={{ background: C.card, border: `1px solid ${section === sec.key ? `${C.gold}30` : C.border}`, borderRadius: 20, overflow: 'hidden' }}>
              <button onClick={() => setSection(section === sec.key ? null : sec.key)} type="button"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: `${C.gold}12`, border: `1px solid ${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{sec.icon}</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#E8E4DC' }}>{sec.title}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sec.sub}</div>
                  </div>
                </div>
                <ChevronDown size={14} style={{ color: C.muted, transform: section === sec.key ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
              </button>
              {section === sec.key && (
                <div style={{ padding: '0 16px 20px', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ paddingTop: 16 }}>{sec.content}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: `${C.muted}60`, margin: '0 0 8px' }}>
            Support: <a href="mailto:Riahig45@gmail.com" style={{ color: `${C.gold}80`, textDecoration: 'none' }}>Riahig45@gmail.com</a>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <a href="/privacy" style={{ fontSize: 10, color: `${C.muted}50`, textDecoration: 'none' }}>Privacy Policy</a>
            <span style={{ color: `${C.muted}30`, fontSize: 10 }}>·</span>
            <a href="/terms" style={{ fontSize: 10, color: `${C.muted}50`, textDecoration: 'none' }}>Terms of Service</a>
          </div>
        </div>
      </div>
    </main>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// BUYER TAB
// ─────────────────────────────────────────────────────────────────────────────
function BuyerTab({ user }: { user: PiUser }) {
  const [sellerWallet, setSellerWallet] = useState('');
  const [amount, setAmount]             = useState('');
  const [desc, setDesc]                 = useState('');
  const [creating, setCreating]         = useState(false);
  const [createErr, setCreateErr]       = useState<string | null>(null);
  const [result, setResult]             = useState<EscrowResult | null>(null);
  const [showBK, setShowBK]             = useState(false);
  const [showSK, setShowSK]             = useState(false);

  const [relCode, setRelCode]       = useState('');
  const [relKey, setRelKey]         = useState('');
  const [relConfirm, setRelConfirm] = useState('');
  const [relLoading, setRelLoading] = useState(false);
  const [relErr, setRelErr]         = useState<string | null>(null);
  const [relOk, setRelOk]           = useState<string | null>(null);

  const [disCode, setDisCode]       = useState('');
  const [disReason, setDisReason]   = useState('');
  const [disLoading, setDisLoading] = useState(false);
  const [disErr, setDisErr]         = useState<string | null>(null);
  const [disOk, setDisOk]           = useState<string | null>(null);

  const [evCode, setEvCode]     = useState('');
  const [evText, setEvText]     = useState('');
  const [evLoading, setEvLoading] = useState(false);
  const [evErr, setEvErr]       = useState<string | null>(null);
  const [evOk, setEvOk]         = useState(false);

  const [showKyc, setShowKyc]       = useState(false);
  const [kycConfirmed, setKycConfirmed] = useState(false);

  const fee = useMemo(() => { const v = parseFloat(amount); return isNaN(v) || v <= 0 ? 0 : v * 0.001; }, [amount]);

  const doCreate = async () => {
    setCreating(true); setCreateErr(null); setResult(null);
    try {
      const win = window as any;
      if (!win.Pi) throw new Error('Open this app in Pi Browser');
      const total = parseFloat(amount) + fee;
      let pending: EscrowResult | null = null;
      await new Promise<void>((resolve, reject) => {
        win.Pi.createPayment(
          { amount: total, memo: ('PTrust: ' + (desc || 'Escrow')).substring(0, 28), metadata: { seller: sellerWallet, buyer: user.username } },
          {
            onReadyForServerApproval: async (paymentId: string) => {
              try {
                const res = await apiFetch('/api/escrow/create', { paymentId, sellerWallet, amount: parseFloat(amount), fee, description: desc || 'No description', buyerUsername: user.username });
                pending = { transactionNumber: res.transactionNumber, escrowCode: res.escrowCode, buyerKey: res.buyerKey, sellerKey: res.sellerKey };
              } catch (e: any) { reject(e); }
            },
            onReadyForServerCompletion: async (paymentId: string, txid: string) => {
              try {
                await apiFetch('/api/escrow/finalize', { paymentId, txid });
                setResult(pending); setAmount(''); setSellerWallet(''); setDesc(''); resolve();
              } catch (e: any) { reject(e); }
            },
            onCancel: () => reject(new Error('Payment cancelled')),
            onError:  (e: Error) => reject(e),
          }
        );
      });
    } catch (e: any) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) >= 100 && !kycConfirmed) { setShowKyc(true); return; }
    doCreate();
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault(); setRelLoading(true); setRelErr(null); setRelOk(null);
    try {
      await apiFetch('/api/escrow/release', { escrowCode: relCode.toUpperCase(), buyerKey: relKey, confirmText: relConfirm, buyerUsername: user.username });
      setRelOk('Funds released successfully!'); setRelCode(''); setRelKey(''); setRelConfirm('');
    } catch (e: any) { setRelErr(e.message); }
    finally { setRelLoading(false); }
  };

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault(); setDisLoading(true); setDisErr(null); setDisOk(null);
    try {
      const res = await apiFetch('/api/escrow/dispute', { escrowCode: disCode.toUpperCase(), buyerUsername: user.username, reason: disReason });
      setDisOk('Dispute opened. Evidence deadline: ' + new Date(res.evidenceDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      setDisCode(''); setDisReason('');
    } catch (e: any) { setDisErr(e.message); }
    finally { setDisLoading(false); }
  };

  const handleEvidence = async (e: React.FormEvent) => {
    e.preventDefault(); setEvLoading(true); setEvErr(null); setEvOk(false);
    try {
      await apiFetch('/api/escrow/evidence', { escrowCode: evCode.toUpperCase(), username: user.username, content: evText });
      setEvOk(true); setEvText('');
    } catch (e: any) { setEvErr(e.message); }
    finally { setEvLoading(false); }
  };

  const s = { display: 'flex', flexDirection: 'column' as const, gap: 12 };

  return (
    <div style={s}>
      {/* KYC Modal */}
      {showKyc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(10,9,8,.88)', backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 360, width: '100%', background: C.card, border: `1.5px solid ${C.gold}40`, borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Seal size={42} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: C.gold }}>Large Transaction Warning</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Transactions over 100 Pi require KYC</div>
              </div>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#C8C0B4', margin: 0 }}>Both parties must have completed KYC verification on Pi Network to proceed with this transaction.</p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={kycConfirmed} onChange={e => setKycConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: C.gold }} />
              <span style={{ fontSize: 11, color: '#C8C0B4', lineHeight: 1.5 }}>I confirm both parties have completed KYC on Pi Network</span>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowKyc(false)} type="button"
                style={{ flex: 1, padding: '12px', borderRadius: 16, fontWeight: 800, fontSize: 12, background: C.card2, color: C.muted, border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button disabled={!kycConfirmed} onClick={() => { setShowKyc(false); doCreate(); }} type="button"
                style={{ flex: 1, padding: '12px', borderRadius: 16, fontWeight: 800, fontSize: 12, background: `linear-gradient(135deg,${C.gold},${C.goldD})`, color: C.card, border: 'none', cursor: kycConfirmed ? 'pointer' : 'not-allowed', opacity: kycConfirmed ? 1 : 0.35 }}>Proceed</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Escrow */}
      {!result ? (
        <Card style={{ boxShadow: `0 0 0 1px ${C.gold}15, 0 8px 32px rgba(0,0,0,.4)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: `${C.gold}12`, border: `1px solid ${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} style={{ color: C.gold }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#E8E4DC' }}>Create Escrow</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Pay via Pi Browser · 0.1% platform fee</div>
            </div>
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Seller Wallet Address">
              <InputBase required placeholder="G…" value={sellerWallet} onChange={e => setSellerWallet(e.target.value)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Amount (π)">
                <InputBase required type="number" min="0.000001" max="1000000" step="0.000001" placeholder="0.000000"
                  value={amount} onChange={e => setAmount(e.target.value)} big gold />
              </Field>
              <Field label="Fee (0.1%)" hint="auto">
                <div style={{ background: `${C.card}80`, border: `1px solid ${C.border}20`, borderRadius: 16, padding: '14px 18px', fontSize: 18, fontWeight: 800, color: C.muted }}>
                  {fee > 0 ? fee.toFixed(6) : '—'}
                </div>
              </Field>
            </div>
            <Field label="Deal Terms" hint="optional">
              <TextArea placeholder="Describe the goods or service being exchanged…" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
            </Field>
            {createErr && <ErrBox msg={createErr} />}
            <PrimaryBtn type="submit" disabled={creating || !amount || !sellerWallet}>
              {creating ? <><Spin /> Processing…</> : <><Lock size={14} /> Lock Funds in Escrow</>}
            </PrimaryBtn>
          </form>
        </Card>
      ) : (
        <div style={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingInline: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `${C.sage}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: C.sage }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.sage }}>Escrow Created!</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>Keys shown only once — save them now</div>
            </div>
          </div>

          {/* TX Number */}
          <Card>
            <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', color: C.muted, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Hash size={9} /> Transaction Number
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, color: C.gold, letterSpacing: '0.05em', marginBottom: 8 }}>{result.transactionNumber}</div>
            <CopyBtn text={result.transactionNumber} label="Copy TX#" />
          </Card>

          {/* Escrow Code */}
          <Card style={{ border: `1.5px solid ${C.gold}25`, boxShadow: `0 0 0 1px ${C.gold}10` }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', color: `${C.gold}80`, marginBottom: 8 }}>Escrow Code — Share with Seller</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 30, color: C.gold, letterSpacing: '0.1em', marginBottom: 12 }}>{result.escrowCode}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <CopyBtn text={result.escrowCode} label="Copy Code" />
              <button type="button"
                onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(`PTrust Escrow Deal\nCode: ${result.escrowCode}\nSeller Key: ${result.sellerKey}\nAmount: ${amount} Pi\nLink: https://pts-v1.vercel.app`))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: `${C.sage}15`, color: C.sage, border: `1px solid ${C.sage}30` }}>
                <Share2 size={11} /> WhatsApp
              </button>
            </div>
          </Card>

          {/* Buyer Key */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', color: `${C.gold}70` }}>Your Buyer Key — Keep Private</div>
              <button type="button" onClick={() => setShowBK(!showBK)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
                {showBK ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#E8E4DC', letterSpacing: '0.08em', marginBottom: 6 }}>
              {showBK ? result.buyerKey : 'BK-••••••••'}
            </div>
            <div style={{ fontSize: 9, color: `${C.gold}50`, marginBottom: 10 }}>Never share. Required to release funds or open dispute.</div>
            <CopyBtn text={result.buyerKey} label="Copy Buyer Key" />
          </Card>

          {/* Seller Key */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', color: `${C.sky}70` }}>Seller Key — Send to Seller</div>
              <button type="button" onClick={() => setShowSK(!showSK)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
                {showSK ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#E8E4DC', letterSpacing: '0.08em', marginBottom: 6 }}>
              {showSK ? result.sellerKey : 'SK-••••••••'}
            </div>
            <div style={{ fontSize: 9, color: `${C.sky}50`, marginBottom: 10 }}>Share with seller — required to accept the deal.</div>
            <CopyBtn text={result.sellerKey} label="Copy Seller Key" />
          </Card>

          <InfoBanner msg="Send the Escrow Code AND Seller Key to the seller. Keep your Buyer Key private." />

          <button type="button" onClick={() => { setResult(null); setShowBK(false); setShowSK(false); }}
            style={{ width: '100%', padding: 12, fontSize: 11, fontWeight: 800, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            + Create Another Escrow
          </button>
        </div>
      )}

      {/* Release Funds */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: `${C.sage}12`, border: `1px solid ${C.sage}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} style={{ color: C.sage }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#E8E4DC' }}>Confirm Receipt</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Release funds after receiving the goods</div>
          </div>
        </div>
        <form onSubmit={handleRelease} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Escrow Code">
            <InputBase required placeholder="PTO-XXXXXX" value={relCode} onChange={e => setRelCode(e.target.value.toUpperCase())} mono gold />
          </Field>
          <Field label="Buyer Key">
            <InputBase required placeholder="BK-XXXXXXXX" value={relKey} onChange={e => setRelKey(e.target.value)} />
          </Field>
          <div style={{ background: `${C.gold}05`, border: `1px solid ${C.gold}15`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: `${C.gold}80`, marginBottom: 8 }}>Type CONFIRM to authorize this irreversible release</div>
            <input placeholder="CONFIRM" value={relConfirm} onChange={e => setRelConfirm(e.target.value)}
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.gold}25`, borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 800, textAlign: 'center', letterSpacing: '0.3em', color: C.gold, outline: 'none' }} />
          </div>
          {relErr && <ErrBox msg={relErr} />}
          {relOk  && <OkBox  msg={relOk} />}
          <PrimaryBtn type="submit" variant="sage" disabled={relLoading || !!relOk || relConfirm !== 'CONFIRM' || !relCode || !relKey}>
            {relLoading ? <><Spin /> Releasing…</> : '✓ Received — Release Funds to Seller'}
          </PrimaryBtn>
        </form>
      </Card>

      {/* Open Dispute */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: `${C.terra}12`, border: `1px solid ${C.terra}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={18} style={{ color: C.terra }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#E8E4DC' }}>Not Received — Dispute</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Freeze funds and begin dispute process</div>
          </div>
        </div>
        <form onSubmit={handleDispute} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Escrow Code">
            <InputBase required placeholder="PTO-XXXXXX" value={disCode} onChange={e => setDisCode(e.target.value.toUpperCase())} mono />
          </Field>
          <Field label="Describe the Issue">
            <TextArea required placeholder="What went wrong? Be specific…" value={disReason} onChange={e => setDisReason(e.target.value)} rows={3} />
          </Field>
          {disErr && <ErrBox msg={disErr} />}
          {disOk  && <OkBox  msg={disOk} />}
          <PrimaryBtn type="submit" variant="danger" disabled={disLoading || !!disOk}>
            {disLoading ? <><Spin /> Processing…</> : <><XCircle size={14} /> Freeze Funds & Open Dispute</>}
          </PrimaryBtn>
        </form>
      </Card>

      {/* Submit Evidence */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: `${C.sky}12`, border: `1px solid ${C.sky}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} style={{ color: C.sky }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#E8E4DC' }}>Submit Evidence</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>15-day window after dispute is opened</div>
          </div>
        </div>
        <form onSubmit={handleEvidence} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Escrow Code">
            <InputBase required placeholder="PTO-XXXXXX" value={evCode} onChange={e => setEvCode(e.target.value.toUpperCase())} mono />
          </Field>
          <Field label="Evidence" hint="max 5 items">
            <TextArea required placeholder="URL, tracking number, description, or any supporting proof…" value={evText} onChange={e => setEvText(e.target.value)} rows={4} />
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
  const [code, setCode]     = useState('');
  const [key, setKey]       = useState('');
  const [tx, setTx]         = useState<Transaction | null>(null);
  const [err, setErr]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rated, setRated]   = useState(false);

  const delayWarning = tx && tx.status === 'ACCEPTED' && (Date.now() - new Date(tx.createdAt).getTime()) > 3 * 24 * 60 * 60 * 1000;

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault(); if (!code) return;
    setLoading(true); setErr(null); setTx(null);
    try {
      const res = await fetch('/api/escrow/transaction/' + code.toUpperCase());
      const d   = await res.json();
      if (!d.success) throw new Error(d.error);
      setTx(d.transaction);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const accept = async () => {
    if (!tx || !key) { setErr('Enter your Seller Key'); return; }
    setLoading(true); setErr(null);
    try {
      await apiFetch('/api/escrow/accept', { escrowCode: tx.escrowCode, sellerUsername: user.username, sellerKey: key });
      setTx({ ...tx, status: 'ACCEPTED', sellerUsername: user.username }); setKey('');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const deliver = async () => {
    if (!tx) return; setLoading(true); setErr(null);
    try {
      await apiFetch('/api/escrow/complete', { escrowCode: tx.escrowCode, sellerUsername: user.username });
      setTx({ ...tx, status: 'DELIVERED' });
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const rate = async (n: number) => {
    if (!tx) return;
    try { await apiFetch('/api/escrow/rate', { escrowCode: tx.escrowCode, rating: n, raterUsername: user.username }); setRated(true); } catch { }
  };

  const s = { display: 'flex', flexDirection: 'column' as const, gap: 12 };

  return (
    <div style={s}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: `${C.sky}12`, border: `1px solid ${C.sky}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={18} style={{ color: C.sky }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#E8E4DC' }}>Seller Dashboard</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Enter Escrow Code and Seller Key</div>
          </div>
        </div>

        {!tx ? (
          <form onSubmit={lookup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Escrow Code" hint="From buyer">
              <input required placeholder="PTO-XXXXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                style={{ width: '100%', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', fontSize: 24, fontWeight: 800, textAlign: 'center', letterSpacing: '0.15em', color: C.gold, outline: 'none', fontFamily: 'monospace' }} />
            </Field>
            <Field label="Seller Key" hint="From buyer">
              <InputBase placeholder="SK-XXXXXXXX" value={key} onChange={e => setKey(e.target.value)} />
            </Field>
            {err && <ErrBox msg={err} />}
            <PrimaryBtn type="submit" disabled={loading || !code}>
              {loading ? <><Spin /> Looking Up…</> : <><Key size={14} /> Find Escrow</>}
            </PrimaryBtn>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <DealTracker status={tx.status} />

            {delayWarning && <InfoBanner msg="⚠️ 3 days without delivery — buyer may open a dispute soon" type="terra" />}

            <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { l: 'TX Number',   v: <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: C.gold }}>{tx.transactionNumber}</span> },
                { l: 'Escrow Code', v: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: C.gold }}>{tx.escrowCode}</span> },
                { l: 'Amount',      v: <span style={{ fontWeight: 800, fontSize: 18, color: '#E8E4DC' }}>{tx.amount} <span style={{ color: C.gold }}>π</span></span> },
                { l: 'Buyer',       v: <span style={{ fontWeight: 800, fontSize: 13, color: '#E8E4DC' }}>@{tx.buyerUsername}</span> },
                { l: 'Status',      v: <StatusBadge status={tx.status} /> },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', color: C.muted }}>{l}</span>{v}
                </div>
              ))}
              {tx.description && (
                <div style={{ paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', color: C.muted, marginBottom: 6 }}>Deal Terms</div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: '#E8E4DC', margin: 0 }}>{tx.description}</p>
                </div>
              )}
            </div>

            {tx.status === 'PENDING' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoBanner msg="Review deal terms. Enter your Seller Key to accept and lock funds." />
                <Field label="Seller Key">
                  <InputBase placeholder="SK-XXXXXXXX" value={key} onChange={e => setKey(e.target.value)} />
                </Field>
                <PrimaryBtn onClick={accept} disabled={loading}>
                  {loading ? <><Spin /> Processing…</> : <><Shield size={14} /> Accept Deal</>}
                </PrimaryBtn>
              </div>
            )}
            {tx.status === 'ACCEPTED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoBanner msg="Deal accepted. Deliver goods or complete service, then confirm." />
                <PrimaryBtn onClick={deliver} disabled={loading}>
                  {loading ? <><Spin /> Processing…</> : <><Package size={14} /> Confirm Delivery Sent</>}
                </PrimaryBtn>
              </div>
            )}
            {tx.status === 'DELIVERED'    && <InfoBanner msg="Delivery confirmed. Waiting for buyer to release funds." type="sky" />}
            {tx.status === 'FROZEN'       && <InfoBanner msg="Dispute opened. Submit your evidence within 15 days." type="sky" />}
            {tx.status === 'UNDER_REVIEW' && <InfoBanner msg="Admin is reviewing evidence. Decision coming soon." type="sky" />}
            {tx.status === 'RELEASED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <OkBox msg={`Payment of ${tx.amount} π released to your wallet.`} />
                {!rated
                  ? <Card><div style={{ fontSize: 10, fontWeight: 800, color: C.muted, marginBottom: 12 }}>Rate this transaction</div><Stars onRate={rate} /></Card>
                  : <OkBox msg="Thank you for rating!" />}
              </div>
            )}
            {tx.status === 'REFUNDED' && <InfoBanner msg="Dispute resolved in favor of the buyer. Funds refunded." type="sky" />}
            {err && <ErrBox msg={err} />}

            <button type="button" onClick={() => { setTx(null); setCode(''); setKey(''); setErr(null); setRated(false); }}
              style={{ width: '100%', padding: 12, fontSize: 11, fontWeight: 800, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
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
function TransactionsTab({ user }: { user: PiUser }) {
  const [list, setList]     = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

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
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(t =>
      t.escrowCode?.toLowerCase().includes(q) ||
      t.transactionNumber?.toLowerCase().includes(q) ||
      t.buyerUsername?.toLowerCase().includes(q) ||
      t.sellerUsername?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }, [list, search]);

  const rate = async (escrowCode: string, n: number) => {
    try {
      await apiFetch('/api/escrow/rate', { escrowCode, rating: n, raterUsername: user.username });
      setList(prev => prev.map(t => t.escrowCode === escrowCode ? { ...t, rating: n } : t));
    } catch { }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#E8E4DC' }}>My Deals</div>
        <button type="button" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: C.gold, background: 'none', border: 'none', cursor: 'pointer' }}>
          <RefreshCw size={11} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '10px 14px' }}>
        <Search size={14} style={{ color: C.muted, flexShrink: 0 }} />
        <input placeholder="Search by code or username…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#E8E4DC' }} />
        {search && <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={13} /></button>}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.3 }}><Seal size={52} /></div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#E8E4DC' }}>{search ? 'No results found' : 'No transactions yet'}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{search ? 'Try a different search term' : 'Create your first escrow in Buyer'}</div>
        </div>
      )}

      {filtered.map(tx => {
        const delay = tx.status === 'ACCEPTED' && (Date.now() - new Date(tx.createdAt).getTime()) > 3 * 24 * 60 * 60 * 1000;
        return (
          <Card key={tx._id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: C.gold }}>{tx.transactionNumber || tx.escrowCode}</span>
              <StatusBadge status={tx.status} />
            </div>
            {delay && <InfoBanner msg="⚠️ 3 days without delivery" type="terra" />}
            <DealTracker status={tx.status} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Amount</span>
              <span style={{ fontWeight: 800, color: '#E8E4DC' }}>{tx.amount} <span style={{ color: C.gold }}>π</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Role</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: tx.buyerUsername === user.username ? `${C.gold}12` : `${C.sky}12`, color: tx.buyerUsername === user.username ? C.gold : C.sky }}>
                {tx.buyerUsername === user.username ? 'Buyer' : 'Seller'}
              </span>
            </div>
            {tx.description && <div style={{ fontSize: 10, lineHeight: 1.6, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>{tx.description}</div>}
            <div style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, color: `${C.muted}60` }}>
              <Clock size={9} />{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {tx.status === 'RELEASED' && !tx.rating && (
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}>Rate this deal</div>
                <Stars onRate={n => rate(tx.escrowCode, n)} />
              </div>
            )}
            {tx.status === 'RELEASED' && tx.rating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                <Stars value={tx.rating} />
                <span style={{ fontSize: 9, color: C.muted }}>Rated</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ReceiptsTab({ username }: { username: string }) {
  const [list, setList]       = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/escrow/transactions?username=' + username);
        const d   = await res.json();
        setList((d.transactions || []).filter((t: Transaction) => t.status === 'RELEASED'));
      } catch { }
      finally { setLoading(false); }
    })();
  }, [username]);

  const generatePDF = (tx: Transaction) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Receipt ${tx.transactionNumber}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 580px; margin: 48px auto; color: #1C1A17; padding: 0 24px; }
        .header { text-align: center; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 3px solid #F5C46C; }
        .logo { font-size: 36px; font-weight: 900; letter-spacing: -1px; }
        .gold { color: #F5C46C; }
        .sub { color: #8A8378; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; margin-top: 4px; }
        .badge { display: inline-block; background: #5C8374; color: #fff; padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-top: 12px; }
        .row { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid #E8E4DC; }
        .row:last-child { border-bottom: none; }
        .k { color: #8A8378; font-size: 12px; }
        .v { font-weight: 700; font-size: 13px; text-align: right; max-width: 60%; }
        .footer { text-align: center; margin-top: 40px; color: #8A8378; font-size: 10px; line-height: 1.8; }
      </style></head><body>
      <div class="header">
        <div class="logo">P<span class="gold">TRUST</span></div>
        <div class="sub">Oracle · Escrow Protocol</div>
        <div class="badge">✓ OFFICIAL RECEIPT</div>
      </div>
      <div class="row"><span class="k">Transaction Number</span><span class="v">${tx.transactionNumber}</span></div>
      <div class="row"><span class="k">Escrow Code</span><span class="v">${tx.escrowCode}</span></div>
      <div class="row"><span class="k">Date</span><span class="v">${new Date(tx.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      <div class="row"><span class="k">Buyer</span><span class="v">@${tx.buyerUsername}</span></div>
      <div class="row"><span class="k">Amount</span><span class="v">${tx.amount} Pi</span></div>
      <div class="row"><span class="k">Platform Fee (0.1%)</span><span class="v">${(tx.fee || tx.amount * 0.001).toFixed(6)} Pi</span></div>
      <div class="row"><span class="k">Description</span><span class="v">${tx.description || 'N/A'}</span></div>
      <div class="row"><span class="k">Status</span><span class="v" style="color:#5C8374">✓ RELEASED</span></div>
      <div class="footer">This receipt is generated by PTrust Oracle<br>Secured on Pi Network Blockchain<br>pts-v1.vercel.app</div>
      </body></html>
    `);
    w.document.close(); w.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: `${C.gold}12`, border: `1px solid ${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileDown size={18} style={{ color: C.gold }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#E8E4DC' }}>Transaction Receipts</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Download official receipts for completed deals</div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && list.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.3 }}><Seal size={52} /></div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#E8E4DC' }}>No completed transactions yet</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Receipts appear here after funds are released</div>
        </div>
      )}

      {list.map(tx => (
        <Card key={tx._id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: C.gold }}>{tx.transactionNumber}</span>
            <StatusBadge status={tx.status} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Amount</span>
              <span style={{ fontWeight: 800, color: '#E8E4DC' }}>{tx.amount} <span style={{ color: C.gold }}>π</span></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Date</span>
              <span style={{ fontSize: 11, color: '#E8E4DC' }}>{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            {tx.description && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Description</span>
                <span style={{ fontSize: 11, color: '#E8E4DC', textAlign: 'right', maxWidth: '60%' }}>{tx.description}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={() => generatePDF(tx)}
            style={{ width: '100%', padding: '14px', borderRadius: 16, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', border: 'none', background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, color: C.card, boxShadow: `0 6px 20px rgba(245,196,108,.20)` }}>
            <FileDown size={14} /> Download PDF Receipt
          </button>
        </Card>
      ))}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// STATS TAB
// ─────────────────────────────────────────────────────────────────────────────
function StatsTab({ user }: { user: PiUser }) {
  const [list, setList]           = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(true);
  const [piPrice, setPiPrice]     = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('https://api.kraken.com/0/public/Ticker?pair=PIUSD');
        const data = await res.json();
        const ticker = data?.result?.PIUSD ?? data?.result?.['PI/USD'];
        const price  = ticker ? parseFloat(ticker.c[0]) : NaN;
        if (!isNaN(price)) { setPiPrice(price); return; }
        throw new Error('no price');
      } catch {
        try {
          const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd');
          const data = await res.json();
          setPiPrice(data?.['pi-network']?.usd || null);
        } catch { setPiPrice(null); }
      } finally { setPriceLoading(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/escrow/transactions?username=' + user.username);
        const d   = await res.json();
        setList(d.transactions || []);
      } catch { }
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

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ paddingInline: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#E8E4DC' }}>Statistics</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>@{user.username}&apos;s overview</div>
      </div>

      {/* Pi Price */}
      <div style={{ padding: '14px 16px', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${C.gold}10, ${C.gold}04)`, border: `1px solid ${C.gold}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Seal size={40} />
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: C.muted }}>Pi / USD · Kraken</div>
            {priceLoading
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}><Spin /><span style={{ fontSize: 11, color: C.muted }}>Loading…</span></div>
              : piPrice
                ? <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 22, color: C.gold, marginTop: 2 }}>{'$' + piPrice.toFixed(4)}</div>
                : <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Unavailable</div>
            }
          </div>
        </div>
        {piPrice && stats.totalPi > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontWeight: 800 }}>Your Total</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.sage, marginTop: 2 }}>{'$' + (stats.totalPi * piPrice).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { l: 'Total Deals',     v: stats.total,                     c: C.gold,  I: Activity       },
          { l: 'Completed',       v: stats.released,                  c: C.sage,  I: CheckCircle2   },
          { l: 'Active Disputes', v: stats.disputed,                  c: C.terra, I: AlertTriangle  },
          { l: 'π Transacted',    v: stats.totalPi.toFixed(3) + ' π', c: C.gold,  I: TrendingUp     },
        ].map(({ l, v, c, I }) => (
          <Card key={l} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <I size={14} style={{ color: c, opacity: 0.6 }} />
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 26, color: c }}>{v}</div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted }}>{l}</div>
          </Card>
        ))}
      </div>

      {/* Role breakdown */}
      <Card>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginBottom: 14 }}>Role Breakdown</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: `${C.gold}08`, border: `1px solid ${C.gold}15`, borderRadius: 18, padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 28, color: C.gold }}>{stats.asBuyer}</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>As Buyer</div>
          </div>
          <div style={{ flex: 1, background: `${C.sky}08`, border: `1px solid ${C.sky}15`, borderRadius: 18, padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 28, color: C.sky }}>{stats.asSeller}</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>As Seller</div>
          </div>
        </div>
      </Card>

      {/* Success rate */}
      {stats.total > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted }}>Success Rate</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: C.sage }}>{Math.round((stats.released / stats.total) * 100)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: `${C.muted}20` }}>
            <div style={{ height: '100%', borderRadius: 99, width: (stats.released / stats.total * 100) + '%', background: `linear-gradient(90deg, ${C.sage}, ${C.sage}90)`, transition: 'width .8s ease' }} />
          </div>
        </Card>
      )}

      {/* Support */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Seal size={34} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#E8E4DC' }}>Support</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Response within 24 hours</div>
          </div>
        </div>
        <PrimaryBtn variant="ghost" onClick={() => window.open('mailto:Riahig45@gmail.com?subject=PTrust Oracle Support')}>
          <Mail size={14} /> Contact Support
        </PrimaryBtn>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
          <a href="/privacy" style={{ fontSize: 9, color: `${C.muted}60`, textDecoration: 'none' }}>Privacy Policy</a>
          <span style={{ color: `${C.muted}30` }}>·</span>
          <a href="/terms" style={{ fontSize: 9, color: `${C.muted}60`, textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT TAB
// ─────────────────────────────────────────────────────────────────────────────
function ChatTab({ username }: { username: string }) {
  const [messages, setMessages]   = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      const d   = await res.json();
      if (d.success) setMessages(d.messages || []);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMessages(); const iv = setInterval(loadMessages, 30_000); return () => clearInterval(iv); }, [loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try { await apiFetch('/api/messages', { username, text: newMessage.trim() }); setNewMessage(''); await loadMessages(); }
    catch { }
    finally { setSending(false); }
  };

  const EMOJIS = ['😊', '👍', '🔒', '✅', '💰', '🤝', '🚀', '❓', '⚡', '🛡️'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#E8E4DC' }}>Community Chat</div>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, fontWeight: 800, background: `${C.sage}12`, color: C.sage }}>{messages.length} msgs</span>
        </div>
        <button type="button" onClick={loadMessages} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.3 }}><Seal size={48} /></div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#E8E4DC' }}>No messages yet</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Be the first to say hello!</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.username === username;
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 3 }}>
                {!isMe && <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, paddingInline: 2 }}>@{msg.username}</span>}
                <div style={{
                  padding: '10px 14px', fontSize: 13, lineHeight: 1.4,
                  ...(isMe
                    ? { background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, color: C.card, borderRadius: '18px 18px 4px 18px', fontWeight: 700 }
                    : { background: C.card2, color: '#E8E4DC', border: `1px solid ${C.border}`, borderRadius: '18px 18px 18px 4px' }
                  ),
                }}>{msg.text}</div>
                <span style={{ fontSize: 8, color: `${C.muted}60`, paddingInline: 2 }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Emoji row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', flexShrink: 0, paddingBottom: 2 }}>
        {EMOJIS.map(e => (
          <button key={e} type="button"
            onClick={() => setNewMessage(prev => (prev + e).slice(0, 500))}
            style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, fontSize: 16, background: C.card2, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {e}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          placeholder="Write a message…" value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          maxLength={500}
          style={{ flex: 1, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 18, padding: '12px 16px', fontSize: 13, color: '#E8E4DC', outline: 'none' }}
        />
        <button type="button" onClick={send} disabled={sending || !newMessage.trim()}
          style={{ width: 46, height: 46, borderRadius: 16, border: 'none', cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer', opacity: sending || !newMessage.trim() ? 0.4 : 1, background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send size={16} style={{ color: C.card }} />
        </button>
      </div>
      <div style={{ textAlign: 'right', marginTop: 4, fontSize: 9, color: `${C.muted}60` }}>{newMessage.length}/500</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
function ProfileTab({ username }: { username: string }) {
  const [list, setList]           = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/escrow/transactions?username=' + username);
        const d   = await res.json();
        setList(d.transactions || []);
      } catch { }
      finally { setLoading(false); }
    })();
  }, [username]);

  const stats = useMemo(() => {
    const total    = list.length;
    const released = list.filter(t => t.status === 'RELEASED').length;
    const asBuyer  = list.filter(t => t.buyerUsername === username).length;
    const asSeller = list.filter(t => t.sellerUsername === username).length;
    const ratings  = list.filter(t => t.rating).map(t => t.rating as number);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const badge = total >= 20
      ? { label: 'Elite Merchant', color: C.gold,   bg: `${C.gold}12`,   emoji: '💎' }
      : total >= 5
      ? { label: 'Trusted Trader', color: C.sage,   bg: `${C.sage}12`,   emoji: '🤝' }
      : { label: 'New Pioneer',    color: C.sky,    bg: `${C.sky}12`,    emoji: '🚀' };
    const memberSince = list.length > 0 ? new Date(list[list.length - 1].createdAt) : new Date();
    return { total, released, asBuyer, asSeller, avgRating, badge, memberSince };
  }, [list, username]);

  const trust = useMemo(() => calculateTrustScore(list), [list]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  const circ  = 2 * Math.PI * 38;
  const dash  = circ - (trust.score / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Profile hero */}
      <Card style={{ boxShadow: `0 0 0 1px ${C.gold}12, 0 8px 32px rgba(0,0,0,.4)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: C.card }}>
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 18, color: '#E8E4DC' }}>@{username}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', borderRadius: 99, background: stats.badge.bg, color: stats.badge.color, fontSize: 10, fontWeight: 800 }}>
              {stats.badge.emoji} {stats.badge.label}
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 5 }}>Member since {stats.memberSince.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        {/* Trust ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" style={{ position: 'absolute', inset: 0 }}>
              <circle cx="48" cy="48" r="38" fill="none" stroke={`${C.muted}20`} strokeWidth="8" />
              <circle cx="48" cy="48" r="38" fill="none" stroke={trust.color} strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={dash}
                strokeLinecap="round" transform="rotate(-90 48 48)"
                style={{ transition: 'stroke-dashoffset 1s ease, stroke .5s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, color: trust.color }}>{trust.score}</span>
              <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: `${trust.color}70` }}>/ 100</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#E8E4DC', marginBottom: 4 }}>{trust.level}</div>
            {trust.score < 30  && <InfoBanner msg="⚠️ Low trust — other users may be cautious" type="terra" />}
            {trust.disputed > 2 && <InfoBanner msg="Multiple disputes detected" type="terra" />}
            <button type="button" onClick={() => setShowDetails(!showDetails)}
              style={{ fontSize: 10, fontWeight: 800, color: `${C.gold}70`, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, padding: 0 }}>
              {showDetails ? 'Hide' : 'Show'} score breakdown
            </button>
            {showDetails && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {trust.details.map((d, i) => (
                  <div key={i} style={{ fontSize: 10, color: d.startsWith('+') ? C.sage : C.terra }}>{d}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { l: 'Total Deals', v: stats.total,    c: C.gold },
          { l: 'Completed',   v: stats.released, c: C.sage },
          { l: 'As Buyer',    v: stats.asBuyer,  c: C.gold },
          { l: 'As Seller',   v: stats.asSeller, c: C.sky  },
        ].map(({ l, v, c }) => (
          <Card key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 28, color: c }}>{v}</div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginTop: 6 }}>{l}</div>
          </Card>
        ))}
      </div>

      {/* Average rating */}
      {stats.avgRating > 0 && (
        <Card>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginBottom: 12 }}>Average Rating</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Stars value={Math.round(stats.avgRating)} />
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 20, color: C.gold }}>{stats.avgRating.toFixed(1)}</span>
          </div>
        </Card>
      )}

      {/* Recent deals */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#E8E4DC' }}>Recent Deals</div>
        </div>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, opacity: 0.2 }}><Seal size={40} /></div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.muted }}>No transactions yet</div>
          </div>
        ) : list.slice(0, 5).map((tx, i) => (
          <div key={tx._id ?? i} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}>
            <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 8, flexShrink: 0, background: tx.buyerUsername === username ? `${C.gold}12` : `${C.sky}12`, color: tx.buyerUsername === username ? C.gold : C.sky, border: `1px solid ${tx.buyerUsername === username ? C.gold : C.sky}20` }}>
              {tx.buyerUsername === username ? 'Buyer' : 'Seller'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#E8E4DC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.transactionNumber || tx.escrowCode}</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#E8E4DC' }}>{tx.amount} <span style={{ color: C.gold }}>π</span></div>
              <StatusBadge status={tx.status} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TAB
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

  const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.status === filter);
  const FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'DELIVERED', 'FROZEN', 'RELEASED', 'REFUNDED', 'PENDING_ADMIN'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Admin header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 22, background: 'linear-gradient(135deg, rgba(196,69,54,.15), rgba(155,138,196,.08))', border: `1px solid rgba(196,69,54,.25)` }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${C.terra}20`, border: `1px solid ${C.terra}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={20} style={{ color: C.terra }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.terra }}>Admin Panel</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Full control · @{username}</div>
        </div>
        <button type="button" onClick={load}
          style={{ width: 36, height: 36, borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Platform stats */}
      {stats && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BarChart3 size={14} style={{ color: C.gold }} />
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.gold }}>Platform Overview</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
            {[
              { l: 'Total Pi',  v: transactions.filter(t => t.status === 'RELEASED').reduce((s, t) => s + t.amount, 0).toFixed(3) + ' π', c: C.gold },
              { l: 'Revenue',   v: transactions.filter(t => t.status === 'RELEASED').reduce((s, t) => s + (t.fee || t.amount * 0.001), 0).toFixed(4) + ' π', c: C.sage },
              { l: 'Users',     v: new Set([...transactions.map(t => t.buyerUsername), ...transactions.filter(t => t.sellerUsername).map(t => t.sellerUsername!)]).size, c: C.sky },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 8px' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 15, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {[
              { l: 'Total',     v: stats.total,     c: '#E8E4DC' },
              { l: 'Pending',   v: stats.pending,   c: C.gold    },
              { l: 'Delivered', v: stats.delivered, c: C.sky     },
              { l: 'Frozen',    v: stats.frozen,    c: C.terra   },
              { l: 'Released',  v: stats.released,  c: C.sage    },
            ].map(s => (
              <div key={s.l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 7, textTransform: 'uppercase', color: C.muted, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            style={{ padding: '5px 10px', borderRadius: 10, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', border: 'none', background: filter === f ? `${C.terra}20` : C.card2, color: filter === f ? C.terra : C.muted, borderWidth: 1, borderStyle: 'solid', borderColor: filter === f ? `${C.terra}30` : C.border }}>
            {f}
          </button>
        ))}
      </div>

      {msg && <OkBox  msg={msg} />}
      {err && <ErrBox msg={err} />}

      {/* Action panel */}
      {selected && (
        <div style={{ padding: 18, borderRadius: 22, background: `${C.terra}08`, border: `1px solid ${C.terra}25`, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', color: C.muted }}>Selected</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: C.terra, marginTop: 3 }}>{selected.escrowCode}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{selected.amount} π · @{selected.buyerUsername}</div>
            </div>
            <button type="button" onClick={() => setSelected(null)}
              style={{ width: 32, height: 32, borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
              <XCircle size={14} />
            </button>
          </div>
          <Field label="Reason / Note">
            <InputBase placeholder="Reason for this action…" value={reason} onChange={e => setReason(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Refund to Buyer',    action: 'refund',  extra: {},                      c: C.sage    },
              { label: 'Freeze',             action: 'freeze',  extra: {},                      c: C.sky     },
              { label: 'Release to Seller',  action: 'resolve', extra: { resolveFor: 'seller' }, c: C.gold   },
              { label: 'Resolve for Buyer',  action: 'resolve', extra: { resolveFor: 'buyer'  }, c: C.violet },
            ].map(({ label, action, extra, c }) => (
              <button key={label} type="button" onClick={() => doAction(action, selected.escrowCode, extra)}
                style={{ padding: '11px 8px', borderRadius: 14, fontSize: 11, fontWeight: 800, cursor: 'pointer', background: `${c}12`, border: `1px solid ${c}30`, color: c }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${C.terra}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}

      {filtered.map(tx => (
        <div key={tx._id} onClick={() => setSelected(selected?.escrowCode === tx.escrowCode ? null : tx)}
          style={{ padding: 16, borderRadius: 22, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all .15s', background: selected?.escrowCode === tx.escrowCode ? `${C.terra}10` : C.card, border: `1px solid ${selected?.escrowCode === tx.escrowCode ? `${C.terra}40` : C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: `${C.terra}90` }}>{tx.transactionNumber || tx.escrowCode}</span>
            <StatusBadge status={tx.status} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: C.muted }}>@{tx.buyerUsername} → @{tx.sellerUsername || '?'}</span>
            <span style={{ fontWeight: 800, color: '#E8E4DC' }}>{tx.amount} <span style={{ color: C.gold }}>π</span></span>
          </div>
          {tx.description && <div style={{ fontSize: 9, color: `${C.muted}70`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>}
          <div style={{ fontSize: 9, color: `${C.muted}50` }}>{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.2 }}>
            <Shield size={32} style={{ color: C.terra }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E4DC' }}>No transactions</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
function App({ user, onLogout }: { user: PiUser; onLogout: () => void }) {
  const isOnline = useOnlineStatus();
  const [tab, setTab] = useState<'home' | 'buyer' | 'seller' | 'transactions' | 'receipts' | 'stats' | 'chat' | 'profile' | 'admin'>('home');
  const username = user.username;
  const isAdmin  = username === 'GhaithriAHI96';

  const ICONS = [
    { key: 'buyer',        label: 'Buyer',    emoji: '🔒', bg: `linear-gradient(160deg, #2B2419, ${C.card})` },
    { key: 'seller',       label: 'Seller',   emoji: '📦', bg: `linear-gradient(160deg, #1A2329, ${C.card})` },
    { key: 'transactions', label: 'Deals',    emoji: '🤝', bg: `linear-gradient(160deg, #1F271F, ${C.card})` },
    { key: 'receipts',     label: 'Receipts', emoji: '📄', bg: `linear-gradient(160deg, #2B2419, ${C.card})` },
    { key: 'stats',        label: 'Stats',    emoji: '📊', bg: `linear-gradient(160deg, #211D2B, ${C.card})` },
    { key: 'chat',         label: 'Chat',     emoji: '💬', bg: `linear-gradient(160deg, #1A2329, ${C.card})` },
    { key: 'profile',      label: 'Profile',  emoji: '👤', bg: `linear-gradient(160deg, #2B2419, ${C.card})` },
    ...(isAdmin ? [{ key: 'admin', label: 'Admin', emoji: '🛡️', bg: `linear-gradient(160deg, #2B1A19, ${C.card})` }] : []),
  ] as const;

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: '#E8E4DC', paddingBottom: 40 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* Subtle top glow */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 200, background: `radial-gradient(ellipse at 50% -30%, rgba(245,196,108,.06), transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '24px 16px 0', position: 'relative', zIndex: 1 }}>

        {/* Offline banner */}
        {!isOnline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 16, fontSize: 11, fontWeight: 800, marginBottom: 16, background: 'rgba(196,69,54,.12)', color: C.terra, border: `1px solid rgba(196,69,54,.30)` }}>
            <span>📡</span> No internet connection — some features may not work
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Seal size={42} />
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 22, lineHeight: 1, letterSpacing: '-0.02em', margin: 0 }}>
                P<span style={{ color: C.gold }}>TRUST</span>
              </h1>
              <p style={{ fontSize: 10, color: C.muted, margin: 0, marginTop: 2 }}>@{username}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {tab !== 'home' && (
              <button type="button" onClick={() => setTab('home')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 12, fontSize: 10, fontWeight: 800, cursor: 'pointer', background: C.card2, border: `1px solid ${C.border}`, color: C.muted }}>
                <Home size={12} /> Home
              </button>
            )}
            <div style={{ width: 36, height: 36, borderRadius: 14, background: `linear-gradient(135deg, ${C.gold}, ${C.goldD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: C.card }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <button type="button" onClick={onLogout}
              style={{ width: 36, height: 36, borderRadius: 14, background: C.card2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* HOME — Icon Grid */}
        {tab === 'home' && (
          <div>
            {/* Onboarding tip */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 18, marginBottom: 20, background: `rgba(245,196,108,.06)`, border: `1px solid rgba(245,196,108,.12)` }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#E8E4DC' }}>New to PTrust?</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
                  Tap <strong style={{ color: C.gold }}>Buyer</strong> to create a secure escrow deal, or <strong style={{ color: C.sky }}>Seller</strong> to accept one. Your funds stay locked until both parties confirm.
                </div>
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: C.muted, marginBottom: 14 }}>Quick Access</div>

            {/* Icons 3×3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {ICONS.map(({ key, label, emoji, bg }) => (
                <button key={key} type="button" onClick={() => setTab(key as any)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{
                    width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, borderRadius: 22,
                    background: bg,
                    border: `1px solid ${key === 'admin' ? `rgba(196,69,54,.20)` : C.border}`,
                    boxShadow: '0 6px 20px rgba(0,0,0,.4), inset 0 1px 1px rgba(255,255,255,.04)',
                    transition: 'transform .15s',
                  }}>
                    {emoji}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: key === 'admin' ? C.terra : '#D8D2C5' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab content */}
        <div style={{ marginTop: tab !== 'home' ? 0 : 0 }}>
          {tab === 'buyer'        && <BuyerTab        user={user} />}
          {tab === 'seller'       && <SellerTab        user={user} />}
          {tab === 'transactions' && <TransactionsTab  user={user} />}
          {tab === 'receipts'     && <ReceiptsTab      username={username} />}
          {tab === 'stats'        && <StatsTab         user={user} />}
          {tab === 'chat'         && <ChatTab          username={username} />}
          {tab === 'profile'      && <ProfileTab       username={username} />}
          {tab === 'admin'        && isAdmin && <AdminTab username={username} />}
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [expired, setExpired]   = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleExpire = useCallback(() => setExpired(true), []);
  useSessionTimer(handleExpire, !!user);

  if (!mounted) return null;

  if (expired) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: C.bg, color: '#E8E4DC' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: 'center', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <Seal size={64} />
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 26, margin: '0 0 8px' }}>Session Expired</h2>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>You were inactive for 30 minutes. Please sign in again.</p>
        </div>
        <PrimaryBtn onClick={() => { setExpired(false); authenticateUser(); }}>
          <span style={{ fontSize: 18 }}>π</span> Sign In Again
        </PrimaryBtn>
      </div>
    </main>
  );

  if (loading) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <Seal size={72} />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 36, color: '#E8E4DC', margin: 0 }}>
          P<span style={{ color: C.gold }}>TRUST</span>
        </h1>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3em', color: C.muted, margin: 0 }}>Connecting to Pi Network…</p>
      </div>
    </main>
  );

  if (!user) return <Landing onLogin={authenticateUser} loading={loading} />;
  return <App user={user} onLogout={() => window.location.reload()} />;
}

// cache-bust: 1783917551566