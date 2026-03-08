'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import {
  ShieldCheck, Wallet, AlertCircle, CheckCircle2, ArrowRight, Lock, Zap,
  Copy, Share2, Key, Package, ClipboardList, Star, BarChart3, AlertTriangle,
  HelpCircle, ChevronDown, ChevronUp, LogOut, Clock, Mail, Shield, Hash,
  TrendingUp, Activity, ChevronRight, Eye, EyeOff, RefreshCw
} from 'lucide-react';

/* ─────────────────────────── Types ─────────────────────────── */
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
  status: 'PENDING' | 'ACCEPTED' | 'DELIVERED' | 'RELEASED' | 'DISPUTED' | 'PENDING_ADMIN';
  createdAt: string;
  acceptedAt?: string;
  deliveredAt?: string;
  releasedAt?: string;
  deliveryDeadline?: string;
  rating?: number;
  releaseAttempts?: number;
}

/* ─────────────────────────── API ─────────────────────────── */
async function createEscrow(data: { sellerWallet: string; amount: number; fee: number; description: string; buyerUsername: string }) {
  const res = await fetch('/api/escrow/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Oracle Error'); }
  return res.json();
}
async function fetchEscrowByCode(code: string) {
  const res = await fetch('/api/escrow/transaction/' + code);
  if (!res.ok) throw new Error('Escrow not found');
  return res.json();
}
async function acceptDeal(escrowCode: string, sellerUsername: string) {
  const res = await fetch('/api/escrow/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escrowCode, sellerUsername }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Accept failed'); }
  return res.json();
}
async function confirmDelivery(escrowCode: string, sellerUsername: string) {
  const res = await fetch('/api/escrow/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escrowCode, sellerUsername }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delivery confirmation failed'); }
  return res.json();
}
async function releaseEscrow(escrowCode: string, secretKey: string, confirmText: string, buyerUsername: string) {
  const res = await fetch('/api/escrow/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escrowCode, secretKey, confirmText, buyerUsername }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Release failed'); }
  return res.json();
}
async function fetchMyTransactions(username: string) {
  const res = await fetch('/api/escrow/transactions?username=' + username);
  if (!res.ok) throw new Error('Failed to load transactions');
  return res.json();
}
async function submitRating(escrowCode: string, rating: number, raterUsername: string) {
  const res = await fetch('/api/escrow/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escrowCode, rating, raterUsername }) });
  if (!res.ok) throw new Error('Rating failed');
  return res.json();
}

/* ─────────────────────────── Hooks ─────────────────────────── */
function useSessionTimer(onExpire: () => void) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const SESSION_DURATION = 30 * 60 * 1000;
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onExpire, SESSION_DURATION);
  }, [onExpire]);
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);
}

