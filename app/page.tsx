'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import {
  ShieldCheck, Wallet, AlertCircle, CheckCircle2,
  ArrowRight, Lock, Zap, Copy, Share2, Key,
  Package, ClipboardList
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
  status: 'LOCKED' | 'DELIVERED' | 'RELEASED' | 'DISPUTED';
  createdAt: string;
}

async function createEscrow(data: {
  sellerWallet: string;
  amount: number;
  fee: number;
  description: string;
  buyerUsername: string;
}) {
  const res = await fetch('/api/escrow/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Oracle Error');
  return res.json();
}

async function fetchEscrowByCode(code: string) {
  const res = await fetch('/api/escrow/transaction/' + code);
  if (!res.ok) throw new Error('Escrow not found');
  return res.json();
}

async function confirmDelivery(escrowCode: string, sellerUsername: string) {
  const res = await fetch('/api/escrow/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ escrowCode, sellerUsername }),
  });
  if (!res.ok) throw new Error('Delivery confirmation failed');
  return res.json();
}

async function releaseEscrow(escrowCode: string, secretKey: string) {
  const res = await fetch('/api/escrow/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ escrowCode, secretKey }),
  });
  if (!res.ok) throw new Error('Release failed - check your secret key');
  return res.json();
}

async function fetchMyTransactions(username: string) {
  const res = await fetch('/api/escrow/transactions?username=' + username);
  if (!res.ok) throw new Error('Failed to load transactions');
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    LOCKED: { color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', label: 'Locked' },
    DELIVERED: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Delivered' },
    RELEASED: { color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Released' },
    DISPUTED: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Disputed' },
  };
  const s = map[status] || map.LOCKED;
  return (
    <span className={'text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ' + s.color}>
      {s.label}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black transition-all">
      <Copy size={12} />
      {copied ? 'Copied!' : label}
    </button>
  );
}

export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'buyer' | 'seller' | 'transactions'>('buyer');

  const [sellerWallet, setSellerWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyerError, setBuyerError] = useState<string | null>(null);
  const [escrowResult, setEscrowResult] = useState<{ escrowCode: string; secretKey: string; shareUrl: string } | null>(null);
  const [sellerCode, setSellerCode] = useState('');
  const [sellerTx, setSellerTx] = useState<Transaction | null>(null);
  const [sellerError, setSellerError] = useState<string |
n
ull>(null);
);
const [sellerLoading, setSellerLoading] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);

  const [releaseCode, setReleaseCode] = useState('');
  const [releaseKey, setReleaseKey] = useState('');
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/\/escrow\/([A-Z0-9-]+)/);
      if (match) {
        setTab('seller');
        setSellerCode(match[1]);
      }
    }
  }, []);

  const fee = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) || val <= 0 ? 0 : val / 100;
  }, [amount]);

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setBuyerError('Connect Pi Wallet first.'); return; }
    setIsProcessing(true);
    setBuyerError(null);
    setEscrowResult(null);
    try {
      const result = await createEscrow({
        sellerWallet,
        amount: parseFloat(amount),
        fee,
        description: description || 'No description',
        buyerUsername: user.username,
      });
      const shareUrl = window.location.origin + '/escrow/' + result.escrowCode;
      setEscrowResult({ escrowCode: result.escrowCode, secretKey: result.secretKey, shareUrl });
      setAmount(''); setSellerWallet(''); setDescription('');
    } catch (err: any) {
      setBuyerError(err.message || 'Failed to create escrow.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLookupEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setSellerError('Connect Pi Wallet first.'); return; }
    setSellerLoading(true);
    setSellerError(null);
    setSellerTx(null);
    try {
      const result = await fetchEscrowByCode(sellerCode.toUpperCase());
      setSellerTx(result.transaction);
    } catch (err: any) {
      setSellerError(err.message);
    } finally {
      setSellerLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!user || !sellerTx) return;
    setSellerLoading(true);
    setSellerError(null);
    try {
      await confirmDelivery(sellerTx.escrowCode, user.username);
      setDeliverySuccess(true);
      setSellerTx({ ...sellerTx, status: 'DELIVERED' });
    } catch (err: any) {
      setSellerError(err.message);
    } finally {
      setSellerLoading(false);
    }
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setReleaseLoading(true);
    setReleaseError(null);
    try {
      await releaseEscrow(releaseCode.toUpperCase(), releaseKey);
      setReleaseSuccess(true);
    } catch (err: any) {
      setReleaseError(err.message);
    } finally {
      setReleaseLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;
    setTxLoading(true);
    try {
      const result = await fetchMyTransactions(user.username);
      setTransactions(result.transactions || []);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'transactions' && user) loadTransactions();
  }, [tab, user]);

  if (!mounted) return null;

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505] text-white">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-amber-500/[0.07] blur-[140px] pointer-events-none -z-10" />
        <div className="flex flex-col items-center text-center space-y-10 max-w-4xl px-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border
