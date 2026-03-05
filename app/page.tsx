"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import {
  ShieldCheck, Wallet, AlertCircle, CheckCircle2, ArrowRight, Lock, Zap,
  Copy, Share2, Key, Package, ClipboardList, Star, BarChart3, AlertTriangle,
  HelpCircle, ChevronDown, ChevronUp, LogOut, Clock, Mail, Shield
} from 'lucide-react';

interface Transaction {
  _id: string;
  escrowCode: string;
  secretKey: string;
  sellerWallet: string;
  buyerUsername: string;
  amount: number;
  fee: number;
  description: string;
  status: "LOCKED" | "DELIVERED" | "RELEASED" | "DISPUTED";
  createdAt: string;
  rating?: number;
}

async function createEscrow(data: { sellerWallet: string; amount: number; fee: number; description: string; buyerUsername: string; }) {
  const res = await fetch("/api/escrow/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Oracle Error");
  return res.json();
}

async function fetchEscrowByCode(code: string) {
  const res = await fetch("/api/escrow/transaction/" + code);
  if (!res.ok) throw new Error("Escrow not found");
  return res.json();
}

async function confirmDelivery(escrowCode: string, sellerUsername: string) {
  const res = await fetch("/api/escrow/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escrowCode, sellerUsername }) });
  if (!res.ok) throw new Error("Delivery confirmation failed");
  return res.json();
}

async function releaseEscrow(escrowCode: string, secretKey: string) {
  const res = await fetch("/api/escrow/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escrowCode, secretKey }) });
  if (!res.ok) throw new Error("Release failed - check your secret key");
  return res.json();
}

async function fetchMyTransactions(username: string) {
  const res = await fetch("/api/escrow/transactions?username=" + username);
  if (!res.ok) throw new Error("Failed to load transactions");
  return res.json();
}

async function submitRating(escrowCode: string, rating: number, username: string) {
  const res = await fetch("/api/escrow/rate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escrowCode, rating, username }) });
  if (!res.ok) throw new Error("Rating failed");
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    LOCKED: { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Locked" },
    DELIVERED: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Delivered" },
    RELEASED: { color: "bg-green-500/10 text-green-400 border-green-500/20", label: "Released" },
    DISPUTED: { color: "bg-red-500/10 text-red-400 border-red-500/20", label: "Disputed" },
  };
  const s = map[status] || map.LOCKED;
  return (
    <span className={"text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border " + s.color}>
      {s.label}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black transition-all">
      <Copy size={12} /> {copied ? "Copied!" : label}
    </button>
  );
}

function HowItWorks() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="w-full bg-neutral-900/40 border border-white/5 rounded-2xl p-2 mt-4">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3 text-sm font-black text-neutral-300 hover:text-white transition-all">
        <span className="flex items-center gap-2"><HelpCircle size={16} className="text-amber-500" /> How does it work?</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && (
        <div className="p-3 pt-1 text-[11px] text-neutral-400 space-y-3 text-left">
          <div className="space-y-1"><div className="text-white font-black"><span className="text-amber-500">1.</span> Create Escrow</div><p>Buyer locks Pi for a seller.</p></div>
          <div className="space-y-1"><div className="text-white font-black"><span className="text-amber-500">2.</span> Secure Delivery</div><p>Seller delivers and updates status.</p></div>
          <div className="space-y-1"><div className="text-white font-black"><span className="text-amber-500">3.</span> Release Funds</div><p>Buyer releases funds securely using their secret key.</p></div>
        </div>
      )}
    </div>
  );
}

