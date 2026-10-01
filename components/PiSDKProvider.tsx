'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
interface PiUser { uid: string; username: string; }
interface PiSDKContextType { user: PiUser|null; loading: boolean; authenticateUser: ()=>Promise<void>; }
const PiSDKContext = createContext<PiSDKContextType>({ user:null, loading:true, authenticateUser:async()=>{} });
export function usePiSDK() { return useContext(PiSDKContext); }
export function PiSDKProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<PiUser|null>(null);
  const [loading, setLoading] = useState(true);
  const authenticateUser = useCallback(async () => {
    setLoading(true);
    try {
      const win = window as any;
      if (!win.Pi) { setLoading(false); return; }
      const scopes = ['username','payments','wallet_address'];
      const authResult = await win.Pi.authenticate(scopes, async (payment: any) => {
        try { await fetch('/api/escrow/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paymentId:payment.identifier,txid:payment.transaction?.txid})}); } catch {}
      });
      if (authResult?.user) {
        const piUser: PiUser = { uid: authResult.user.uid, username: authResult.user.username };
        try { await fetch('/api/auth/pi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:piUser.uid,username:piUser.username,accessToken:authResult.accessToken})}); } catch {}
        setUser(piUser);
        try { localStorage.setItem('ptrust_user', JSON.stringify(piUser)); } catch { sessionStorage.setItem('ptrust_user', JSON.stringify(piUser)); }
      }
    } catch(error) { console.error('Pi auth error:', error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ptrust_user') || sessionStorage.getItem('ptrust_user');
      if (stored) { try { setUser(JSON.parse(stored)); } catch {} setLoading(false); return; }
    } catch {}
    const timer = setTimeout(() => {
      const win = window as any;
      if (win.Pi) { authenticateUser(); } else { setLoading(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [authenticateUser]);
  return <PiSDKContext.Provider value={{ user, loading, authenticateUser }}>{children}</PiSDKContext.Provider>;
}
