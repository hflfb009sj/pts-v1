'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import {
  ShieldCheck, Wallet, AlertCircle, CheckCircle2, ArrowRight, Lock, Zap,
  Copy, Share2, Key, Package, ClipboardList, Star, BarChart3, AlertTriangle,
  HelpCircle, ChevronDown, ChevronUp, LogOut, Clock, Mail, Shield, Hash
} from 'lucide-react';

/**
 * PTrust Oracle v1.0
 * Secure Escrow Protocol for Pi Network
 * Optimized for Pi Browser & Sandbox Environments
 */

// --- Interfaces ---

interface Transaction {
  _id: string;
  transactionNumber: string;
  escrowCode: string;
  secretKey?: string;
  amount: number;
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'LOCKED' | 'DELIVERED' | 'RELEASED' | 'DISPUTED' | 'CANCELLED';
  buyerUsername: string;
  sellerWallet: string;
  createdAt: string;
  rating?: number;
  deliveryDeadline?: string;
  shareUrl?: string;
}

interface EscrowStats {
  total: number;
  released: number;
  disputed: number;
  totalPi: number;
}

// --- Helper Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    ACCEPTED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    LOCKED: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    DELIVERED: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    RELEASED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    DISPUTED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    CANCELLED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
};

const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black text-neutral-400 hover:bg-white/10 hover:text-white transition-all"
    >
      {copied ? <CheckCircle2 size={11} className="text-green-400" /> : <Copy size={11} />}
      {label || (copied ? 'Copied!' : 'Copy')}
    </button>
  );
};

const StarRating = ({ rating = 0, onRate, readOnly = false }: { rating?: number; onRate?: (r: number) => void; readOnly?: boolean }) => {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={18}
          onClick={() => !readOnly && onRate?.(s)}
          className={`${s <= rating ? 'fill-amber-500 text-amber-500' : 'text-neutral-700'} ${!readOnly ? 'cursor-pointer hover:scale-110 active:scale-95' : ''} transition-all`}
        />
      ))}
    </div>
  );
};

const HowItWorks = () => {
  const steps = [
    { title: "Deposit", desc: "Buyer locks Pi in Oracle vault." },
    { title: "Accept", desc: "Seller accepts deal & conditions." },
    { title: "Deliver", desc: "Seller ships & confirms delivery." },
    { title: "Release", desc: "Buyer releases Pi via Secret Key." }
  ];
  return (
    <div className="grid grid-cols-4 gap-2 py-4">
      {steps.map((step, i) => (
        <div key={i} className="text-center">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-xs mx-auto mb-2 border border-amber-500/20">
            {i + 1}
          </div>
          <p className="text-[9px] font-black uppercase text-white mb-0.5">{step.title}</p>
          <p className="text-[8px] text-neutral-500 leading-tight leading-none">{step.desc}</p>
        </div>
      ))}
    </div>
  );
};

// --- API Wrapper Functions ---

const API = {
  create: async (data: any) => {
    const res = await fetch('/api/escrow/approve', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
    return res.json();
  },
  lookup: async (code: string) => {
    const res = await fetch(`/api/escrow/transaction/${code}`);
    return res.json();
  },
  updateStatus: async (id: string, status: string) => {
    const res = await fetch(`/api/escrow/${status.toLowerCase()}`, { method: 'POST', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } });
    return res.json();
  },
  release: async (data: any) => {
    const res = await fetch('/api/escrow/release', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
    return res.json();
  },
  history: async (username: string) => {
    const res = await fetch(`/api/escrow/transactions?username=${username}`);
    return res.json();
  },
  rate: async (data: any) => {
    const res = await fetch('/api/escrow/rate', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
    return res.json();
  }
};

// --- Custom Hooks ---

const useSessionTimer = (minutes: number = 30) => {
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.location.reload(), minutes * 60 * 1000);
    };
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(e => window.removeEventListener(e, reset));
    };
  }, [minutes]);
};

// --- Main Page Component ---

