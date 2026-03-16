'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { PiUser, PiAuthenticationResult, PiSDK } from '@/types/pi';

interface PiContextType {
  user: PiUser | null;
  loading: boolean;
  authenticateUser: () => Promise<void>;
}

const PiContext = createContext<PiContextType>({
  user: null,
  loading: false,
  authenticateUser: async () => {},
});

export const PiSDKProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]         = useState<PiUser | null>(null);
  const [loading, setLoading]   = useState<boolean>(true);
  const [sdkReady, setSdkReady] = useState<boolean>(false);

  const onIncompletePaymentFound = useCallback((payment: any) => {
    console.warn('[PTrust] Incomplete payment:', payment);
  }, []);

  const authenticateUser = useCallback(async () => {
    const Pi = (window as any).Pi;
    setLoading(true);
    try {
      const auth: PiAuthenticationResult = await (Pi as PiSDK).authenticate(
        ['username', 'payments', 'wallet_address'],
        onIncompletePaymentFound
      );
      setUser(auth.user);
    } catch (error) {
      console.error('[PTrust] Auth failed:', error);
    } finally {
      setLoading(false);
    }
  }, [onIncompletePaymentFound]);

  const initPi = useCallback(() => {
    const Pi = (window as any).Pi;
    if (Pi) {
      try {
        Pi.init({ version: '2.0', sandbox: false });
        setSdkReady(true);
      } catch (e) {
        console.error('[PTrust] Init failed:', e);
      }
    }
  }, []);

  useEffect(() => {
    const loadSdk = () => {
      if ((window as any).Pi) { initPi(); return; }
      const script = document.createElement('script');
      script.src = 'https://sdk.minepi.com/pi-sdk.js';
      script.async = true;
      script.onload = () => initPi();
      document.head.appendChild(script);
      const interval = setInterval(() => {
        if ((window as any).Pi) { clearInterval(interval); initPi(); }
      }, 300);
      const timeout = setTimeout(() => clearInterval(interval), 10000);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    };
    loadSdk();
  }, [initPi]);

  // Auto-authenticate when SDK is ready
  useEffect(() => {
    if (sdkReady) {
      authenticateUser();
    }
  }, [sdkReady, authenticateUser]);

  return (
    <PiContext.Provider value={{ user, loading, authenticateUser }}>
      {children}
    </PiContext.Provider>
  );
};

export const usePiSDK = () => useContext(PiContext);