border-amber-500/20 text-amber-500 text-[10px] font-black tracking-[0.3em] uppercase">
              <ShieldCheck size={14} /> Secured by Pi Network SDK 2.0
            </div>
            <h1 className="text-8xl md:text-9xl font-black tracking-tighter leading-none italic">
              P<span className="text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600">TRUST</span>
            </h1>
            <h2 className="text-2xl md:text-3xl font-light tracking-[0.5em] text-neutral-500 uppercase -mt-4">Oracle</h2>
            <p className="text-neutral-400 max-w-md text-sm leading-relaxed">
              The most secure escrow platform on Pi Network. Lock funds, verify delivery, release with confidence.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-8 text-center">
            {[{ value: '0%', label: 'Disputes' }, { value: '1%', label: 'Service Fee' }, { value: '24/7', label: 'Available' }].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-black text-amber-500">{s.value}</div>
                <div className="text-xs text-neutral-500 uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={authenticateUser} disabled={loading} className="px-12 py-6 bg-amber-500 text-black font-black rounded-2xl transition-all hover:scale-105 hover:bg-amber-400 shadow-[0_20px_80px_rgba(245,158,11,0.3)] flex items-center gap-4 disabled:opacity-50">
            <Wallet size={24} />
            <span>{loading ? 'AUTHENTICATING...' : 'CONNECT PI WALLET'}</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-6 bg-[#050505] text-white">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-amber-500/[0.05] blur-[120px] pointer-events-none -z-10" />
      <div className="w-full max-w-4xl mt-8 mb-20 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black italic">P<span className="text-amber-500">TRUST</span> Oracle</h1>
            <p className="text-neutral-500 text-xs mt-1">@{user.username}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-lg">
            {user.username.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-neutral-900/50 border border-white/5 rounded-2xl">
          {[
            { key: 'buyer', label: 'Buyer', icon: Lock },
            { key: 'seller', label: 'Seller', icon: Package },
            { key: 'transactions', label: 'My Deals', icon: ClipboardList },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ' +
                (tab === key ? 'bg-amber-500 text-black' : 'text-neutral-500 hover:text-white')}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === 'buyer' && (
          <div className="space-y-6">
            {!escrowResult ? (
              <div className="bg-neutral-900/60 border border-white/10 rounded-[2rem] p-8 backdrop-blur-2xl">
                <h2 className="text-2xl font-black italic mb-6 flex items-center gap-3">
                  <Zap className="text-amber-500 fill-amber-500" size={24} /> Create Escrow
                </h2>
                <form onSubmit={handleCreateEscrow} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Seller Wallet Address</label>
                    <input required placeholder="G..." value={sellerWallet} onChange={(e) => setSellerWallet(e.target.value)}
className="w-
f
full bg-black/50 border border-white/5 rounded-2xl py-4 px-5 focus:border-amber-500 outline-none text-white font-mono text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Amount (Pi)</label>
                      <input required type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-5 text-amber-500 font-black text-xl focus:border-amber-500 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-neutral-500 ml-1">Fee (1%)</label>
                      <div className="w-full bg-neutral-800/20 border border-white/5 rounded-2xl py-4 px-5 text-neutral-400 font-black text-xl italic">{fee.toFixed(4)} Pi</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Deal Terms</label>
                    <textarea placeholder="Describe the goods or service..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-5 focus:border-amber-500 outline-none text-sm resize-none" />
                  </div>
                  {buyerError && <div className="text-red-400 text-xs font-black p-4 bg-red-500/5 rounded-xl border border-red-500/20 flex items-center gap-2"><AlertCircle size={14} /> {buyerError}</div>}
                  <button type="submit" disabled={isProcessing || !amount || !sellerWallet}
                    className="w-full py-5 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 transition-all disabled:opacity-30 flex items-center justify-center gap-3">
                    {isProcessing ? <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" /> : <Lock size={18} />}
                    {isProcessing ? 'Creating Escrow...' : 'Lock Funds in Escrow'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/5 border border-green-500/20 rounded-[2rem] p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <CheckCircle2 className="text-green-400" size={24} />
                    <h2 className="text-xl font-black text-green-400">Escrow Created!</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-black/30 rounded-2xl p-5">
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-2">Escrow Code — Share with Seller</div>
                      <div className="text-3xl font-black text-amber-500 tracking-widest mb-3">{escrowResult?.escrowCode}</div>
                      <CopyButton text={escrowResult?.escrowCode as string} label="Copy Code" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-5 border border-red-500/20">
                      <div className="text-[10px] uppercase font-black text-red-400 mb-2">
                        Secret Key — Keep this PRIVATE
                      </div>
                      <div className="text-xl font-black text-white tracking-widest mb-3">{escrowResult?.secretKey}</div>
                      <p className="text-red-400/70 text-[10px] mb-3">You need this to release funds. Do NOT share with anyone.</p>
                      <CopyButton text={escrowResult?.secretKey as string} label="Copy Secret Key" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-5">
                      <div className="text-[10px] uppercase font-black tex
t-neutral-500 mb-2">Share Link — Send to Seller</div>
                      <div className="text-xs text-neutral-400 font-mono mb-3 break-all">{escrowResult?.shareUrl}</div>
                      <div className="flex gap-2">
                        <CopyButton text={escrowResult?.shareUrl as string} label="Copy Link" />
                        <button onClick={() => {
                          if (navigator.share) navigator.share({ title: 'PTrust Oracle Escrow', url: escrowResult?.shareUrl });
                          else window.open('https://wa.me/?text=' + encodeURIComponent(escrowResult?.shareUrl as string));
                        }} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-xs font-black text-amber-500 transition-all">
                          <Share2 size={12} /> Share
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-900/60 border border-white/10 rounded-[2rem] p-8">
                  <h3 className="text-lg font-black mb-2 flex items-center gap-2"><Key size={18} className="text-amber-500" /> Release Funds</h3>
                  <p className="text-neutral-500 text-xs mb-5">After seller confirms delivery, enter your secret key to release funds.</p>
                  <form onSubmit={handleRelease} className="space-y-4">
                    <input required placeholder="Escrow Code (PTO-XXXXXX)" value={releaseCode} onChange={(e) => setReleaseCode(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-5 focus:border-amber-500 outline-none font-mono text-sm uppercase" />
                    <input required placeholder="Your Secret Key (SK-XXXXXX)" value={releaseKey} onChange={(e) => setReleaseKey(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-5 focus:border-amber-500 outline-none font-mono text-sm" />
                    {releaseError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{releaseError}</div>}
                    {releaseSuccess && <div className="text-green-400 text-xs p-3 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2"><CheckCircle2 size={14} /> Funds Released!</div>}
                    <button type="submit" disabled={releaseLoading || releaseSuccess}
                      className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-amber-500 transition-all disabled:opacity-30">
                      {releaseLoading ? 'Releasing...' : 'Release Funds to Seller'}
                    </button>
                  </form>
                </div>

                <button onClick={() => setEscrowResult(null)} className="w-full py-3 text-neutral-500 text-sm font-black hover:text-white transition-all">
                  + Create New Escrow
                </button>
              </div>
            )}
          </div>
        )}
        {tab === 'seller' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/60 border border-white/10 rounded-[2rem] p-8 backdrop-blur-2xl">
              <h2 className="text-2xl font-black italic mb-6 flex items-center gap-3">
                <Package className="text-amber-500" size={24} /> Claim Payment
              </h2>
              {!sellerTx ? (
                <form onSubmit={handleLookupEscrow} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Escrow Code</label>
                    <input required placeholder="PTO-XXXXXX" value={sellerCode} onChange={(e) => setSellerCode(e.target.value.toUpperCase())}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-5 focus:border-amber-500 outline-none font-mono text-xl text-center tracking-widest uppercase" />
                  </div>
</div>
                  {sellerError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{sellerError}</div>}
                  <button type="submit" disabled={sellerLoading || !sellerCode}
                    className="w-full py-5 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 transition-all disabled:opacity-30">
                    {sellerLoading ? 'Looking up...' : 'Find My Escrow'}
                  </button>
                </form>
              ) : (
                <div className="space-y-5">
                  <div className="bg-black/30 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-neutral-500">Escrow Code</span>
                      <span className="font-black text-amber-500 tracking-widest">{sellerTx.escrowCode}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-neutral-500">Amount</span>
                      <span className="font-black text-xl">{sellerTx.amount} Pi</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-neutral-500">Buyer</span>
                      <span className="font-black">@{sellerTx.buyerUsername}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-neutral-500">Status</span>
                      <StatusBadge status={sellerTx.status} />
                    </div>
                    {sellerTx.description && (
                      <div>
                        <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">Deal Terms</div>
                        <p className="text-sm text-neutral-300">{sellerTx.description}</p>
                      </div>
                    )}
                  </div>
                  {sellerTx.status === 'LOCKED' && !deliverySuccess && (
                    <button onClick={handleConfirmDelivery} disabled={sellerLoading}
                      className="w-full py-5 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 transition-all disabled:opacity-30 flex items-center justify-center gap-3">
                      {sellerLoading ? <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" /> : <Package size={18} />}
                      Confirm Delivery
                    </button>
                  )}
                  {(sellerTx.status === 'DELIVERED' || deliverySuccess) && (
                    <div className="text-blue-400 text-sm font-black p-4 bg-blue-500/5 rounded-xl border border-blue-500/20 flex items-center gap-2">
                      <CheckCircle2 size={16} /> Delivery confirmed! Waiting for buyer to release funds.
                    </div>
                  )}
                  {sellerTx.status === 'RELEASED' && (
                    <div className="text-green-400 text-sm font-black p-4 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2">
                      <CheckCircle2 size={16} /> Funds released to your wallet!
                    </div>
                  )}
                  {sellerError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{sellerError}</div>}
                  <button onClick={() => { setSellerTx(null); setSellerCode(''); setDeliverySuccess(false); }}
                    className="w-full py-3 text-neutral-500 text-sm font-black hover:text-white transition-all">
                    Look up another escrow
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="space-y-4">
            <div
className="flex items-center justify-between">
              <h2 className="text-xl font-black italic">My Deals</h2>
              <button onClick={loadTransactions} className="text-[10px] uppercase font-black text-amber-500 hover:text-amber-400">Refresh</button>
            </div>
            {txLoading && <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" /></div>}
            {!txLoading && transactions.length === 0 && (
              <div className="text-center py-16 text-neutral-600">
                <ClipboardList size={40} className="mx-auto mb-4 opacity-30" />
                <p className="font-black">No transactions yet</p>
              </div>
            )}
            {transactions.map((tx) => (
              <div key={tx._id} className="bg-neutral-900/60 border border-white/5 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-500 tracking-widest text-sm">{tx.escrowCode}</span>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Amount</span>
                  <span className="font-black">{tx.amount} Pi</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">{tx.buyerUsername === user.username ? 'Seller' : 'Buyer'}</span>
                  <span className="font-black text-xs">{tx.buyerUsername === user.username ? tx.sellerWallet.slice(0, 8) + '...' : '@' + tx.buyerUsername}</span>
                </div>
                {tx.description && <p className="text-xs text-neutral-500">{tx.description}</p>}
                <div className="text-[10px] text-neutral-600">{new Date(tx.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
'use client';

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
  sellerUsername?: string;
  amount: number;
  fee: number;
  description: string;
  status: 'LOCKED' | 'DELIVERED' | 'RELEASED' | 'DISPUTED' | 'PENDING_ADMIN';
  createdAt: string;
  rating?: number;
}

async function createEscrow(data: { sellerWallet: string; amount: number; fee: number; description: string; buyerUsername: string }) {
  const res = await fetch('/api/escrow/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Oracle Error');
  return res.json();
}

async function fetchEscrowByCode(code: string) {
  const res = await fetch('/api/escrow/transaction/' + code);
  if (!res.ok) throw new Error('Escrow not found');
  return res.json();
}

async function confirmDelivery(escrowCode: string, sellerUsername: string) {
  const res = await fetch('/api/escrow/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escrowCode, sellerUsername }) });
  if (!res.ok) throw new Error('Delivery confirmation failed');
  return res.json();
}

async function releaseEscrow(escrowCode: string, secretKey: string, confirmText: string) {
  if (confirmText !== 'CONFIRM') throw new Error('Please type CONFIRM to release funds');
  const res = await fetch('/api/escrow/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escrowCode, secretKey }) });
  if (!res.ok) throw new Error('Release failed - check your secret key');
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    LOCKED:        { color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',   label: 'Locked' },
    DELIVERED:     { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       label: 'Delivered' },
    RELEASED:      { color: 'bg-green-500/10 text-green-400 border-green-500/20',    label: 'Released' },
    DISPUTED:      { color: 'bg-red-500/10 text-red-400 border-red-500/20',          label: 'Disputed' },
    PENDING_ADMIN: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Admin Review' },
  };
  const s = map[status] || map.LOCKED;
  return <span className={'text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ' + s.color}>{s.label}</span>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black transition-all">
      <Copy size={12} />{copied ? 'Copied!' : label}
    </button>
  );
}
function StarRating({ onRate }: { onRate: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
          onClick={() => { setSelected(n); onRate(n); }}
          className={'transition-all ' + (n <= (hovered || selected) ? 'text-amber-500' : 'text-neutral-700')}>
          <Star size={24} fill={n <= (hovered || selected) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  const steps = [
    { icon: '🛒', title: 'Buyer Creates Escrow', desc: 'Enter seller wallet, amount and deal terms. Funds are locked safely.' },
    { icon: '🔑', title: 'Share Code and Link', desc: 'Send the Escrow Code and Share Link to the seller. Keep your Secret Key PRIVATE.' },
    { icon: '📦', title: 'Seller Confirms Delivery', desc: 'Seller enters the Escrow Code and confirms delivery after sending goods.' },
    { icon: '✅', title: 'Buyer Releases Funds', desc: 'Buyer verifies receipt and enters Secret Key to release funds to seller.' },
    { icon: '⚠️', title: 'Dispute? Contact Support', desc: 'If there is a problem, open a dispute. Admin will review and decide.' },
  ];
  return (
    <div className="bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left">
        <div className="flex items-center gap-3">
          <HelpCircle size={18} className="text-amber-500" />
          <span className="font-black text-sm">How It Works</span>
        </div>
        {open ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="text-2xl">{s.icon}</div>
              <div>
                <div className="text-xs font-black text-white">{s.title}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [escrowResult, setEscrowResult] = useState<{ escrowCode: string; secretKey: string; shareUrl: string } | null>(null);