/* ─────────────────────────── Sub-components ─────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    PENDING:       { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/25',    dot: 'bg-amber-400',   label: 'Pending' },
    ACCEPTED:      { bg: 'bg-orange-500/10 text-orange-400 border-orange-500/25', dot: 'bg-orange-400',  label: 'Locked' },
    DELIVERED:     { bg: 'bg-sky-500/10 text-sky-400 border-sky-500/25',          dot: 'bg-sky-400',     label: 'Delivered' },
    RELEASED:      { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', label: 'Released' },
    DISPUTED:      { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/25',       dot: 'bg-rose-400',    label: 'Disputed' },
    PENDING_ADMIN: { bg: 'bg-violet-500/10 text-violet-400 border-violet-500/25', dot: 'bg-violet-400',  label: 'Admin Review' },
  };
  const s = map[status] || map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {s.label}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all duration-200
        ${copied ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-white/5 border border-white/8 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/15'}`}>
      {copied ? <CheckCircle2 size={11} /> : <Copy size={11} className="group-hover:scale-110 transition-transform" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function StarRating({ onRate, value }: { onRate: (n: number) => void; value?: number }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(value || 0);
  return (
    <div className="flex gap-1.5">
      {[1,2,3,4,5].map(n => (
        <button key={n}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => { setSelected(n); onRate(n); }}
          className="transition-all duration-150 hover:scale-110 active:scale-95">
          <Star size={20}
            className={n <= (hovered || selected) ? 'text-amber-400' : 'text-neutral-700'}
            fill={n <= (hovered || selected) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  const steps = [
    { icon: '🛒', step: '01', title: 'Create Escrow', desc: 'Buyer enters seller wallet, amount, and deal terms. Share the Escrow Code with seller.' },
    { icon: '🤝', step: '02', title: 'Seller Accepts', desc: 'Seller enters the code and accepts. Funds are locked in the Oracle vault.' },
    { icon: '📦', step: '03', title: 'Confirm Delivery', desc: 'After sending goods, seller presses Confirm Delivery to signal completion.' },
    { icon: '✅', step: '04', title: 'Release Funds', desc: 'Buyer verifies receipt using their Secret Key. Funds transfer to seller instantly.' },
    { icon: '⚖️', step: '05', title: 'Dispute Resolution', desc: 'Any issue? Open a dispute. Our admin team reviews and rules with finality.' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/6 bg-[#0d0d0d]">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/2 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <HelpCircle size={13} className="text-amber-400" />
          </div>
          <span className="font-black text-xs tracking-wide text-neutral-300">How PTrust Works</span>
        </div>
        <div className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} className="text-neutral-600" />
        </div>
      </button>
      {open && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3 items-start group">
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center text-[9px] font-black text-neutral-500 group-hover:bg-amber-500/15 group-hover:text-amber-400 transition-colors">
                {s.step}
              </div>
              <div className="pt-0.5">
                <div className="text-[11px] font-black text-white">{s.title}</div>
                <div className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InputField({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <label className="text-[9px] uppercase font-black tracking-[0.15em] text-amber-500/80">{label}</label>
        {sublabel && <span className="text-[9px] text-neutral-600">{sublabel}</span>}
      </div>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 text-rose-400 text-[11px] p-3.5 bg-rose-500/5 rounded-xl border border-rose-500/15 leading-relaxed">
      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 text-emerald-400 text-[11px] p-3.5 bg-emerald-500/5 rounded-xl border border-emerald-500/15 leading-relaxed">
      <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function InfoBox({ message, color = 'amber' }: { message: string; color?: 'amber' | 'blue' | 'green' }) {
  const c = { amber: 'text-amber-400 bg-amber-500/5 border-amber-500/15', blue: 'text-sky-400 bg-sky-500/5 border-sky-500/15', green: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15' }[color];
  return <div className={`text-[11px] font-medium p-3.5 rounded-xl border ${c} leading-relaxed`}>{message}</div>;
}

function Spinner() {
  return <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0d0d0d] border border-white/6 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-amber-400" />
      </div>
      <div>
        <h2 className="text-base font-black tracking-tight text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick, type = 'button', variant = 'gold' }: {
  children: React.ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'gold' | 'white' | 'ghost';
}) {
  const variants = {
    gold: 'bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300 shadow-[0_8px_32px_rgba(245,158,11,0.2)]',
    white: 'bg-white text-black hover:bg-amber-50',
    ghost: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={`w-full py-3.5 font-black rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-[12px] tracking-wide ${variants[variant]}`}>
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [mounted, setMounted] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [tab, setTab] = useState<'buyer' | 'seller' | 'transactions' | 'stats'>('buyer');

  /* Buyer state */
  const [sellerWallet, setSellerWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyerError, setBuyerError] = useState<string | null>(null);
  const [escrowResult, setEscrowResult] = useState<{ transactionNumber: string; escrowCode: string; secretKey: string; shareUrl: string } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  /* Release state */
  const [releaseCode, setReleaseCode] = useState('');
  const [releaseKey, setReleaseKey] = useState('');
  const [releaseConfirm, setReleaseConfirm] = useState('');
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);

  /* Seller state */
  const [sellerCode, setSellerCode] = useState('');
  const [sellerTx, setSellerTx] = useState<Transaction | null>(null);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);

  /* Transactions state */
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, released: 0, disputed: 0, totalPi: 0 });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/escrow\/([A-Z0-9-]+)/);
      if (match) { setTab('seller'); setSellerCode(match[1]); }
    }
  }, []);

  const handleSessionExpire = useCallback(() => { setSessionExpired(true); }, []);
  useSessionTimer(user ? handleSessionExpire : () => {});

  const fee = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) || val <= 0 ? 0 : val / 100;
  }, [amount]);

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setBuyerError('Connect Pi Wallet first.'); return; }
    setIsProcessing(true); setBuyerError(null); setEscrowResult(null);
    try {
      const result = await createEscrow({ sellerWallet, amount: parseFloat(amount), fee, description: description || 'No description', buyerUsername: user.username });
      const shareUrl = window.location.origin + '/escrow/' + result.escrowCode;
      setEscrowResult({ transactionNumber: result.transactionNumber, escrowCode: result.escrowCode, secretKey: result.secretKey, shareUrl });
      setAmount(''); setSellerWallet(''); setDescription('');
    } catch (err: any) { setBuyerError(err.message); }
    finally { setIsProcessing(false); }
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setReleaseLoading(true); setReleaseError(null);
    try {
      await releaseEscrow(releaseCode.toUpperCase(), releaseKey, releaseConfirm, user.username);
      setReleaseSuccess(true);
    } catch (err: any) { setReleaseError(err.message); }
    finally { setReleaseLoading(false); }
  };

  const handleLookupEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setSellerError('Connect Pi Wallet first.'); return; }
    setSellerLoading(true); setSellerError(null); setSellerTx(null);
    try {
      const result = await fetchEscrowByCode(sellerCode.toUpperCase());
      setSellerTx(result.transaction);
    } catch (err: any) { setSellerError(err.message); }
    finally { setSellerLoading(false); }
  };

  const handleAcceptDeal = async () => {
    if (!user || !sellerTx) return;
    setSellerLoading(true); setSellerError(null);
    try {
      await acceptDeal(sellerTx.escrowCode, user.username);
      setSellerTx({ ...sellerTx, status: 'ACCEPTED' });
    } catch (err: any) { setSellerError(err.message); }
    finally { setSellerLoading(false); }
  };

  const handleConfirmDelivery = async () => {
    if (!user || !sellerTx) return;
    setSellerLoading(true); setSellerError(null);
    try {
      await confirmDelivery(sellerTx.escrowCode, user.username);
      setSellerTx({ ...sellerTx, status: 'DELIVERED' });
    } catch (err: any) { setSellerError(err.message); }
    finally { setSellerLoading(false); }
  };

  const loadTransactions = async () => {
    if (!user) return;
    setTxLoading(true);
    try {
      const result = await fetchMyTransactions(user.username);
      const txs = result.transactions || [];
      setTransactions(txs);
      setStats({
        total: txs.length,
        released: txs.filter((t: Transaction) => t.status === 'RELEASED').length,
        disputed: txs.filter((t: Transaction) => t.status === 'DISPUTED').length,
        totalPi: txs.filter((t: Transaction) => t.status === 'RELEASED').reduce((a: number, t: Transaction) => a + t.amount, 0),
      });
    } catch { setTransactions([]); }
    finally { setTxLoading(false); }
  };

  useEffect(() => {
    if ((tab === 'transactions' || tab === 'stats') && user) loadTransactions();
  }, [tab, user]);

  const openDispute = (tx: Transaction) => {
    const subject = encodeURIComponent('PTrust Oracle Dispute - ' + tx.transactionNumber);
    const body = encodeURIComponent(
      'Transaction Number: ' + tx.transactionNumber +
      '\nEscrow Code: ' + tx.escrowCode +
      '\nAmount: ' + tx.amount + ' Pi' +
      '\nBuyer: @' + tx.buyerUsername +
      '\nSeller: @' + (tx.sellerUsername || 'unknown') +
      '\nStatus: ' + tx.status +
      '\nDescription: ' + tx.description +
      '\n\nPlease describe your issue:'
    );
    window.open('mailto:Riahig45@gmail.com?subject=' + subject + '&body=' + body);
  };

  if (!mounted) return null;

  /* ── Session Expired ── */
  if (sessionExpired) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#080808] text-white font-sans">
        <style>{globalStyles}</style>
        <div className="text-center space-y-6 max-w-xs w-full">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Clock size={24} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Session Expired</h2>
            <p className="text-neutral-500 text-sm mt-2 leading-relaxed">Inactive for 30 minutes. Sign in again to continue.</p>
          </div>
          <PrimaryButton onClick={() => { setSessionExpired(false); authenticateUser(); }}>
            <Wallet size={15} /> Sign In Again
          </PrimaryButton>
        </div>
      </main>
    );
  }

  /* ── Login Screen ── */
  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-5 bg-[#080808] text-white relative overflow-hidden">
        <style>{globalStyles}</style>

        {/* Atmospheric background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[10%] w-[300px] h-[300px] bg-amber-600/3 rounded-full blur-[80px]" />
          <div className="absolute top-[20%] right-[-5%] w-[200px] h-[400px] bg-orange-500/3 rounded-full blur-[60px]" />
          {/* Grid texture */}
          <div className="absolute inset-0 opacity-[0.015]" style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
        </div>

        <div className="relative flex flex-col items-center w-full max-w-sm space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/4 border border-white/8 text-neutral-400 text-[9px] font-black tracking-[0.2em] uppercase">
            <ShieldCheck size={11} className="text-amber-400" />
            Secured by Pi Network SDK 2.0
          </div>

          {/* Logo */}
          <div className="text-center space-y-1">
            <div className="relative inline-block">
              <h1 className="text-[72px] font-black tracking-[-0.04em] leading-none"
                style={{ fontFamily: "'Georgia', serif", letterSpacing: '-2px' }}>
                P<span className="text-transparent" style={{
                  WebkitTextStroke: '2px #f59e0b',
                  textShadow: '0 0 60px rgba(245,158,11,0.3)'
                }}>TRUST</span>
              </h1>
            </div>
            <p className="text-[10px] tracking-[0.5em] text-neutral-500 uppercase font-light">Oracle · Escrow Protocol</p>
          </div>

          {/* Description */}
          <p className="text-neutral-400 text-sm leading-relaxed text-center max-w-[280px]">
            The most secure escrow on Pi Network. Lock funds, verify delivery, release with confidence.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {[
              { value: '0%', label: 'Fraud Rate' },
              { value: '1%', label: 'Platform Fee' },
              { value: '24/7', label: 'Oracle Active' }
            ].map(s => (
              <div key={s.label} className="bg-[#0d0d0d] border border-white/6 rounded-xl py-3.5 text-center">
                <div className="text-xl font-black text-amber-400">{s.value}</div>
                <div className="text-[9px] text-neutral-600 uppercase tracking-widest mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Feature list */}
          <div className="w-full space-y-2">
            {[
              { icon: Shield, text: 'End-to-end protected transactions' },
              { icon: Lock, text: 'Secret key only you control' },
              { icon: Star, text: 'Rating system for trusted trading' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-[11px] text-neutral-500">
                <Icon size={11} className="text-amber-500/60 flex-shrink-0" />
                {text}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="w-full">
            <button onClick={authenticateUser} disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black rounded-xl transition-all duration-200 active:scale-[0.98] hover:from-amber-400 hover:to-amber-300 shadow-[0_12px_40px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <Wallet size={17} />
              {loading ? 'Authenticating…' : 'Connect Pi Wallet'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </div>

          <HowItWorks />
        </div>
      </main>
    );
  }

  /* ── Authenticated App ── */
  return (
    <main className="min-h-screen flex flex-col items-center bg-[#080808] text-white pb-28">
      <style>{globalStyles}</style>

      {/* Subtle ambient glow */}
      <div className="fixed top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-amber-500/[0.03] to-transparent pointer-events-none" />

      <div className="w-full max-w-lg px-4 mt-6 space-y-4 relative">

        {/* ── Header ── */}
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
            <button onClick={() => setSessionExpired(true)}
              className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center text-neutral-600 hover:text-rose-400 hover:bg-rose-500/5 hover:border-rose-500/15 transition-all">
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#0d0d0d] border border-white/6 rounded-2xl">
          {[
            { key: 'buyer',        label: 'Buyer',  icon: Lock },
            { key: 'seller',       label: 'Seller', icon: Package },
            { key: 'transactions', label: 'Deals',  icon: ClipboardList },
            { key: 'stats',        label: 'Stats',  icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[9px] font-black tracking-wide transition-all duration-200
                ${tab === key
                  ? 'bg-amber-500 text-black shadow-[0_4px_16px_rgba(245,158,11,0.25)]'
                  : 'text-neutral-600 hover:text-neutral-300'}`}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════ BUYER TAB ══════════════ */}
        {tab === 'buyer' && (
          <div className="space-y-4">
            <HowItWorks />

            {!escrowResult ? (
              <Card className="p-6">
                <SectionHeader icon={Zap} title="Create Escrow" subtitle="Lock funds securely until delivery is confirmed" />
                <form onSubmit={handleCreateEscrow} className="space-y-4">
                  <InputField label="Seller Wallet Address">
                    <input required placeholder="G…" value={sellerWallet} onChange={e => setSellerWallet(e.target.value)}
                      className="w-full bg-black/60 border border-white/6 rounded-xl py-3 px-4 focus:border-amber-500/50 focus:bg-black/80 outline-none text-white font-mono text-xs transition-all placeholder-neutral-700" />
                  </InputField>

                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Amount (Pi)">
                      <input required type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                        className="w-full bg-black/60 border border-white/6 rounded-xl py-3 px-4 text-amber-400 font-black text-xl focus:border-amber-500/50 outline-none transition-all placeholder-neutral-800" />
                    </InputField>
                    <InputField label="Fee (1%)" sublabel="Auto-calculated">
                      <div className="w-full bg-neutral-900/40 border border-white/4 rounded-xl py-3 px-4 text-neutral-500 font-black text-xl">
                        {fee > 0 ? fee.toFixed(3) : '—'}
                      </div>
                    </InputField>
                  </div>

                  <InputField label="Deal Terms" sublabel="Optional">
                    <textarea placeholder="Describe the goods or service being transacted…" value={description} onChange={e => setDescription(e.target.value)} rows={3}
                      className="w-full bg-black/60 border border-white/6 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none text-sm resize-none transition-all placeholder-neutral-700 text-neutral-300" />
                  </InputField>

                  {buyerError && <ErrorBox message={buyerError} />}

                  <PrimaryButton type="submit" disabled={isProcessing || !amount || !sellerWallet}>
                    {isProcessing ? <><Spinner /> Creating…</> : <><Lock size={14} /> Lock Funds in Escrow</>}
                  </PrimaryButton>
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
                    <p className="text-[10px] text-neutral-600">Share the code with your seller to proceed</p>
                  </div>
                </div>

                {/* TX Number */}
                <Card className="p-4">
                  <div className="text-[9px] uppercase font-black tracking-[0.15em] text-neutral-600 mb-2 flex items-center gap-1">
                    <Hash size={9} /> Transaction Number
                  </div>
                  <div className="text-sm font-black text-amber-400 font-mono tracking-wider mb-2">{escrowResult.transactionNumber}</div>
                  <CopyButton text={escrowResult.transactionNumber} label="Copy TX" />
                </Card>

                {/* Escrow Code */}
                <Card className="p-4 border-amber-500/15">
                  <div className="text-[9px] uppercase font-black tracking-[0.15em] text-amber-500/60 mb-2">Escrow Code — Send to Seller</div>
                  <div className="text-3xl font-black text-amber-400 tracking-[0.15em] font-mono mb-3">{escrowResult.escrowCode}</div>
                  <div className="flex gap-2">
                    <CopyButton text={escrowResult.escrowCode} label="Copy Code" />
                    <button onClick={() => {
                      if (navigator.share) navigator.share({ title: 'PTrust Escrow', url: escrowResult.shareUrl });
                      else window.open('https://wa.me/?text=' + encodeURIComponent(escrowResult.shareUrl));
                    }} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-black text-amber-400 hover:bg-amber-500/15 transition-colors">
                      <Share2 size={11} /> Share
                    </button>
                  </div>
                </Card>

                {/* Secret Key */}
                <Card className="p-4 border-rose-500/15">
                  <div className="text-[9px] uppercase font-black tracking-[0.15em] text-rose-400/70 mb-2 flex items-center justify-between">
                    <span>Secret Key — Private, Never Share</span>
                    <button onClick={() => setShowSecretKey(!showSecretKey)} className="text-neutral-600 hover:text-neutral-400 transition-colors">
                      {showSecretKey ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                  <div className="text-base font-black text-white font-mono tracking-widest mb-1">
                    {showSecretKey ? escrowResult.secretKey : '••••••••••••'}
                  </div>
                  <p className="text-[9px] text-rose-400/40 mb-2.5">Required to release funds. Store it safely.</p>
                  <CopyButton text={escrowResult.secretKey} label="Copy Secret Key" />
                </Card>

                {/* Share Link */}
                <Card className="p-4">
                  <div className="text-[9px] uppercase font-black tracking-[0.15em] text-neutral-600 mb-2">Share Link</div>
                  <p className="text-[10px] text-neutral-500 font-mono break-all mb-2.5">{escrowResult.shareUrl}</p>
                  <CopyButton text={escrowResult.shareUrl} label="Copy Link" />
                </Card>

                <InfoBox message="Now wait for the seller to accept. Return here to release funds after delivery is confirmed." />

                <button onClick={() => { setEscrowResult(null); setShowSecretKey(false); }}
                  className="w-full py-3 text-neutral-600 text-xs font-black hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5">
                  + Create New Escrow
                </button>
              </div>
            )}

            {/* Release Section */}
            <Card className="p-6">
              <SectionHeader icon={Key} title="Release Funds" subtitle="Enter your codes after seller confirms delivery" />
              <form onSubmit={handleRelease} className="space-y-3">
                <InputField label="Escrow Code">
                  <input required placeholder="PTO-XXXXXX" value={releaseCode} onChange={e => setReleaseCode(e.target.value.toUpperCase())}
                    className="w-full bg-black/60 border border-white/6 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none font-mono text-sm uppercase tracking-widest transition-all placeholder-neutral-700" />
                </InputField>
                <InputField label="Secret Key">
                  <input required placeholder="SK-XXXXXX" value={releaseKey} onChange={e => setReleaseKey(e.target.value)}
                    className="w-full bg-black/60 border border-white/6 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none font-mono text-sm transition-all placeholder-neutral-700" />
                </InputField>
                <div className="bg-amber-500/4 border border-amber-500/15 rounded-xl p-3.5 space-y-2">
                  <p className="text-[10px] text-amber-400/70 font-black">Type CONFIRM to authorize release (irreversible)</p>
                  <input required placeholder="CONFIRM" value={releaseConfirm} onChange={e => setReleaseConfirm(e.target.value)}
                    className="w-full bg-black/60 border border-amber-500/20 rounded-xl py-3 px-4 focus:border-amber-500/50 outline-none text-sm text-center font-black tracking-[0.3em] transition-all placeholder-neutral-700 text-amber-400" />
                </div>
                {releaseError && <ErrorBox message={releaseError} />}
                {releaseSuccess && <SuccessBox message="Funds successfully released to the seller!" />}
                <PrimaryButton type="submit" variant="white" disabled={releaseLoading || releaseSuccess || releaseConfirm !== 'CONFIRM'}>
                  {releaseLoading ? <><Spinner /> Releasing…</> : 'Release Funds to Seller'}
                </PrimaryButton>
              </form>
            </Card>
          </div>
        )}

        {/* ══════════════ SELLER TAB ══════════════ */}
        {tab === 'seller' && (
          <div className="space-y-4">
            <Card className="p-6">
              <SectionHeader icon={Package} title="Seller Dashboard" subtitle="Look up an escrow and manage your side of the deal" />

              {!sellerTx ? (
                <form onSubmit={handleLookupEscrow} className="space-y-4">
                  <InputField label="Escrow Code">
                    <input required placeholder="PTO-XXXXXX" value={sellerCode} onChange={e => setSellerCode(e.target.value.toUpperCase())}
                      className="w-full bg-black/60 border border-white/6 rounded-xl py-4 px-4 focus:border-amber-500/50 outline-none font-mono text-2xl text-center tracking-[0.2em] uppercase transition-all placeholder-neutral-800 text-amber-400" />
                  </InputField>
                  {sellerError && <ErrorBox message={sellerError} />}
                  <PrimaryButton type="submit" disabled={sellerLoading || !sellerCode}>
                    {sellerLoading ? <><Spinner /> Looking up…</> : 'Find Escrow'}
                  </PrimaryButton>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Transaction details */}
                  <div className="bg-black/40 rounded-xl p-4 space-y-3.5 border border-white/4">
                    {[
                      { label: 'Transaction #', value: <span className="font-black text-amber-400 font-mono text-xs">{sellerTx.transactionNumber}</span> },
                      { label: 'Escrow Code',   value: <span className="font-black text-amber-400 font-mono">{sellerTx.escrowCode}</span> },
                      { label: 'Amount',        value: <span className="font-black text-lg">{sellerTx.amount} <span className="text-amber-400 text-sm">Pi</span></span> },
                      { label: 'Buyer',         value: <span className="font-black text-sm">@{sellerTx.buyerUsername}</span> },
                      { label: 'Status',        value: <StatusBadge status={sellerTx.status} /> },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-neutral-600">{label}</span>
                        {value}
                      </div>
                    ))}
                    {sellerTx.description && (
                      <div className="pt-1 border-t border-white/4">
                        <div className="text-[9px] uppercase font-black tracking-widest text-neutral-600 mb-1.5">Deal Terms</div>
                        <p className="text-sm text-neutral-300 leading-relaxed">{sellerTx.description}</p>
                      </div>
                    )}
                    {sellerTx.deliveryDeadline && sellerTx.status === 'ACCEPTED' && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-500/60">
                        <Clock size={10} />
                        Deliver by {new Date(sellerTx.deliveryDeadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {sellerTx.status === 'PENDING' && (
                    <div className="space-y-3">
                      <InfoBox message="Step 1 — Review the deal terms above and accept to lock funds securely." />
                      <PrimaryButton onClick={handleAcceptDeal} disabled={sellerLoading}>
                        {sellerLoading ? <><Spinner /> Processing…</> : <><Shield size={14} /> Accept Deal & Lock Funds</>}
                      </PrimaryButton>
                    </div>
                  )}

                  {sellerTx.status === 'ACCEPTED' && (
                    <div className="space-y-3">
                      <InfoBox message="Step 2 — Send the goods or deliver your service, then press Confirm Delivery." />
                      <PrimaryButton onClick={handleConfirmDelivery} disabled={sellerLoading}>
                        {sellerLoading ? <><Spinner /> Processing…</> : <><Package size={14} /> Confirm Delivery</>}
                      </PrimaryButton>
                    </div>
                  )}

                  {sellerTx.status === 'DELIVERED' && (
                    <InfoBox message="Delivery confirmed. Waiting for buyer to release funds using their Secret Key." color="blue" />
                  )}

                  {sellerTx.status === 'RELEASED' && (
                    <div className="space-y-3">
                      <SuccessBox message="Funds have been released to your wallet. Transaction complete!" />
                      {!sellerTx.rating && (
                        <Card className="p-4">
                          <p className="text-[10px] font-black text-neutral-500 mb-3">Rate this transaction</p>
                          <StarRating onRate={async n => {
                            try { await submitRating(sellerTx.escrowCode, n, user.username); setSellerTx({ ...sellerTx, rating: n }); } catch {}
                          }} />
                        </Card>
                      )}
                    </div>
                  )}

                  {sellerError && <ErrorBox message={sellerError} />}

                  <button onClick={() => { setSellerTx(null); setSellerCode(''); }}
                    className="w-full py-3 text-neutral-600 text-xs font-black hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5">
                    ← Look up another escrow
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ══════════════ TRANSACTIONS TAB ══════════════ */}
        {tab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-base font-black tracking-tight">My Deals</h2>
              <button onClick={loadTransactions}
                className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 hover:text-amber-400 transition-colors">
                <RefreshCw size={11} className={txLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {txLoading && (
              <div className="flex justify-center py-16">
                <div className="animate-spin h-7 w-7 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            )}

            {!txLoading && transactions.length === 0 && (
              <div className="text-center py-20 text-neutral-700">
                <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-black text-sm">No transactions yet</p>
                <p className="text-xs mt-1 opacity-60">Create your first escrow to get started</p>
              </div>
            )}

            {transactions.map(tx => (
              <Card key={tx._id} className="p-4 space-y-3 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-400 tracking-wider text-[11px] font-mono">{tx.transactionNumber || tx.escrowCode}</span>
                  <StatusBadge status={tx.status} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 text-[11px]">Amount</span>
                  <span className="font-black text-sm">{tx.amount} <span className="text-amber-400 text-xs">Pi</span></span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 text-[11px]">
                    {tx.buyerUsername === user.username ? 'Seller wallet' : 'Buyer'}
                  </span>
                  <span className="font-black text-[11px] font-mono text-neutral-300">
                    {tx.buyerUsername === user.username
                      ? tx.sellerWallet.slice(0, 6) + '…' + tx.sellerWallet.slice(-4)
                      : '@' + tx.buyerUsername}
                  </span>
                </div>

                {tx.description && (
                  <p className="text-[10px] text-neutral-600 leading-relaxed border-t border-white/4 pt-2.5">{tx.description}</p>
                )}

                <div className="text-[9px] text-neutral-700 flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                <div className="space-y-2 pt-1">
                  {tx.status === 'DELIVERED' && tx.buyerUsername === user.username && (
                    <button onClick={() => { setTab('buyer'); setReleaseCode(tx.escrowCode); }}
                      className="w-full py-2.5 bg-amber-500/8 border border-amber-500/20 text-amber-400 font-black rounded-xl text-[11px] hover:bg-amber-500/15 transition-all flex items-center justify-center gap-2">
                      <Key size={11} /> Release Funds
                    </button>
                  )}
                  {['PENDING', 'ACCEPTED', 'DELIVERED'].includes(tx.status) && (
                    <button onClick={() => openDispute(tx)}
                      className="w-full py-2.5 bg-rose-500/5 border border-rose-500/15 text-rose-400 font-black rounded-xl text-[11px] hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2">
                      <AlertTriangle size={11} /> Open Dispute
                    </button>
                  )}
                  {tx.status === 'RELEASED' && !tx.rating && (
                    <div className="pt-0.5">
                      <p className="text-[9px] text-neutral-600 mb-2">Rate this deal</p>
                      <StarRating onRate={async n => {
                        try {
                          await submitRating(tx.escrowCode, n, user.username);
                          setTransactions(prev => prev.map(t => t._id === tx._id ? { ...t, rating: n } : t));
                        } catch {}
                      }} />
                    </div>
                  )}
                  {tx.status === 'RELEASED' && tx.rating && (
                    <div className="flex items-center gap-1 pt-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={13} className={n <= tx.rating! ? 'text-amber-400' : 'text-neutral-800'} fill={n <= tx.rating! ? 'currentColor' : 'none'} />
                      ))}
                      <span className="text-[9px] text-neutral-600 ml-1">Rated</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ══════════════ STATS TAB ══════════════ */}
        {tab === 'stats' && (
          <div className="space-y-4">
            <div className="px-0.5">
              <h2 className="text-base font-black tracking-tight">Statistics</h2>
              <p className="text-[10px] text-neutral-600 mt-0.5">@{user.username}'s trading overview</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Deals',    value: stats.total,              accent: 'text-white',        bg: '',                     icon: Activity },
                { label: 'Completed',      value: stats.released,           accent: 'text-emerald-400',  bg: 'border-emerald-500/10', icon: CheckCircle2 },
                { label: 'Disputed',       value: stats.disputed,           accent: 'text-rose-400',     bg: 'border-rose-500/10',   icon: AlertTriangle },
                { label: 'Pi Transacted',  value: stats.totalPi.toFixed(1) + ' π', accent: 'text-amber-400', bg: 'border-amber-500/10', icon: TrendingUp },
              ].map(({ label, value, accent, bg, icon: Icon }) => (
                <Card key={label} className={`p-4 ${bg}`}>
                  <div className="flex items-start justify-between mb-3">
                    <Icon size={14} className={`${accent} opacity-60`} />
                  </div>
                  <div className={`text-2xl font-black ${accent}`}>{value}</div>
                  <div className="text-[9px] text-neutral-600 uppercase tracking-widest mt-1">{label}</div>
                </Card>
              ))}
            </div>

            {/* Success rate bar */}
            {stats.total > 0 && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Success Rate</span>
                  <span className="text-sm font-black text-emerald-400">
                    {Math.round((stats.released / stats.total) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${(stats.released / stats.total) * 100}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-neutral-700 mt-2">
                  <span>{stats.released} completed</span>
                  <span>{stats.total - stats.released} pending / disputed</span>
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
                  <p className="text-[9px] text-neutral-600">Get help from our team</p>
                </div>
              </div>
              <PrimaryButton variant="ghost" onClick={() => window.open('mailto:Riahig45@gmail.com?subject=PTrust Oracle Support')}>
                <Mail size={13} /> Contact Support
              </PrimaryButton>
            </Card>
          </div>
        )}

      </div>
    </main>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');

  * { -webkit-font-smoothing: antialiased; }

  input::placeholder, textarea::placeholder { color: #333; }

  input:focus, textarea:focus {
    box-shadow: 0 0 0 1px rgba(245,158,11,0.2), 0 4px 16px rgba(245,158,11,0.05);
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }

  .font-mono { font-family: 'DM Mono', 'Courier New', monospace; }
`;
