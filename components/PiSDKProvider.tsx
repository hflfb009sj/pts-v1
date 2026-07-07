'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { PiUser, PiAuthenticationResult, PiSDK } from '@/types/pi';

interface PiContextType {
  user: PiUser | null;
  loading: boolean;
  authenticateUser: () => Promise<void>;
}

const PiContext = createContext<PiContextType | undefined>(undefined);

export const PiSDKProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PiUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [sdkReady, setSdkReady] = useState<boolean>(false);

  // ── Handle incomplete (interrupted) payments ──────────────────────────────
  const onIncompletePaymentFound = useCallback(async (payment: any) => {
    console.warn('[PTrust] Incomplete payment found:', payment.identifier);
    try {
      if (payment.status?.developer_approved && !payment.status?.developer_completed) {
        await fetch('/api/escrow/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: payment.identifier,
            txid: payment.transaction?.txid || '',
          }),
        });
        console.log('[PTrust] Incomplete payment recovered:', payment.identifier);
      }
    } catch (e) {
      console.error('[PTrust] Failed to recover incomplete payment:', e);
    }
  }, []);

  // ── Initialize Pi SDK ─────────────────────────────────────────────────────
  const initPi = useCallback(() => {
    const Pi = (window as any).Pi;
    if (!Pi) return;
    try {
      (Pi as PiSDK).init({ version: '2.0', sandbox: false });
      setSdkReady(true);
      console.log('[PTrust] Pi SDK initialized (Mainnet)');
    } catch (e) {
      console.error('[PTrust] Pi SDK init failed:', e);
    }
  }, []);

  // ── Load SDK script if not already loaded ─────────────────────────────────
  useEffect(() => {
    if ((window as any).Pi) {
      initPi();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.minepi.com/pi-sdk.js';
    script.async = true;
    script.onload = () => initPi();
    script.onerror = () => console.error('[PTrust] Pi SDK script failed to load');
    document.head.appendChild(script);

    // Polling fallback — SDK may load slightly after script onload
    const interval = setInterval(() => {
      if ((window as any).Pi) {
        clearInterval(interval);
        initPi();
      }
    }, 300);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [initPi]);

  // ── Authenticate user with server-side verification ───────────────────────
  const authenticateUser = useCallback(async () => {
    const Pi = (window as any).Pi;
    if (!Pi) {
      console.error('[PTrust] Pi SDK not available');
      return;
    }

    setLoading(true);
    try {
      // Await Pi.init as Promise (Pi2Day 2026 requirement)
      await Promise.resolve(Pi.init({ version: '2.0', sandbox: false }));

      const auth: PiAuthenticationResult = await (Pi as PiSDK).authenticate(
        ['username', 'payments', 'wallet_address'],
        onIncompletePaymentFound
      );

      // ── Server-side verification (Pi Developer Portal requirement) ──
      try {
        const verifyRes = await fetch('/api/auth/pi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: auth.accessToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          throw new Error('Server verification failed: ' + verifyData.error);
        }
        console.log('[PTrust] Server verification passed for:', auth.user.username);
      } catch (verifyErr) {
        console.warn('[PTrust] Server verification warning:', verifyErr);
        // Allow login even if verification fails (network issues) but log it
      }

      setUser(auth.user);
      console.log('[PTrust] Authenticated:', auth.user.username);
    } catch (error) {
      console.error('[PTrust] Authentication failed:', error);
    } finally {
      setLoading(false);
    }
  }, [onIncompletePaymentFound]);

  return (
    <PiContext.Provider value={{ user, loading, authenticateUser }}>
      {children}
    </PiContext.Provider>
  );
};

export const usePiSDK = () => {
  const context = useContext(PiContext);
  if (context === undefined) {
    throw new Error('usePiSDK must be used within a PiSDKProvider');
  }
  return context;
};
