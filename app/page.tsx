'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import {
  ShieldCheck, Wallet, AlertCircle, CheckCircle2, ArrowRight, Lock, Zap,
  Copy, Share2, Key, Package, ClipboardList, Star, BarChart3, AlertTriangle,
  HelpCircle, ChevronDown, ChevronUp, LogOut, Clock, Mail, Shield, Hash,
  TrendingUp, Award, Users, Activity
} from 'lucide-react';

interface Transaction {
  _id: string;
  transactionNumber?: string;
  escrowCode: string;
  secretKey?: string;
  sellerWallet: string;
  buyerUsername: string;
  amount: number;
  fee: number;
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'LOCKED' | 'DELIVERED' | 'RELEASED' | 'DISPUTED';
  createdAt: string;
  deliveryDeadline?: string;
  rating?: number;
}

async function createEscrow(data: { sellerWallet: string; amount: number; fee: number; description: string; buyerUsername: string; }) {
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

async function submitRating(escrowCode: string, rating: number, username: string) {
  const res = await fetch('/api/escrow/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escrowCode, rating, username }) });
  if (!res.ok) throw new Error('Rating failed');
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    PENDING:   { bg: 'bg-zinc-800/80',      text: 'text-zinc-300',   dot: 'bg-zinc-400',   label: 'Pending' },
    ACCEPTED:  { bg: 'bg-amber-950/60',     text: 'text-amber-300',  dot: 'bg-amber-400',  label: 'In Progress' },
    LOCKED:    { bg: 'bg-amber-950/60',     text: 'text-amber-300',  dot: 'bg-amber-400',  label: 'Locked' },
    DELIVERED: { bg: 'bg-sky-950/60',       text: 'text-sky-300',    dot: 'bg-sky-400',    label: 'Delivered' },
    RELEASED:  { bg: 'bg-emerald-950/60',   text: 'text-emerald-300',dot: 'bg-emerald-400',label: 'Released' },
    DISPUTED:  { bg: 'bg-rose-950/60',      text: 'text-rose-300',   dot: 'bg-rose-400',   label: 'Disputed' },
  };
  const s = map[status] || map.PENDING;
  return (
    <span className={'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ' + s.bg + ' ' + s.text}>
      <span className={'w-1.5 h-1.5 rounded-full ' + s.dot} />
      {s.label}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ' + (copied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/8')}
    >
      {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function StarRating({ onRate, readOnly = false, value = 0 }: { onRate?: (n: number) => void; readOnly?: boolean; value?: number }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(value);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHovered(n)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          onClick={() => { if (!readOnly) { setSelected(n); onRate?.(n); } }}
          className={'transition-all duration-150 ' + (n <= (hovered || selected) ? 'text-amber-400 scale-110' : 'text-zinc-700') + (readOnly ? ' cursor-default' : ' cursor-pointer hover:scale-110')}
        >
          <Star size={20} fill={n <= (hovered || selected) ? 'currentColor' : 'none'} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  const steps = [
    { icon: '🛒', step: '01', title: 'Create Escrow', desc: 'Buyer locks Pi funds and shares the Escrow Code with the seller.' },
    { icon: '🤝', step: '02', title: 'Seller Accepts', desc: 'Seller finds the escrow by code and confirms the deal terms.' },
    { icon: '📦', step: '03', title: 'Deliver Goods', desc: 'Seller ships the product or delivers the service, then confirms.' },
    { icon: '🔑', step: '04', title: 'Release Funds', desc: 'Buyer uses the Secret Key to release Pi to the seller.' },
    { icon: '⚖️', step: '05', title: 'Dispute Support', desc: 'Any issues? Open a dispute — our team reviews within 24h.' },
  ];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/6 bg-zinc-900/40">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left group">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <HelpCircle size={15} className="text-amber-400" />
          </div>
          <span className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">How PTrust Works</span>
        </div>
        <div className={'w-6 h-6 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-200 ' + (open ? 'rotate-180' : '')}>
          <ChevronDown size={13} className="text-zinc-500" />
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-white/6 pt-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4 items-start p-3 rounded-xl bg-white/2 hover:bg-white/4 transition-colors">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-zinc-800 border border-white/8 flex items-center justify-center text-lg">{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-black text-amber-500/70 tracking-widest">{s.step}</span>
                  <span className="text-xs font-bold text-zinc-200">{s.title}</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function useSessionTimer(onExpire: () => void, active: boolean) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const SESSION_DURATION = 30 * 60 * 1000;
  const resetTimer = useCallback(() => {
    if (!active) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onExpire, SESSION_DURATION);
  }, [onExpire, active]);
  useEffect(() => {
    if (!active) return;
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, active]);
}

function Spinner() {
  return <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />;
}

export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [mounted, setMounted] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [tab, setTab] = useState<'buyer' | 'seller' | 'transactions' | 'stats'>('buyer');

  const [sellerWallet, setSellerWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyerError, setBuyerError] = useState<string | null>(null);
  const [escrowResult, setEscrowResult] = useState<{ transactionNumber: string; escrowCode: string; secretKey: string; shareUrl: string; } | null>(null);

  const [releaseCode, setReleaseCode] = useState('');
  const [releaseKey, setReleaseKey] = useState('');
  const [releaseConfirm, setReleaseConfirm] = useState('');
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);

  const [sellerCode, setSellerCode] = useState('');
  const [sellerTx, setSellerTx] = useState<Transaction | null>(null);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);

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
  useSessionTimer(handleSessionExpire, !!user);

  const fee = useMemo(() => { const val = parseFloat(amount); return isNaN(val) || val <= 0 ? 0 : val / 100; }, [amount]);

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setBuyerError('Connect Pi Wallet first.'); return; }
    setIsProcessing(true); setBuyerError(null); setEscrowResult(null);
    try {
      const result = await createEscrow({ sellerWallet, amount: parseFloat(amount), fee, description: description || 'No description', buyerUsername: user.username });
      setEscrowResult({ transactionNumber: result.transactionNumber, escrowCode: result.escrowCode, secretKey: result.secretKey, shareUrl: window.location.origin + '/escrow/' + result.escrowCode });
      setAmount(''); setSellerWallet(''); setDescription('');
    } catch (err: any) { setBuyerError(err.message || 'Failed to create escrow.'); }
    finally { setIsProcessing(false); }
  };

  const handleLookupEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setSellerError('Connect Pi Wallet first.'); return; }
    setSellerLoading(true); setSellerError(null); setSellerTx(null);
    try {
      const result = await fetchEscrowByCode(sellerCode.toUpperCase());
      setSellerTx(result.transaction || null);
    } catch (err: any) { setSellerError(err.message); }
    finally { setSellerLoading(false); }
  };

  const handleAcceptDeal = async () => {
    if (!user || !sellerTx) return;
    setSellerLoading(true); setSellerError(null);
    try { await acceptDeal(sellerTx.escrowCode, user.username); setSellerTx((prev) => prev ? { ...prev, status: 'ACCEPTED' } : null); }
    catch (err: any) { setSellerError(err.message); }
    finally { setSellerLoading(false); }
  };

  const handleConfirmDelivery = async () => {
    if (!user || !sellerTx) return;
    setSellerLoading(true); setSellerError(null);
    try { await confirmDelivery(sellerTx.escrowCode, user.username); setSellerTx((prev) => prev ? { ...prev, status: 'DELIVERED' } : null); }
    catch (err: any) { setSellerError(err.message); }
    finally { setSellerLoading(false); }
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setReleaseLoading(true); setReleaseError(null);
    try { await releaseEscrow(releaseCode.toUpperCase(), releaseKey, releaseConfirm, user.username); setReleaseSuccess(true); }
    catch (err: any) { setReleaseError(err.message); }
    finally { setReleaseLoading(false); }
  };

  const loadTransactions = useCallback(async () => {
    if (!user?.username) return;
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
  }, [user]);

  useEffect(() => { if ((tab === 'transactions' || tab === 'stats') && user) loadTransactions(); }, [tab, user, loadTransactions]);

  const openDispute = (tx: Transaction) => {
    const subject = encodeURIComponent('PTrust Dispute - ' + (tx.transactionNumber || tx.escrowCode));
    const body = encodeURIComponent('Transaction: ' + (tx.transactionNumber || tx.escrowCode) + '\nEscrow Code: ' + tx.escrowCode + '\nAmount: ' + tx.amount + ' Pi\nBuyer: @' + tx.buyerUsername + '\nStatus: ' + tx.status + '\nDescription: ' + tx.description + '\n\nPlease describe your issue:');
    window.open('mailto:Riahig45@gmail.com?subject=' + subject + '&body=' + body);
  };

  if (!mounted) return null;

  if (sessionExpired) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a] text-white">
        <div className="text-center space-y-6 max-w-sm w-full">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
            <Clock size={32} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black mb-2">Session Expired</h2>
            <p className="text-zinc-500 text-sm">Your session timed out after 30 minutes of inactivity. Please sign in again to continue.</p>
          </div>
          <button onClick={() => { setSessionExpired(false); authenticateUser(); }} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm">
            <Wallet size={18} /> Sign In Again
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-5 bg-[#0a0a0a] text-white overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/[0.06] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-amber-600/[0.04] rounded-full blur-[100px]" />
        </div>
        <div className="relative flex flex-col items-center text-center space-y-8 w-full max-w-sm">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.3)]">
              <ShieldCheck size={28} className="text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black tracking-[0.25em] uppercase mb-3">
                <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                Pi Network Mainnet
              </div>
              <h1 className="text-5xl font-black tracking-tight leading-none">
                <span className="text-white">P</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600">TRUST</span>
              </h1>
              <p className="text-zinc-500 text-xs tracking-[0.5em] uppercase mt-1 font-medium">Oracle Escrow</p>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
              The most trusted escrow protocol on Pi Network. Trade safely, get paid securely.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full">
            {[
              { value: '1%', label: 'Service Fee', icon: '💎' },
              { value: '100%', label: 'Secure', icon: '🔐' },
              { value: '24/7', label: 'Available', icon: '⚡' },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-900/60 border border-white/6 rounded-xl py-3 px-2 text-center">
                <div className="text-lg mb-1">{s.icon}</div>
                <div className="text-base font-black text-amber-400">{s.value}</div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="w-full space-y-2.5">
            {[
              { icon: Shield, text: 'Funds locked until delivery confirmed', color: 'text-emerald-400' },
              { icon: Key, text: 'Only you hold the Secret Key to release', color: 'text-amber-400' },
              { icon: Award, text: 'Reputation system for trusted trading', color: 'text-sky-400' },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/40 border border-white/4">
                <div className={'w-7 h-7 rounded-lg bg-white/4 flex items-center justify-center flex-shrink-0'}>
                  <Icon size={13} className={color} />
                </div>
                <span className="text-xs text-zinc-400">{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={authenticateUser}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black rounded-2xl active:scale-[0.98] hover:from-amber-400 hover:to-amber-300 shadow-[0_8px_32px_rgba(245,158,11,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 transition-all text-sm"
          >
            <Wallet size={18} />
            {loading ? 'Connecting...' : 'Connect Pi Wallet'}
            {!loading && <ArrowRight size={15} />}
          </button>
          <HowItWorks />
        </div>
      </main>
    );
  }

  const tabs = [
    { key: 'buyer' as const, label: 'Buy', icon: Lock },
    { key: 'seller' as const, label: 'Sell', icon: Package },
    { key: 'transactions' as const, label: 'Deals', icon: ClipboardList },
    { key: 'stats' as const, label: 'Stats', icon: BarChart3 },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white pb-28">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[300px] bg-amber-500/[0.03] blur-[80px]" />
      </div>

      <div className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.3)]">
              <ShieldCheck size={16} className="text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-black leading-none">PTrust <span className="text-amber-400">Oracle</span></h1>
              <p className="text-[9px] text-zinc-600 font-medium mt-0.5">@{user.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-xs">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <button onClick={() => setSessionExpired(true)} className="w-7 h-7 rounded-lg bg-white/4 hover:bg-red-500/10 flex items-center justify-center transition-colors group">
              <LogOut size={13} className="text-zinc-600 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="flex gap-1 p-1 bg-zinc-900/60 border border-white/6 rounded-2xl">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-bold transition-all duration-200 ' + (tab === key ? 'bg-amber-500 text-black shadow-[0_4px_12px_rgba(245,158,11,0.3)]' : 'text-zinc-500 hover:text-zinc-300')}
            >
              <Icon size={14} strokeWidth={tab === key ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'buyer' && (
          <div className="space-y-4">
            <HowItWorks />
            {!escrowResult ? (
              <div className="bg-zinc-900/60 border border-white/6 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Zap size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black">Create New Escrow</h2>
                    <p className="text-[10px] text-zinc-600">Lock funds until delivery is confirmed</p>
                  </div>
                </div>
                <form onSubmit={handleCreateEscrow} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">Seller Wallet Address</label>
                    <input required placeholder="G..." value={sellerWallet} onChange={(e) => setSellerWallet(e.target.value)} className="w-full bg-black/40 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/60 focus:bg-black/60 outline-none text-white font-mono text-xs transition-all placeholder:text-zinc-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">Amount (Pi)</label>
                      <input required type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/40 border border-white/8 rounded-xl py-3 px-4 text-amber-400 font-black text-lg focus:border-amber-500/60 outline-none transition-all placeholder:text-zinc-700" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider ml-1">Fee (1%)</label>
                      <div className="w-full bg-zinc-800/30 border border-white/4 rounded-xl py-3 px-4 text-zinc-500 font-black text-lg">{fee.toFixed(3)}<span className="text-xs ml-1">π</span></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">Deal Description</label>
                    <textarea placeholder="Describe what you are buying..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-black/40 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/60 outline-none text-sm resize-none transition-all placeholder:text-zinc-700" />
                  </div>
                  {buyerError && (
                    <div className="flex items-start gap-2.5 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl">
                      <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                      <p className="text-rose-300 text-xs">{buyerError}</p>
                    </div>
                  )}
                  <button type="submit" disabled={isProcessing || !amount || !sellerWallet} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black rounded-xl hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm shadow-[0_4px_16px_rgba(245,158,11,0.2)]">
                    {isProcessing ? <Spinner /> : <Lock size={15} strokeWidth={2.5} />}
                    {isProcessing ? 'Creating Escrow...' : 'Lock Funds in Escrow'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-emerald-300">Escrow Created!</h2>
                      <p className="text-[10px] text-emerald-600">Share the code with your seller</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="bg-black/30 rounded-xl p-3.5">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-zinc-600 tracking-widest mb-2"><Hash size={9} /> Transaction Number</div>
                      <p className="text-xs font-black text-amber-400 font-mono mb-2">{escrowResult.transactionNumber}</p>
                      <CopyButton text={escrowResult.transactionNumber} label="Copy" />
                    </div>
                    <div className="bg-black/30 rounded-xl p-3.5">
                      <div className="text-[9px] uppercase font-bold text-zinc-600 tracking-widest mb-2">Escrow Code — Send to Seller</div>
                      <p className="text-2xl font-black text-amber-400 font-mono tracking-widest mb-2">{escrowResult.escrowCode}</p>
                      <div className="flex gap-2">
                        <CopyButton text={escrowResult.escrowCode} label="Copy Code" />
                        <button onClick={() => { if (navigator.share) { navigator.share({ title: 'PTrust Escrow', url: escrowResult.shareUrl }); } else { window.open('https://wa.me/?text=' + encodeURIComponent(escrowResult.shareUrl)); } }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] font-bold text-amber-400 hover:bg-amber-500/20 transition-colors">
                          <Share2 size={11} /> Share
                        </button>
                      </div>
                    </div>
                    <div className="bg-rose-950/30 border border-rose-500/20 rounded-xl p-3.5">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-rose-500/70 tracking-widest mb-1"><Key size={9} /> Secret Key — Keep Private</div>
                      <p className="text-sm font-black text-white font-mono tracking-wider mb-1">{escrowResult.secretKey}</p>
                      <p className="text-[10px] text-rose-400/60 mb-2">⚠️ Never share this. Required to release funds.</p>
                      <CopyButton text={escrowResult.secretKey} label="Copy Secret Key" />
                    </div>
                    <div className="bg-amber-950/20 border border-amber-500/10 rounded-xl p-3">
                      <p className="text-[11px] text-amber-400/80 font-bold">Next: Wait for seller to accept, then release funds after delivery.</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setEscrowResult(null)} className="w-full py-3 text-zinc-600 text-sm font-bold hover:text-zinc-300 transition-colors border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/2">
                  + Create Another Escrow
                </button>
              </div>
            )}

            <div className="bg-zinc-900/60 border border-white/6 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center">
                  <Key size={16} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Release Funds</h3>
                  <p className="text-[10px] text-zinc-600">Confirm delivery and pay the seller</p>
                </div>
              </div>
              <form onSubmit={handleRelease} className="space-y-3">
                <input required placeholder="Escrow Code (PTO-XXXXXX)" value={releaseCode} onChange={(e) => setReleaseCode(e.target.value.toUpperCase())} className="w-full bg-black/40 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/60 outline-none font-mono text-sm uppercase tracking-widest transition-all placeholder:text-zinc-700" />
                <input required placeholder="Your Secret Key" value={releaseKey} onChange={(e) => setReleaseKey(e.target.value)} className="w-full bg-black/40 border border-white/8 rounded-xl py-3 px-4 focus:border-amber-500/60 outline-none font-mono text-sm transition-all placeholder:text-zinc-700" />
                <div className="bg-amber-950/20 border border-amber-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-amber-400/70 font-bold mb-2 flex items-center gap-1.5"><AlertTriangle size={10} /> Type CONFIRM to authorize release</p>
                  <input required placeholder="CONFIRM" value={releaseConfirm} onChange={(e) => setReleaseConfirm(e.target.value)} className="w-full bg-black/40 border border-amber-500/20 rounded-lg py-2.5 px-4 focus:border-amber-500/50 outline-none text-sm text-center font-black tracking-[0.3em] transition-all placeholder:text-zinc-700 placeholder:tracking-normal" />
                </div>
                {releaseError && <div className="flex items-start gap-2.5 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl"><AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" /><p className="text-rose-300 text-xs">{releaseError}</p></div>}
                {releaseSuccess && <div className="flex items-center gap-2.5 p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl"><CheckCircle2 size={14} className="text-emerald-400" /><p className="text-emerald-300 text-xs font-bold">Funds Released Successfully!</p></div>}
                <button type="submit" disabled={releaseLoading || releaseSuccess || releaseConfirm !== 'CONFIRM'} className="w-full py-3.5 bg-zinc-100 text-black font-black rounded-xl hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-30 text-sm flex items-center justify-center gap-2">
                  {releaseLoading ? <Spinner /> : <CheckCircle2 size={15} />}
                  {releaseLoading ? 'Releasing...' : 'Release Funds to Seller'}
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === 'seller' && (
          <div className="space-y-4">
            <div className="bg-zinc-900/60 border border-white/6 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center">
                  <Package size={16} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black">Seller Dashboard</h2>
                  <p className="text-[10px] text-zinc-600">Find and manage your deals</p>
                </div>
              </div>
              {!sellerTx ? (
                <form onSubmit={handleLookupEscrow} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">Enter Escrow Code from Buyer</label>
                    <input required placeholder="PTO-XXXXXX" value={sellerCode} onChange={(e) => setSellerCode(e.target.value.toUpperCase())} className="w-full bg-black/40 border border-white/8 rounded-xl py-4 px-4 focus:border-amber-500/60 outline-none font-mono text-xl text-center tracking-widest uppercase transition-all placeholder:text-zinc-700 placeholder:text-base" />
                  </div>
                  {sellerError && <div className="flex items-start gap-2.5 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl"><AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" /><p className="text-rose-300 text-xs">{sellerError}</p></div>}
                  <button type="submit" disabled={sellerLoading || !sellerCode} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black rounded-xl hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] transition-all disabled:opacity-30 text-sm flex items-center justify-center gap-2">
                    {sellerLoading ? <Spinner /> : <Zap size={15} />}
                    {sellerLoading ? 'Searching...' : 'Find Escrow'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="bg-black/30 rounded-xl p-4 space-y-3 border border-white/4">
                    {[
                      { label: 'Transaction', value: <span className="font-black text-amber-400 text-xs font-mono">{sellerTx.transactionNumber || '-'}</span> },
                      { label: 'Escrow Code', value: <span className="font-black text-amber-400 font-mono">{sellerTx.escrowCode}</span> },
                      { label: 'Amount', value: <span className="font-black text-lg">{sellerTx.amount} <span className="text-amber-400 text-sm">π</span></span> },
                      { label: 'Buyer', value: <span className="font-bold text-zinc-300">@{sellerTx.buyerUsername}</span> },
                      { label: 'Status', value: <StatusBadge status={sellerTx.status} /> },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">{label}</span>
                        {value}
                      </div>
                    ))}
                    {sellerTx.description && (
                      <div className="pt-2 border-t border-white/4">
                        <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider mb-1">Deal Terms</p>
                        <p className="text-sm text-zinc-300">{sellerTx.description}</p>
                      </div>
                    )}
                  </div>

                  {sellerTx.status === 'PENDING' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 p-3 bg-amber-950/20 border border-amber-500/15 rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-xs font-black text-amber-400">1</div>
                        <p className="text-xs text-amber-300/80 font-medium">Review the deal terms above before accepting</p>
                      </div>
                      <button onClick={handleAcceptDeal} disabled={sellerLoading} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black rounded-xl hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] transition-all disabled:opacity-30 text-sm flex items-center justify-center gap-2">
                        {sellerLoading ? <Spinner /> : <Shield size={15} strokeWidth={2.5} />}
                        Accept Deal & Lock Funds
                      </button>
                    </div>
                  )}

                  {sellerTx.status === 'ACCEPTED' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 p-3 bg-sky-950/20 border border-sky-500/15 rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0 text-xs font-black text-sky-400">2</div>
                        <p className="text-xs text-sky-300/80 font-medium">Send the product or service, then confirm delivery</p>
                      </div>
                      <button onClick={handleConfirmDelivery} disabled={sellerLoading} className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-sky-400 text-black font-black rounded-xl hover:from-sky-400 hover:to-sky-300 active:scale-[0.98] transition-all disabled:opacity-30 text-sm flex items-center justify-center gap-2">
                        {sellerLoading ? <Spinner /> : <Package size={15} strokeWidth={2.5} />}
                        Confirm Delivery Sent
                      </button>
                    </div>
                  )}

                  {sellerTx.status === 'DELIVERED' && (
                    <div className="flex items-center gap-3 p-4 bg-sky-950/30 border border-sky-500/20 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                        <Clock size={15} className="text-sky-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-sky-300">Delivery Confirmed</p>
                        <p className="text-[11px] text-sky-500/70 mt-0.5">Waiting for buyer to release funds...</p>
                      </div>
                    </div>
                  )}

                  {sellerTx.status === 'RELEASED' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 size={15} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-emerald-300">Payment Released!</p>
                          <p className="text-[11px] text-emerald-500/70 mt-0.5">Funds sent to your Pi wallet</p>
                        </div>
                      </div>
                      {!sellerTx.rating && (
                        <div className="bg-zinc-900/60 border border-white/6 rounded-xl p-4">
                          <p className="text-xs font-bold text-zinc-400 mb-3 flex items-center gap-2"><Star size={12} className="text-amber-400" /> Rate this transaction</p>
                          <StarRating onRate={async (n) => { try { await submitRating(sellerTx.escrowCode, n, user.username); setSellerTx((prev) => prev ? { ...prev, rating: n } : null); } catch {} }} />
                        </div>
                      )}
                    </div>
                  )}

                  {sellerError && <div className="flex items-start gap-2.5 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl"><AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" /><p className="text-rose-300 text-xs">{sellerError}</p></div>}
                  <button onClick={() => { setSellerTx(null); setSellerCode(''); }} className="w-full py-2.5 text-zinc-600 text-xs font-bold hover:text-zinc-300 transition-colors border border-white/5 rounded-xl hover:border-white/10">
                    ← Search Another Escrow
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">My Deals</h2>
              <button onClick={loadTransactions} className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-400/70 hover:text-amber-400 transition-colors px-3 py-1.5 rounded-lg border border-white/6 hover:border-amber-500/20">
                <Activity size={10} /> Refresh
              </button>
            </div>
            {txLoading && <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}
            {!txLoading && transactions.length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/6 flex items-center justify-center mx-auto mb-4">
                  <ClipboardList size={24} className="text-zinc-700" />
                </div>
                <p className="font-black text-sm text-zinc-600">No deals yet</p>
                <p className="text-xs text-zinc-700 mt-1">Create your first escrow to get started</p>
              </div>
            )}
            {transactions.map((tx) => (
              <div key={tx._id} className="bg-zinc-900/60 border border-white/6 rounded-2xl p-4 space-y-3 hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-black text-amber-400 text-xs font-mono">{tx.transactionNumber || tx.escrowCode}</span>
                    {tx.description && <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-1">{tx.description}</p>}
                  </div>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-b border-white/4">
                  <div className="text-center">
                    <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-wider">Amount</p>
                    <p className="text-sm font-black text-white mt-0.5">{tx.amount} <span className="text-amber-400 text-xs">π</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-wider">{tx.buyerUsername === user?.username ? 'Seller' : 'Buyer'}</p>
                    <p className="text-xs font-bold text-zinc-400 mt-0.5">{tx.buyerUsername === user?.username ? (tx.sellerWallet?.slice(0, 8) || '') + '...' : '@' + tx.buyerUsername}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-wider">Date</p>
                    <p className="text-xs font-bold text-zinc-500 mt-0.5">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {tx.status === 'DELIVERED' && tx.buyerUsername === user?.username && (
                    <button onClick={() => { setTab('buyer'); setReleaseCode(tx.escrowCode); }} className="w-full py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-xl text-xs hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2">
                      <Key size={12} /> Release Funds to Seller
                    </button>
                  )}
                  {(tx.status === 'PENDING' || tx.status === 'ACCEPTED' || tx.status === 'LOCKED' || tx.status === 'DELIVERED') && (
                    <button onClick={() => openDispute(tx)} className="w-full py-2.5 bg-rose-950/30 border border-rose-500/15 text-rose-400 font-bold rounded-xl text-xs hover:bg-rose-950/50 transition-all flex items-center justify-center gap-2">
                      <AlertTriangle size={12} /> Open Dispute
                    </button>
                  )}
                  {tx.status === 'RELEASED' && !tx.rating && tx.buyerUsername === user?.username && (
                    <div className="pt-1">
                      <p className="text-[10px] text-zinc-600 mb-2 flex items-center gap-1.5"><Star size={9} className="text-amber-400" /> Rate this deal</p>
                      <StarRating onRate={async (n) => { try { await submitRating(tx.escrowCode, n, user?.username || ''); setTransactions((prev) => prev.map((t) => t._id === tx._id ? { ...t, rating: n } : t)); } catch {} }} />
                    </div>
                  )}
                  {tx.status === 'RELEASED' && tx.rating && (
                    <div className="flex items-center gap-2">
                      <StarRating value={tx.rating} readOnly />
                      <span className="text-[10px] text-zinc-600">{tx.rating}/5</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Deals', value: stats.total, icon: TrendingUp, color: 'text-white', bg: 'bg-white/4', border: 'border-white/8' },
                { label: 'Completed', value: stats.released, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/15' },
                { label: 'Disputed', value: stats.disputed, icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/5', border: 'border-rose-500/15' },
                { label: 'Pi Traded', value: stats.totalPi.toFixed(1) + ' π', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/15' },
              ].map(({ label, value, icon: Icon, color, bg, border }) => (
                <div key={label} className={'rounded-2xl p-4 border ' + bg + ' ' + border}>
                  <div className={'w-8 h-8 rounded-xl flex items-center justify-center mb-3 ' + bg}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className={'text-2xl font-black ' + color}>{value}</div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1 font-bold">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900/60 border border-white/6 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center">
                  <Users size={16} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Your Account</h3>
                  <p className="text-[10px] text-zinc-600">@{user.username}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/4">
                  <span className="text-xs text-zinc-500 font-medium">Success Rate</span>
                  <span className="text-xs font-black text-emerald-400">{stats.total > 0 ? Math.round((stats.released / stats.total) * 100) : 0}%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/4">
                  <span className="text-xs text-zinc-500 font-medium">Network</span>
                  <span className="text-xs font-black text-amber-400">Pi Mainnet</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-white/6 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center">
                  <Mail size={16} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Support</h3>
                  <p className="text-[10px] text-zinc-600">We respond within 24 hours</p>
                </div>
              </div>
              <button onClick={() => window.open('mailto:Riahig45@gmail.com?subject=PTrust Oracle Support')} className="w-full py-3 bg-white/4 border border-white/8 text-zinc-300 font-bold rounded-xl text-xs hover:bg-white/8 hover:text-white transition-all flex items-center justify-center gap-2">
                <Mail size={13} /> Contact Support Team
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
