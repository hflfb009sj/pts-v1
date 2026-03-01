'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';
import { ShieldCheck, Wallet, AlertCircle, CheckCircle2, ArrowRight, Lock, Zap } from 'lucide-react';

async function createEscrowTransaction(data: {
  sellerWallet: string;
  amount: number;
  fee: number;
  description: string;
  buyerUsername: string;
}) {
  const response = await fetch('/api/escrow/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Oracle Error');
  return await response.json();
}

export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [mounted, setMounted] = useState(false);
  const [sellerWallet, setSellerWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const fee = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) || val <= 0 ? 0 : val / 100;
  }, [amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Connect Pi Wallet first.'); return; }
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createEscrowTransaction({
        sellerWallet,
        amount: parseFloat(amount),
        fee,
        description: description || 'No description provided',
        buyerUsername: user.username,
      });
      setSuccess('Escrow Active - ID: ' + (result.paymentId || 'Confirmed'));
      setAmount('');
      setSellerWallet('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Initialization failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen flex flex-col items-center p-6 bg-[#050505] text-white">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-amber-500/[0.07] blur-[140px] pointer-events-none -z-10" />
      {!user ? (
        <div className="flex flex-col items-center justify-center min-h-[90vh] text-center space-y-10 max-w-4xl px-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black tracking-[0.3em] uppercase">
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
            {[
              { value: '0%', label: 'Disputes' },
              { value: '1%', label: 'Service Fee' },
              { value: '24/7', label: 'Available' }
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-black text-amber-500">{stat.value}</div>
                <div className="text-xs text-neutral-500 uppercase tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={authenticateUser}
            disabled={loading}
            className="px-12 py-6 bg-amber-500 text-black font-black rounded-2xl transition-all hover:scale-105 hover:bg-amber-400 shadow-[0_20px_80px_rgba(245,158,11,0.3)] flex items-center gap-4 disabled:opacity-50"
          >
            <Wallet size={24} />
            <span>{loading ? 'AUTHENTICATING...' : 'CONNECT PI WALLET'}</span>
            <ArrowRight size={20} />
          </button>
        </div>
      ) : (
        <div className="w-full max-w-7xl mt-12 mb-20 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-6">
              <div className="p-8 rounded-[2.5rem] bg-neutral-900/40 border border-white/5 backdrop-blur-3xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-xl">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-2xl italic">@{user.username}</h3>
                    <p className="text-amber-500 text-[10px] font-black tracking-widest uppercase">Verified Pi Participant</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Status', value: 'Active' },
                    { label: 'Network', value: 'Pi Mainnet' }
                  ].map((item) => (
                    <div key={item.label} className="bg-black/30 rounded-2xl p-4">
                      <div className="text-[10px] text-neutral-500 uppercase tracking-widest">{item.label}</div>
                      <div className="text-sm font-black text-white mt-1">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="bg-neutral-900/60 border border-white/10 rounded-[3rem] p-10 backdrop-blur-2xl shadow-2xl">
                <h2 className="text-4xl font-black italic mb-8 flex items-center gap-4">
                  <Zap className="text-amber-500 fill-amber-500" size={32} /> Secure Portal
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-2">Seller Wallet Address</label>
                    <input
                      required
                      placeholder="G..."
                      value={sellerWallet}
                      onChange={(e) => setSellerWallet(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-5 px-6 focus:border-amber-500 outline-none transition-all text-white font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-amber-500 ml-2">Amount (Pi)</label>
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-black/50 border border-white/5 rounded-2xl py-5 px-6 text-amber-500 font-black text-2xl focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-neutral-500 ml-2">Service Fee (1%)</label>
                      <div className="w-full bg-neutral-800/20 border border-white/5 rounded-2xl py-5 px-6 text-neutral-400 font-black text-2xl italic">
                        {fee.toFixed(4)} Pi
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-2">Deal Terms / Description</label>
                    <textarea
                      placeholder="Describe the goods or service..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-6 focus:border-amber-500 outline-none text-sm resize-none"
                    />
                  </div>
                  {error && (
                    <div className="text-red-400 text-xs font-black p-4 bg-red-500/5 rounded-xl border border-red-500/20 flex items-center gap-2">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}
                  {success && (
                    <div className="text-green-400 text-xs font-black p-4 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2">
                      <CheckCircle2 size={16} /> {success}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isProcessing || !amount || !sellerWallet}
                    className="w-full py-6 bg-white text-black font-black rounded-3xl hover:bg-amber-500 transition-all uppercase tracking-tighter disabled:opacity-20 flex items-center justify-center gap-3"
                  >
                    {isProcessing ? (
                      <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
                    ) : (
                      <Lock size={20} />
                    )}
                    {isProcessing ? 'Deploying Escrow Contract...' : 'Initialize Secure Escrow'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}