export default function HomePage() {
  const { user, loading: sdkLoading, authenticateUser } = usePiSDK();
  const [tab, setTab] = useState<'buyer' | 'seller' | 'transactions' | 'stats'>('buyer');

  // Buyer State
  const [amount, setAmount] = useState('');
  const [sellerWallet, setSellerWallet] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyerError, setBuyerError] = useState('');
  const [escrowResult, setEscrowResult] = useState<any>(null);

  // Release State
  const [releaseCode, setReleaseCode] = useState('');
  const [releaseKey, setReleaseKey] = useState('');
  const [releaseConfirm, setReleaseConfirm] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState('');
  const [releaseSuccess, setReleaseSuccess] = useState(false);

  // Seller State
  const [sellerCode, setSellerCode] = useState('');
  const [sellerTx, setSellerTx] = useState<Transaction | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerError, setSellerError] = useState('');

  // General State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [stats, setStats] = useState<EscrowStats>({ total: 0, released: 0, disputed: 0, totalPi: 0 });

  useSessionTimer(30);

  // Re-auth logic
  useEffect(() => {
    if (!sdkLoading && !user) {
      authenticateUser();
    }
  }, [user, sdkLoading, authenticateUser]);

  // Load Transactions & Stats
  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setTxLoading(true);
    try {
      const data = await API.history(user.username);
      if (data.success) {
        setTransactions(data.transactions || []);
        // Calculate stats
        const txs = data.transactions || [];
        setStats({
          total: txs.length,
          released: txs.filter((t: any) => t.status === 'RELEASED').length,
          disputed: txs.filter((t: any) => t.status === 'DISPUTED').length,
          totalPi: txs.reduce((acc: number, t: any) => acc + (t.amount || 0), 0)
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && tab === 'transactions') loadTransactions();
    if (user && tab === 'stats') loadTransactions();
  }, [user, tab, loadTransactions]);

  // Handlers
  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsProcessing(true);
    setBuyerError('');
    try {
      const txNumber = `ORACLE-GHAITH2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const data = await API.create({
        transactionNumber: txNumber,
        amount: parseFloat(amount),
        sellerWallet,
        description,
        buyerUsername: user.username,
        createdAt: new Date().toISOString()
      });
      if (data.success) {
        setEscrowResult({
          transactionNumber: data.transaction.transactionNumber,
          escrowCode: data.transaction.escrowCode,
          secretKey: data.transaction.secretKey,
          shareUrl: `${window.location.origin}/?code=${data.transaction.escrowCode}`
        });
        setAmount('');
        setSellerWallet('');
        setDescription('');
      } else {
        setBuyerError(data.error || 'Failed to create escrow');
      }
    } catch (err) {
      setBuyerError('Network error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (releaseConfirm !== 'CONFIRM') return;
    setReleaseLoading(true);
    setReleaseError('');
    try {
      const data = await API.release({
        escrowCode: releaseCode,
        secretKey: releaseKey,
        buyerUsername: user.username
      });
      if (data.success) {
        setReleaseSuccess(true);
        setTimeout(() => {
          setReleaseSuccess(false);
          setReleaseCode('');
          setReleaseKey('');
          setReleaseConfirm('');
        }, 3000);
        loadTransactions();
      } else {
        setReleaseError(data.error || 'Invalid Code or Secret Key');
      }
    } catch (err) {
      setReleaseError('Release failed');
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleLookupEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerLoading(true);
    setSellerError('');
    try {
      const data = await API.lookup(sellerCode);
      if (data.success) {
        setSellerTx(data.transaction);
      } else {
        setSellerError(data.error || 'Escrow not found');
      }
    } catch (err) {
      setSellerError('Lookup failed');
    } finally {
      setSellerLoading(false);
    }
  };

  const handleAcceptDeal = async () => {
    if (!sellerTx) return;
    setSellerLoading(true);
    try {
      const data = await API.updateStatus(sellerTx._id, 'ACCEPT');
      if (data.success) setSellerTx(data.transaction);
    } catch (err) {
      setSellerError('Update failed');
    } finally {
      setSellerLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!sellerTx) return;
    setSellerLoading(true);
    try {
      const data = await API.updateStatus(sellerTx._id, 'COMPLETE'); // Maps to DELIVERED usually
      if (data.success) setSellerTx(data.transaction);
    } catch (err) {
      setSellerError('Update failed');
    } finally {
      setSellerLoading(false);
    }
  };

  const submitRating = async (code: string, rating: number, username: string) => {
    await API.rate({ escrowCode: code, rating, username });
  };

  const openDispute = (tx: Transaction) => {
    alert(`Dispute opened for ${tx.escrowCode}. Admin contacted at Riahig45@gmail.com`);
  };

  if (sdkLoading || !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-t-2 border-amber-500 rounded-full animate-spin"></div>
          <Shield className="absolute inset-0 m-auto text-amber-500" size={24} />
        </div>
        <p className="text-amber-500 font-black text-xs uppercase tracking-widest animate-pulse">Establishing Secure Uplink...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-neutral-100 font-sans selection:bg-amber-500/30 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShieldCheck className="text-black" size={20} />
            </div>
            <h1 className="font-black text-lg tracking-tighter italic">PTrust Oracle</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] font-black text-neutral-500 uppercase leading-none">Operator</div>
              <div className="text-xs font-black text-amber-500">@{user.username}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center">
              <LogOut size={14} className="text-neutral-500 hover:text-rose-500 cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 mt-6">
        {/* Navigation */}
        <div className="flex bg-neutral-900/50 p-1 border border-white/5 rounded-2xl mb-6">
          {(['buyer', 'seller', 'transactions', 'stats'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === t ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-neutral-500'
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'buyer' && (
          <div className="space-y-5">
            {!escrowResult ? (
              <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
                <h2 className="text-xl font-black italic mb-4 flex items-center gap-2 tracking-tight">
                  <Zap className="text-amber-500 fill-amber-500" size={20} /> New Secure Escrow
                </h2>
                <HowItWorks />
                <form onSubmit={handleCreateEscrow} className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Seller Wallet Address</label>
                    <input
                      required placeholder="G..." value={sellerWallet} onChange={e => setSellerWallet(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Pi Amount</label>
                    <div className="relative">
                      <input
                        required type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                        className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-lg font-black"
                      />
                      <span className="absolute right-4 top-4 text-neutral-500 font-black text-xs uppercase">Pi</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Deal terms</label>
                    <textarea
                      required placeholder="Item details, shipping terms..." value={description} onChange={e => setDescription(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none text-xs h-20 resize-none"
                    />
                  </div>
                  {buyerError && (
                    <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20 flex items-center gap-2">
                      <AlertCircle size={13} />
                      {buyerError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isProcessing || !amount || !sellerWallet}
                    className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm"
                  >
                    {isProcessing
                      ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                      : <Lock size={16} />
                    }
                    {isProcessing ? 'Creating...' : 'Lock Funds in Escrow'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/5 border border-green-500/20 rounded-3xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <CheckCircle2 className="text-green-400" size={20} />
                    <h2 className="text-lg font-black text-green-400">Escrow Created!</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-black/30 rounded-2xl p-4">
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-1 flex items-center gap-1">
                        <Hash size={10} /> Transaction Number
                      </div>
                      <div className="text-sm font-black text-amber-500 tracking-wider mb-2">
                        {escrowResult.transactionNumber}
                      </div>
                      <CopyButton text={escrowResult.transactionNumber} label="Copy TX Number" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4">
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">
                        Escrow Code — Share with Seller
                      </div>
                      <div className="text-2xl font-black text-amber-500 tracking-widest mb-2">
                        {escrowResult.escrowCode}
                      </div>
                      <CopyButton text={escrowResult.escrowCode} label="Copy Code" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4 border border-red-500/20">
                      <div className="text-[10px] uppercase font-black text-red-400 mb-1">
                        Secret Key — PRIVATE
                      </div>
                      <div className="text-lg font-black text-white tracking-widest mb-1">
                        {escrowResult.secretKey}
                      </div>
                      <p className="text-red-400/60 text-[10px] mb-2">
                        Never share this. You need it to release funds.
                      </p>
                      <CopyButton text={escrowResult.secretKey} label="Copy Secret Key" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4">
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">
                        Share Link — Send to Seller
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mb-2 break-all">
                        {escrowResult.shareUrl}
                      </div>
                      <div className="flex gap-2">
                        <CopyButton text={escrowResult.shareUrl} label="Copy Link" />
                        <button
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: 'PTrust Oracle Escrow', url: escrowResult.shareUrl });
                            } else {
                              window.open('https://wa.me/?text=' + encodeURIComponent(escrowResult.shareUrl));
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] font-black text-amber-500"
                        >
                          <Share2 size={11} /> Share
                        </button>
                      </div>
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                      <p className="text-amber-500 text-[11px] font-black">Next Step</p>
                      <p className="text-neutral-400 text-[11px] mt-1">
                        Wait for seller to Accept the deal. Then come back to release funds after delivery.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setEscrowResult(null)}
                  className="w-full py-3 text-neutral-500 text-sm font-black hover:text-white transition-all"
                >
                  + Create New Escrow
                </button>
              </div>
            )}

            <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6">
              <h3 className="text-base font-black mb-1 flex items-center gap-2">
                <Key size={16} className="text-amber-500" /> Release Existing Escrow
              </h3>
              <p className="text-neutral-500 text-[11px] mb-4">
                After seller confirms delivery, enter your codes here to release funds.
              </p>
              <form onSubmit={handleRelease} className="space-y-3">
                <input
                  required
                  placeholder="Escrow Code (PTO-XXXXXX)"
                  value={releaseCode}
                  onChange={(e) => setReleaseCode(e.target.value.toUpperCase())}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-sm uppercase"
                />
                <input
                  required
                  placeholder="Your Secret Key (SK-XXXXXX)"
                  value={releaseKey}
                  onChange={(e) => setReleaseKey(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-sm"
                />
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-500 text-[11px] font-black mb-2">
                    Type CONFIRM to release funds (irreversible)
                  </p>
                  <input
                    required
                    placeholder="Type: CONFIRM"
                    value={releaseConfirm}
                    onChange={(e) => setReleaseConfirm(e.target.value)}
                    className="w-full bg-black/50 border border-amber-500/20 rounded-xl py-3 px-4 focus:border-amber-500 outline-none text-sm text-center font-black tracking-widest"
                  />
                </div>
                {releaseError && (
                  <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20 flex items-center gap-2">
                    <AlertCircle size={13} />
                    {releaseError}
                  </div>
                )}
                {releaseSuccess && (
                  <div className="text-green-400 text-xs p-3 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2">
                    <CheckCircle2 size={13} /> Funds Released Successfully!
                  </div>
                )}
                <button
                  type="submit"
                  disabled={releaseLoading || releaseSuccess || releaseConfirm !== 'CONFIRM'}
                  className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-30 text-sm"
                >
                  {releaseLoading ? 'Releasing...' : 'Release Funds to Seller'}
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === 'seller' && (
          <div className="space-y-5">
            <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
              <h2 className="text-xl font-black italic mb-5 flex items-center gap-2">
                <Package className="text-amber-500" size={20} /> Seller Dashboard
              </h2>
              {!sellerTx ? (
                <form onSubmit={handleLookupEscrow} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">
                      Escrow Code
                    </label>
                    <input
                      required
                      placeholder="PTO-XXXXXX"
                      value={sellerCode}
                      onChange={(e) => setSellerCode(e.target.value.toUpperCase())}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-4 focus:border-amber-500 outline-none font-mono text-xl text-center tracking-widest uppercase"
                    />
                  </div>
                  {sellerError && (
                    <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                      {sellerError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={sellerLoading || !sellerCode}
                    className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 text-sm"
                  >
                    {sellerLoading ? 'Looking up...' : 'Find Escrow'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-black/30 rounded-2xl p-4 space-y-3">
                    {[
                      { label: 'Transaction #', value: <span className="font-black text-amber-500 text-xs">{sellerTx.transactionNumber || '-'}</span> },
                      { label: 'Escrow Code', value: <span className="font-black text-amber-500">{sellerTx.escrowCode}</span> },
                      { label: 'Amount', value: <span className="font-black text-lg">{sellerTx.amount} Pi</span> },
                      { label: 'Buyer', value: <span className="font-black">@{sellerTx.buyerUsername}</span> },
                      { label: 'Status', value: <StatusBadge status={sellerTx.status} /> },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black text-neutral-500">{label}</span>
                        {value}
                      </div>
                    ))}
                    {sellerTx.description && (
                      <div>
                        <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">Deal Terms</div>
                        <p className="text-sm text-neutral-300">{sellerTx.description}</p>
                      </div>
                    )}
                    {sellerTx.deliveryDeadline && sellerTx.status === 'ACCEPTED' && (
                      <div className="text-[10px] text-amber-500/70">
                        Delivery deadline: {new Date(sellerTx.deliveryDeadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {sellerTx.status === 'PENDING' && (
                    <div className="space-y-3">
                      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
                        <p className="text-yellow-400 text-[11px] font-black">
                          Step 1 — Accept this deal to lock the funds securely
                        </p>
                      </div>
                      <button
                        onClick={handleAcceptDeal}
                        disabled={sellerLoading}
                        className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm"
                      >
                        {sellerLoading
                          ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                          : <Shield size={16} />
                        }
                        Accept Deal and Lock Funds
                      </button>
                    </div>
                  )}

                  {sellerTx.status === 'ACCEPTED' && (
                    <div className="space-y-3">
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                        <p className="text-amber-500 text-[11px] font-black">
                          Step 2 — Send the goods then confirm delivery
                        </p>
                      </div>
                      <button
                        onClick={handleConfirmDelivery}
                        disabled={sellerLoading}
                        className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm"
                      >
                        {sellerLoading
                          ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                          : <Package size={16} />
                        }
                        Confirm Delivery
                      </button>
                    </div>
                  )}

                  {sellerTx.status === 'DELIVERED' && (
                    <div className="text-blue-400 text-sm font-black p-4 bg-blue-500/5 rounded-xl border border-blue-500/20 flex items-center gap-2">
                      <CheckCircle2 size={15} /> Delivery confirmed! Waiting for buyer to release funds.
                    </div>
                  )}

                  {sellerTx.status === 'RELEASED' && (
                    <div className="space-y-3">
                      <div className="text-green-400 text-sm font-black p-4 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2">
                        <CheckCircle2 size={15} /> Funds released to your wallet!
                      </div>
                      {!sellerTx.rating && (
                        <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4">
                          <p className="text-xs font-black text-neutral-400 mb-3">Rate this transaction:</p>
                          <StarRating
                            onRate={async (n) => {
                              try {
                                await submitRating(sellerTx.escrowCode, n, user.username);
                                setSellerTx((prev) => prev ? { ...prev, rating: n } : null);
                              } catch { }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {sellerError && (
                    <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                      {sellerError}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSellerTx(null);
                      setSellerCode('');
                    }}
                    className="w-full py-3 text-neutral-500 text-sm font-black hover:text-white transition-all"
                  >
                    Look up another escrow
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black italic">My Deals</h2>
              <button
                onClick={loadTransactions}
                className="text-[10px] uppercase font-black text-amber-500 hover:text-amber-400"
              >
                Refresh
              </button>
            </div>
            {txLoading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-7 w-7 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            )}
            {!txLoading && transactions.length === 0 && (
              <div className="text-center py-16 text-neutral-600">
                <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-black text-sm">No transactions yet</p>
              </div>
            )}
            {transactions.map((tx) => (
              <div key={tx._id} className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-500 tracking-widest text-xs">
                    {tx.transactionNumber || tx.escrowCode}
                  </span>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 text-xs">Amount</span>
                  <span className="font-black">{tx.amount} Pi</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 text-xs">
                    {tx.buyerUsername === user?.username ? 'Seller' : 'Buyer'}
                  </span>
                  <span className="font-black text-xs">
                    {tx.buyerUsername === user?.username
                      ? (tx.sellerWallet?.slice(0, 8) || '') + '...'
                      : '@' + tx.buyerUsername
                    }
                  </span>
                </div>
                {tx.description && (
                  <p className="text-[11px] text-neutral-500">{tx.description}</p>
                )}
                <div className="text-[10px] text-neutral-600">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </div>
                {tx.status === 'DELIVERED' && tx.buyerUsername === user?.username && (
                  <button
                    onClick={() => {
                      setTab('buyer');
                      setReleaseCode(tx.escrowCode);
                    }}
                    className="w-full py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black rounded-xl text-xs hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Key size={12} /> Release Funds
                  </button>
                )}
                {(tx.status === 'PENDING' || tx.status === 'ACCEPTED' || tx.status === 'LOCKED' || tx.status === 'DELIVERED') && (
                  <button
                    onClick={() => openDispute(tx)}
                    className="w-full py-2.5 bg-red-500/5 border border-red-500/20 text-red-400 font-black rounded-xl text-xs hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={12} /> Open Dispute
                  </button>
                )}
                {tx.status === 'RELEASED' && !tx.rating && tx.buyerUsername === user?.username && (
                  <div className="pt-1">
                    <p className="text-[10px] text-neutral-500 mb-2">Rate this deal:</p>
                    <StarRating
                      rating={tx.rating}
                      onRate={async (n) => {
                        try {
                          await submitRating(tx.escrowCode, n, user?.username || '');
                          setTransactions((prev) =>
                            prev.map((t) => t._id === tx._id ? { ...t, rating: n } : t)
                          );
                        } catch { }
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black italic">My Statistics</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Deals', value: stats.total, icon: '📊', color: 'text-white' },
                { label: 'Completed', value: stats.released, icon: '✅', color: 'text-green-400' },
                { label: 'Disputed', value: stats.disputed, icon: '⚠️', color: 'text-red-400' },
                { label: 'Pi Transacted', value: stats.totalPi.toFixed(1) + ' π', icon: '💰', color: 'text-amber-500' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className={'text-2xl font-black ' + color}>{value}</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5">
              <h3 className="font-black text-sm mb-3 flex items-center gap-2">
                <Mail size={14} className="text-amber-500" /> Support
              </h3>
              <p className="text-neutral-500 text-xs mb-4">
                Having issues? Contact our support team directly.
              </p>
              <button
                onClick={() => window.open('mailto:Riahig45@gmail.com?subject=PTrust Oracle Support')}
                className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black rounded-xl text-xs hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Mail size={13} /> Contact Support
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
