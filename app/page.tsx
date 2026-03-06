return (
              <button key={key} onClick={() => setTab(key)}
                className={'flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black transition-all ' + (tab === key ? 'bg-amber-500 text-black' : 'text-neutral-500 hover:text-white')}>
                <Icon size={13} />{labels[key]}
              </button>
            );
          })}
        </div>

        {tab === 'buyer' && (
          <div className="space-y-5">
            <HowItWorks />
            {!escrowResult ? (
              <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
                <h2 className="text-xl font-black italic mb-5 flex items-center gap-2">
                  <Zap className="text-amber-500 fill-amber-500" size={20} /> Create Escrow
                </h2>
                <form onSubmit={handleCreateEscrow} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Seller Wallet Address</label>
                    <input required placeholder="G..." value={sellerWallet} onChange={(e) => setSellerWallet(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none text-white font-mono text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Amount (Pi)</label>
                      <input required type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 text-amber-500 font-black text-lg focus:border-amber-500 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-neutral-500 ml-1">Fee (1%)</label>
                      <div className="w-full bg-neutral-800/20 border border-white/5 rounded-2xl py-3.5 px-4 text-neutral-400 font-black text-lg italic">{fee.toFixed(3)} Pi</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Deal Terms</label>
                    <textarea placeholder="Describe the goods or service..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none text-sm resize-none" />
                  </div>
                  {buyerError && (
                    <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20 flex items-center gap-2">
                      <AlertCircle size={13} />{buyerError}
                    </div>
                  )}
                  <button type="submit" disabled={isProcessing  !amount  !sellerWallet}
                    className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm">
                    {isProcessing ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" /> : <Lock size={16} />}
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
                      <div className="text-sm font-black text-amber-500 tracking-wider mb-2">{escrowResult.transactionNumber}</div>
                      <CopyButton text={escrowResult.transactionNumber} label="Copy TX Number" />
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4">
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">Escrow Code — Share with Seller</div>
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
                      <div className="text-[10px] uppercase font-black text-neutral-500 mb-1">Share Link — Send to Seller</div>
                      <div className="text-[11px] text-neutral-400 font-mono mb-2 break-all">{escrowResult.shareUrl}</div>
                      <div className="flex gap-2">
                        <CopyButton text={escrowResult.shareUrl} label="Copy Link" />
                        <button
                          onClick={() => {
                            if (navigator.share) navigator.share({ title: 'PTrust Oracle Escrow', url: escrowResult.shareUrl });
                            else window.open('https://wa.me/?text=' + encodeURIComponent(escrowResult.shareUrl));
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] font-black text-amber-500"
                        >
                          <Share2 size={11} /> Share
                        </button>
                      </div>
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                      <p className="text-amber-500 text-[11px] font-black">Next Step</p>
                      <p className="text-neutral-400 text-[11px] mt-1">Wait for seller to Accept the deal. Then come back to release funds after delivery.</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setEscrowResult(null)} className="w-full py-3 text-neutral-500 text-sm font-black hover:text-white transition-all">
                  + Create New Escrow
                </button>
              </div>
            )}

            <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6">
<h3 className="text-base font-black mb-1 flex items-center gap-2">
                <Key size={16} className="text-amber-500" /> Release Existing Escrow
              </h3>
              <p className="text-neutral-500 text-[11px] mb-4">After seller confirms delivery, enter your codes here to release funds.</p>
              <form onSubmit={handleRelease} className="space-y-3">
                <input required placeholder="Escrow Code (PTO-XXXXXX)" value={releaseCode} onChange={(e) => setReleaseCode(e.target.value.toUpperCase())}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-sm uppercase" />
                <input required placeholder="Your Secret Key (SK-XXXXXX)" value={releaseKey} onChange={(e) => setReleaseKey(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 px-4 focus:border-amber-500 outline-none font-mono text-sm" />
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-500 text-[11px] font-black mb-2">Type CONFIRM to release funds (irreversible)</p>
                  <input required placeholder="Type: CONFIRM" value={releaseConfirm} onChange={(e) => setReleaseConfirm(e.target.value)}
                    className="w-full bg-black/50 border border-amber-500/20 rounded-xl py-3 px-4 focus:border-amber-500 outline-none text-sm text-center font-black tracking-widest" />
                </div>
                {releaseError && (
                  <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20 flex items-center gap-2">
                    <AlertCircle size={13} />{releaseError}
                  </div>
                )}
                {releaseSuccess && (
                  <div className="text-green-400 text-xs p-3 bg-green-500/5 rounded-xl border border-green-500/20 flex items-center gap-2">
                    <CheckCircle2 size={13} /> Funds Released Successfully!
                  </div>
                )}
                <button type="submit" disabled={releaseLoading  releaseSuccess  releaseConfirm !== 'CONFIRM'}
                  className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-30 text-sm">
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
                    <label className="text-[10px] uppercase font-black text-amber-500 ml-1">Escrow Code</label>
                    <input required placeholder="PTO-XXXXXX" value={sellerCode} onChange={(e) => setSellerCode(e.target.value.toUpperCase())}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-4 focus:border-amber-500 outline-none font-mono text-xl text-center tracking-widest uppercase" />
                  </div>
                  {sellerError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{sellerError}</div>}
                  <button type="submit" disabled={sellerLoading || !sellerCode}
className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 text-sm">
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
                        <p className="text-yellow-400 text-[11px] font-black">Step 1 — Accept this deal to lock the funds securely</p>
                      </div>
                      <button onClick={handleAcceptDeal} disabled={sellerLoading}
                        className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm">
                        {sellerLoading ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" /> : <Shield size={16} />}
                        Accept Deal and Lock Funds
                      </button>
                    </div>
                  )}

                  {sellerTx.status === 'ACCEPTED' && (
                    <div className="space-y-3">
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                        <p className="text-amber-500 text-[11px] font-black">Step 2 — Send the goods then confirm delivery</p>
                      </div>
                      <button onClick={handleConfirmDelivery} disabled={sellerLoading}
                        className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 text-sm">
                        {sellerLoading ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" /> : <Package size={16} />}
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
                          <StarRating onRate={async (n) => {
                            try {
                              await submitRating(sellerTx.escrowCode, n, user.username);
                              setSellerTx((prev) => prev ? { ...prev, rating: n } : null);
                            } catch {}
                          }} />
                        </div>
                      )}
                    </div>
                  )}

                  {sellerError && <div className="text-red-400 text-xs p-3 bg-red-500/5 rounded-xl border border-red-500/20">{sellerError}</div>}
                  <button onClick={() => { setSellerTx(null); setSellerCode(''); }}
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black italic">My Deals</h2>
              <button onClick={loadTransactions} className="text-[10px] uppercase font-black text-amber-500 hover:text-amber-400">Refresh</button>
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
                  <span className="font-black text-amber-500 tracking-widest text-xs">{tx.transactionNumber || tx.escrowCode}</span>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 text-xs">Amount</span>
                  <span className="font-black">{tx.amount} Pi</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 text-xs">{tx.buyerUsername === user?.username ? 'Seller' : 'Buyer'}</span>
                  <span className="font-black text-xs">{tx.buyerUsername === user?.username ? (tx.sellerWallet?.slice(0, 8) || '') + '...' : '@' + tx.buyerUsername}</span>
</div>
                {tx.description && <p className="text-[11px] text-neutral-500">{tx.description}</p>}
                <div className="text-[10px] text-neutral-600">{new Date(tx.createdAt).toLocaleDateString()}</div>
                {tx.status === 'DELIVERED' && tx.buyerUsername === user?.username && (
                  <button onClick={() => { setTab('buyer'); setReleaseCode(tx.escrowCode); }}
                    className="w-full py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black rounded-xl text-xs hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2">
                    <Key size={12} /> Release Funds
                  </button>
                )}
                {(tx.status === 'PENDING'  tx.status === 'ACCEPTED'  tx.status === 'LOCKED' || tx.status === 'DELIVERED') && (
                  <button onClick={() => openDispute(tx)}
                    className="w-full py-2.5 bg-red-500/5 border border-red-500/20 text-red-400 font-black rounded-xl text-xs hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
                    <AlertTriangle size={12} /> Open Dispute
                  </button>
                )}
                {tx.status === 'RELEASED' && !tx.rating && tx.buyerUsername === user?.username && (
                  <div className="pt-1">
                    <p className="text-[10px] text-neutral-500 mb-2">Rate this deal:</p>
                    <StarRating onRate={async (n) => {
                      try {
                        await submitRating(tx.escrowCode, n, user?.username || '');
                        setTransactions((prev) => prev.map((t) => t._id === tx._id ? { ...t, rating: n } : t));
                      } catch {}
                    }} />
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
              <p className="text-neutral-500 text-xs mb-4">Having issues? Contact our support team directly.</p>
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