function StarRating({ onRate }: { onRate: (rating: number) => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" disabled={loading || rating > 0} onClick={async () => { setLoading(true); setRating(star); await onRate(star); setLoading(false); }} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} className="transition-all p-1">
          <Star size={18} className={(hover || rating) >= star ? "text-amber-500 fill-amber-500" : "text-neutral-600"} />
        </button>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"buyer" | "seller" | "transactions" | "stats">("buyer");
  const [sessionExpired, setSessionExpired] = useState(false);

  const [sellerWallet, setSellerWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyerError, setBuyerError] = useState<string | null>(null);
  const [escrowResult, setEscrowResult] = useState<{ escrowCode: string; secretKey: string; shareUrl: string; } | null>(null);

  const [sellerCode, setSellerCode] = useState("");
  const [sellerTx, setSellerTx] = useState<Transaction | null>(null);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);

  const [releaseCode, setReleaseCode] = useState("");
  const [releaseKey, setReleaseKey] = useState("");
  const [releaseConfirm, setReleaseConfirm] = useState("");
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const stats = useMemo(() => {
    let total = 0, released = 0, disputed = 0, totalPi = 0;
    transactions.forEach(t => {
      total++;
      if (t.status === 'RELEASED') released++;
      if (t.status === 'DISPUTED') disputed++;
      if (t.status === 'RELEASED' || t.status === 'DELIVERED') totalPi += t.amount;
    });
    return { total, released, disputed, totalPi };
  }, [transactions]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const match = path.match(/\/escrow\/([A-Z0-9-]+)/);
      if (match) { setTab("seller"); setSellerCode(match[1]); }
    }
  }, []);

  const fee = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) || val <= 0 ? 0 : val / 100;
  }, [amount]);

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setBuyerError("Connect Pi Wallet first.");
    setIsProcessing(true); setBuyerError(null); setEscrowResult(null);
    try {
      const result = await createEscrow({ sellerWallet, amount: parseFloat(amount), fee, description: description || "No description", buyerUsername: user.username });
      setEscrowResult({ escrowCode: result.escrowCode, secretKey: result.secretKey, shareUrl: window.location.origin + "/escrow/" + result.escrowCode });
      setAmount(""); setSellerWallet(""); setDescription("");
    } catch (err: any) { setBuyerError(err.message || "Failed to create escrow."); } finally { setIsProcessing(false); }
  };

  const handleLookupEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setSellerError("Connect Pi Wallet first.");
    setSellerLoading(true); setSellerError(null); setSellerTx(null);
    try {
      const result = await fetchEscrowByCode(sellerCode.toUpperCase());
      setSellerTx(result.transaction);
    } catch (err: any) { setSellerError(err.message); } finally { setSellerLoading(false); }
  };

  const handleConfirmDelivery = async () => {
    if (!user || !sellerTx) return;
    setSellerLoading(true); setSellerError(null);
    try {
      await confirmDelivery(sellerTx.escrowCode, user.username);
      setDeliverySuccess(true); setSellerTx({ ...sellerTx, status: "DELIVERED" });
    } catch (err: any) { setSellerError(err.message); } finally { setSellerLoading(false); }
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setReleaseLoading(true); setReleaseError(null);
    try {
      await releaseEscrow(releaseCode.toUpperCase(), releaseKey);
      setReleaseSuccess(true);
    } catch (err: any) { setReleaseError(err.message); } finally { setReleaseLoading(false); }
  };

  const loadTransactions = async () => {
    if (!user) return;
    setTxLoading(true);
    try {
      const result = await fetchMyTransactions(user.username);
      setTransactions(result.transactions || []);
    } catch { setTransactions([]); } finally { setTxLoading(false); }
  };

  useEffect(() => {
    if ((tab === 'transactions' || tab === 'stats') && user) loadTransactions();
  }, [tab, user]);

  const openDispute = (tx: Transaction) => {
    const subject = encodeURIComponent('PTrust Oracle Dispute - ' + tx.escrowCode);
    const body = encodeURIComponent('Escrow Code: ' + tx.escrowCode + '\nAmount: ' + tx.amount + ' Pi\nBuyer: @' + tx.buyerUsername + '\nStatus: ' + tx.status + '\nDescription: ' + tx.description + '\n\nPlease describe your issue:');
    window.open('mailto:Riahig45@gmail.com?subject=' + subject + '&body=' + body);
  };

  if (!mounted) return null;

  if (sessionExpired) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505] text-white">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
            <Clock size={28} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-black">Session Expired</h2>
          <p className="text-neutral-500 text-sm">Your session expired after 30 minutes of inactivity. Please sign in again.</p>
          <button onClick={() => { setSessionExpired(false); authenticateUser(); }} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-3">
            <Wallet size={18} /> Sign In Again
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-5 bg-[#050505] text-white">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-amber-500/[0.07] blur-[140px] pointer-events-none -z-10" />
        <div className="flex flex-col items-center text-center space-y-8 w-full max-w-sm px-2">
          <div className="flex flex-col items-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black tracking-[0.2em] uppercase">
              <ShieldCheck size={12} /> Secured by Pi Network SDK 2.0
            </div>
            <h1 className="text-6xl font-black tracking-tighter leading-none italic">P<span className="text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600">TRUST</span></h1>
            <h2 className="text-lg font-light tracking-[0.4em] text-neutral-500 uppercase">Oracle</h2>
            <p className="text-neutral-400 text-sm leading-relaxed">The most secure escrow platform on Pi Network. Lock funds, verify delivery, release with confidence.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full text-center">
            {[{ value: '0%', label: 'Disputes' }, { value: '1%', label: 'Fee' }, { value: '24/7', label: 'Available' }].map((s) => (
              <div key={s.label} className="bg-neutral-900/50 border border-white/5 rounded-2xl py-3">
                <div className="text-2xl font-black text-amber-500">{s.value}</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="w-full space-y-2">
            {[
              { icon: Shield, text: 'End-to-end protected transactions' },
              { icon: Lock, text: 'Secret key only you control' },
              { icon: Star, text: 'Rating system for trusted trading' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[11px] text-neutral-500">
                <Icon size={11} className="text-amber-500" /> {text}
              </div>
            ))}
          </div>
          <button onClick={authenticateUser} disabled={loading} className="w-full py-5 bg-amber-500 text-black font-black rounded-2xl transition-all active:scale-95 hover:bg-amber-400 shadow-[0_20px_60px_rgba(245,158,11,0.25)] flex items-center justify-center gap-3 disabled:opacity-50">
            <Wallet size={20} />
            <span className="text-sm">{loading ? 'AUTHENTICATING...' : 'CONNECT PI WALLET'}</span>
            <ArrowRight size={16} />
          </button>
          <HowItWorks />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4 bg-[#050505] text-white">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[400px] bg-amber-500/[0.04] blur-[100px] pointer-events-none -z-10" />
      <div className="w-full max-w-lg mt-6 mb-24 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black italic">P<span className="text-amber-500">TRUST</span></h1>
            <p className="text-neutral-500 text-[11px]">@{user.username}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-black font-black">{user.username.charAt(0).toUpperCase()}</div>
            <button onClick={() => setSessionExpired(true)} className="text-neutral-600 hover:text-red-400 transition-all"><LogOut size={16} /></button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-900/50 border border-white/5 rounded-2xl">
          {[
            { key: 'buyer', label: 'Buyer', icon: Lock },
            { key: 'seller', label: 'Seller', icon: Package },
            { key: 'transactions', label: 'Deals', icon: ClipboardList },
            { key: 'stats', label: 'Stats', icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={'flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black transition-all ' + (tab === key ? 'bg-amber-500 text-black' : 'text-neutral-500 hover:text-white')}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {tab === 'buyer' && (
          <div className="space-y-5">
            <HowItWorks />
            {!escrowResult ? (
              <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
                <h2 className="text-xl font-black italic mb-5 flex items-center gap-2"><Zap className="text-amber-500 fill-amber-500" size={20} /> Create Escrow</h2>
                <form onSubmit={handleCreateEscrow} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Seller Wallet Address</label>
                    <input required placeholder="G..." value={sellerWallet} onChange={(e) => setSellerWallet(e.target.value)} className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none text-white font-mono text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Amount (Pi)</label>
                      <input required type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 text-amber-500 font-black text-lg focus:border-amber-500 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-neutral-500 ml-1">Fee (1%)</label>
                      <div className="w-full bg-neutral-800/20 border border-white/5 rounded-2xl py-3.5 px-4 text-neutral-400 font-black text-lg italic">{fee.toFixed(3)} Pi</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Deal Terms</label>
                    <textarea placeholder="Describe the goods or service..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none text-sm resize-none" />
                  </div>
                  {buyerError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20 flex items-center gap-2"><AlertCircle size={13} />{buyerError}</div>}
                  <button type="submit" disabled={isProcessing || !amount || !sellerWallet} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm">
                    {isProcessing ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" /> : <Lock size={16} />}
                    {isProcessing ? 'Creating...' : 'Lock Funds in Escrow'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/5 border border-green-500/20 rounded-3xl p-6">
                  <div className="flex items-center gap-2 mb-5"><CheckCircle2 className="text-green-400" size={20} /><h2 className="text-lg font-black text-green-400">Escrow Created!</h2></div>
                  <div className="space-y-3">
                    <div className="bg-black/30 rounded-2xl p-4">
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">Escrow Code</div>
                      <div className="text-2xl font-black text-amber-500 tracking-widest mb-2">{escrowResult.escrowCode}</div>
                      <CopyButton text={escrowResult.escrowCode} label="Copy Code" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4 border border-red-500/20">
                      <div className="text-[10px] uppercase font-black text-red-400 mb-1">Secret Key — PRIVATE</div>
                      <div className="text-lg font-black text-white tracking-widest mb-1">{escrowResult.secretKey}</div>
                      <p className="text-red-400/60 text-[10px] mb-2">Never share this. You need it to release funds.</p>
                      <CopyButton text={escrowResult.secretKey} label="Copy Secret Key" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4">
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">Share Link</div>
                      <div className="text-[11px] text-neutral-400 font-mono mb-2 break-all">{escrowResult.shareUrl}</div>
                      <div className="flex gap-2">
                        <CopyButton text={escrowResult.shareUrl} label="Copy Link" />
                        <button onClick={() => { if (navigator.share) navigator.share({ title: 'PTrust Oracle Escrow', url: escrowResult.shareUrl }); else window.open('https://wa.me/?text=' + encodeURIComponent(escrowResult.shareUrl)); }} className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] font-black text-amber-500">
                          <Share2 size={11} /> Share
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => setEscrowResult(null)} className="w-full py-3 text-neutral-500 text-sm font-black hover:text-white transition-all">+ Create New Escrow</button>
              </div>
            )}
            <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6">
              <h3 className="text-base font-black mb-1 flex items-center gap-2"><Key size={16} className="text-amber-500" /> Release Existing Escrow</h3>
              <p className="text-neutral-500 text-[11px] mb-4">After seller confirms delivery, enter your codes to release funds.</p>
              <form onSubmit={handleRelease} className="space-y-3">
                <input required placeholder="Escrow Code (PTO-XXXXXX)" value={releaseCode} onChange={(e) => setReleaseCode(e.target.value.toUpperCase())} className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-sm uppercase" />
                <input required placeholder="Your Secret Key (SK-XXXXXX)" value={releaseKey} onChange={(e) => setReleaseKey(e.target.value)} className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-sm" />
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-500 text-[11px] font-black mb-2">Type CONFIRM to release funds (irreversible)</p>
                  <input required placeholder="Type: CONFIRM" value={releaseConfirm} onChange={(e) => setReleaseConfirm(e.target.value)} className="w-full bg-black/50 border border-amber-500/20 rounded-xl py-3 px-4 focus:border-amber-500 outline-none text-sm text-center font-black tracking-widest" />
                </div>
                {releaseError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{releaseError}</div>}
                {releaseSuccess && <div className="text-green-400 text-xs p-3 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2"><CheckCircle2 size={13} /> Funds Released!</div>}
                <button type="submit" disabled={releaseLoading || releaseSuccess || releaseConfirm !== 'CONFIRM'} className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-30 text-sm">
                  {releaseLoading ? 'Releasing...' : 'Release Funds to Seller'}
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === 'seller' && (
          <div className="space-y-5">
            <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
              <h2 className="text-xl font-black italic mb-5 flex items-center gap-2"><Package className="text-amber-500" size={20} /> Claim Payment</h2>
              {!sellerTx ? (
                <form onSubmit={handleLookupEscrow} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Escrow Code</label>
                    <input required placeholder="PTO-XXXXXX" value={sellerCode} onChange={(e) => setSellerCode(e.target.value.toUpperCase())} className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-4 focus:border-amber-500 outline-none font-mono text-xl text-center tracking-widest uppercase" />
                  </div>
                  {sellerError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{sellerError}</div>}
                  <button type="submit" disabled={sellerLoading || !sellerCode} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 text-sm">
                    {sellerLoading ? 'Looking up...' : 'Find My Escrow'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-black/30 rounded-2xl p-4 space-y-3">
                    {[
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
                    {sellerTx.description && <div><div className="text-[10px] uppercase font-black text-neutral-500 mb-1">Deal Terms</div><p className="text-sm text-neutral-300">{sellerTx.description}</p></div>}
                  </div>
                  {sellerTx.status === 'LOCKED' && !deliverySuccess && (
                    <button onClick={handleConfirmDelivery} disabled={sellerLoading} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm">
                      {sellerLoading ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" /> : <Package size={16} />}
                      Confirm Delivery
                    </button>
                  )}
                  {(sellerTx.status === 'DELIVERED' || deliverySuccess) && (
                    <div className="text-blue-400 text-sm font-black p-4 bg-blue-500/5 rounded-xl border border-blue-500/20 flex items-center gap-2">
                      <CheckCircle2 size={15} /> Delivery confirmed! Waiting for buyer to release funds.
                    </div>
                  )}
                  {sellerTx.status === 'RELEASED' && (
                    <div className="space-y-3">
                      <div className="text-green-400 text-sm font-black p-4 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2"><CheckCircle2 size={15} /> Funds released to your wallet!</div>
                      {sellerTx.buyerUsername === user.username && !sellerTx.rating && (
                        <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4">
                          <p className="text-xs font-black text-neutral-400 mb-3">Rate this transaction:</p>
                          <StarRating onRate={async (n) => { try { await submitRating(sellerTx.escrowCode, n, user.username); setSellerTx({ ...sellerTx, rating: n }); } catch { } }} />
                        </div>
                      )}
                    </div>
                  )}
                  {sellerError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{sellerError}</div>}
                  <button onClick={() => { setSellerTx(null); setSellerCode(''); setDeliverySuccess(false); }} className="w-full py-3 text-neutral-500 text-sm font-black hover:text-white transition-all">Look up another escrow</button>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black italic">My Deals</h2>
              <button onClick={loadTransactions} className="text-[10px] uppercase font-black text-amber-500 hover:text-amber-400">Refresh</button>
            </div>
            {txLoading && <div className="flex justify-center py-12"><div className="animate-spin h-7 w-7 border-2 border-amber-500 border-t-transparent rounded-full" /></div>}
            {!txLoading && transactions.length === 0 && (
              <div className="text-center py-16 text-neutral-600">
                <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-black text-sm">No transactions yet</p>
              </div>
            )}
            {transactions.map((tx) => (
              <div key={tx._id} className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-500 tracking-widest text-sm">{tx.escrowCode}</span>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="flex items-center justify-between"><span className="text-neutral-500 text-xs">Amount</span><span className="font-black">{tx.amount} Pi</span></div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 text-xs">{tx.buyerUsername === user.username ? 'Seller' : 'Buyer'}</span>
                  <span className="font-black text-xs">{tx.buyerUsername === user.username ? tx.sellerWallet.slice(0, 8) + '...' : '@' + tx.buyerUsername}</span>
                </div>
                {tx.description && <p className="text-[11px] text-neutral-500">{tx.description}</p>}
                <div className="text-[10px] text-neutral-600">{new Date(tx.createdAt).toLocaleDateString()}</div>
                {tx.status === 'DELIVERED' && tx.buyerUsername === user.username && (
                  <button onClick={() => { setTab('buyer'); setReleaseCode(tx.escrowCode); }} className="w-full py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black rounded-xl text-xs hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2">
                    <Key size={12} /> Release Funds
                  </button>
                )}
                {(tx.status === 'LOCKED' || tx.status === 'DELIVERED') && (
                  <button onClick={() => openDispute(tx)} className="w-full py-2.5 bg-red-500/5 border border-red-500/20 text-red-400 font-black rounded-xl text-xs hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
                    <AlertTriangle size={12} /> Open Dispute
                  </button>
                )}
                {tx.status === 'RELEASED' && !tx.rating && tx.buyerUsername === user.username && (
                  <div className="pt-1">
                    <p className="text-[10px] text-neutral-500 mb-2">Rate this deal:</p>
                    <StarRating onRate={async (n) => { try { await submitRating(tx.escrowCode, n, user.username); setTransactions(prev => prev.map(t => t._id === tx._id ? { ...t, rating: n } : t)); } catch { } }} />
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
              <h3 className="font-black text-sm mb-3 flex items-center gap-2"><Mail size={14} className="text-amber-500" /> Support</h3>
              <p className="text-neutral-500 text-xs mb-4">Having issues? Contact our support team directly.</p>
              <button onClick={() => window.open('mailto:Riahig45@gmail.com?subject=PTrust Oracle Support')} className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black rounded-xl text-xs hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2">
                <Mail size={13} /> Contact Support
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
